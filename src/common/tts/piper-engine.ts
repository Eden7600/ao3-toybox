// Content-side half of the enhanced voice tier: owns the blob worker
// running Piper, and implements the SpeechEngine contract by playing
// each synthesized WAV through an AudioContext. Speed maps to
// playbackRate (Piper has no native rate control — this shifts pitch
// slightly with tempo); the pitch preference does not apply to this
// engine.

import type { SpeakOptions, SpeechEngine } from "./playback-controller";
import type {
  PiperWasmPaths,
  PiperWorkerRequest,
  PiperWorkerResponse,
} from "./piper-protocol";

/** Locations of the packaged pieces, resolved by the caller via
 *  runtime.getURL (the engine itself stays extension-API-free and
 *  therefore unit-testable). */
export type PiperAssets = {
  workerJs: string;
  ortGlueMjs: string;
  ortWasm: string;
  piperData: string;
  piperWasm: string;
};

export type PiperProgress = { loaded: number; total: number };

type Pending = {
  resolve: (response: PiperWorkerResponse) => void;
  reject: (error: Error) => void;
  /** Response types that settle this request. */
  accepts: string[];
};

/** Signals that cancel() abandoned the in-flight request — an expected
 *  outcome, distinct from a worker failure. */
export class PiperCancelledError extends Error {
  constructor() {
    super("piper request cancelled");
    this.name = "PiperCancelledError";
  }
}

/**
 * Thin request/response bridge over the worker's message stream. One
 * in-flight request at a time — the playback controller already speaks
 * strictly sequentially, and storage operations come from the settings
 * UI which awaits each action.
 */
export class PiperWorkerClient {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private onProgress: ((progress: PiperProgress) => void) | null = null;
  private readonly assets: PiperAssets;

  constructor(assets: PiperAssets) {
    this.assets = assets;
  }

  setProgressListener(
    listener: ((progress: PiperProgress) => void) | null,
  ): void {
    this.onProgress = listener;
  }

  /**
   * The worker script and the ORT glue module both become blob URLs: a
   * page-origin worker can neither be constructed from nor module-import
   * a chrome-extension:// URL, but their fetched text can travel as
   * blobs. The wasm binaries are fetched (not imported) by the glue, so
   * their extension URLs pass through untouched.
   */
  private async ensureWorker(): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    const [workerCode, glueCode] = await Promise.all([
      fetch(this.assets.workerJs).then((response) => response.text()),
      fetch(this.assets.ortGlueMjs).then((response) => response.text()),
    ]);

    const worker = new Worker(
      URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" })),
    );

    this.glueUrl = URL.createObjectURL(
      new Blob([glueCode], { type: "text/javascript" }),
    );

    worker.onmessage = (event: MessageEvent<PiperWorkerResponse>) => {
      const message = event.data;

      if (message.type === "progress") {
        this.onProgress?.({ loaded: message.loaded, total: message.total });

        return;
      }

      if (message.type === "boot") {
        return;
      }

      const { pending } = this;

      if (!pending) {
        return;
      }

      if (message.type === "error") {
        this.pending = null;
        pending.reject(new Error(message.error));
      } else if (pending.accepts.includes(message.type)) {
        this.pending = null;
        pending.resolve(message);
      }
    };

    this.worker = worker;

    return worker;
  }

  private glueUrl = "";

  wasmPaths(): PiperWasmPaths {
    return {
      onnxWasm: { mjs: this.glueUrl, wasm: this.assets.ortWasm },
      piperData: this.assets.piperData,
      piperWasm: this.assets.piperWasm,
    };
  }

  async request(
    message: PiperWorkerRequest,
    accepts: string[],
  ): Promise<PiperWorkerResponse> {
    const worker = await this.ensureWorker();

    if (this.pending) {
      throw new Error("piper worker request already in flight");
    }

    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject, accepts };
      worker.postMessage(message);
    });
  }

  /** Rejects the in-flight request as cancelled; the worker's late
   *  response is ignored when it arrives. */
  abandonPending(): void {
    const { pending } = this;

    this.pending = null;
    pending?.reject(new PiperCancelledError());
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending = null;
  }
}

/** Parsed WAV pieces AudioContext needs nothing for — decodeAudioData
 *  handles the container; this exists for tests and duration math. */
export function wavDurationSeconds(byteLength: number, sampleRate: number) {
  return Math.max(0, byteLength - 44) / (sampleRate * 2);
}

export class PiperSpeechEngine implements SpeechEngine {
  private readonly client: PiperWorkerClient;
  private readonly voiceId: string;
  private ready = false;
  private context: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private cancelActive: (() => void) | null = null;
  private requestId = 0;

  constructor(client: PiperWorkerClient, voiceId: string) {
    this.client = client;
    this.voiceId = voiceId;
  }

  private async ensureReady(): Promise<void> {
    if (this.ready) {
      return;
    }

    await this.client.request(
      {
        type: "init",
        voiceId: this.voiceId,
        wasmPaths: this.client.wasmPaths(),
      },
      ["ready"],
    );
    this.ready = true;
  }

  async speak(text: string, options: SpeakOptions): Promise<boolean> {
    let response: PiperWorkerResponse;

    try {
      await this.ensureReady();

      const id = ++this.requestId;

      response = await this.client.request({ type: "synthesize", id, text }, [
        "audio",
      ]);
    } catch (error) {
      if (error instanceof PiperCancelledError) {
        // Cancelled while synthesizing — the engine contract's "false"
        return false;
      }

      throw error;
    }

    if (response.type !== "audio") {
      throw new Error("piper worker returned an unexpected response");
    }

    this.context ??= new AudioContext();

    const { context } = this;

    if (context.state === "suspended") {
      await context.resume();
    }

    const buffer = await context.decodeAudioData(response.buffer);

    return new Promise<boolean>((resolve) => {
      const source = context.createBufferSource();

      source.buffer = buffer;
      // Rate via playback speed; Piper voices have no native rate knob
      source.playbackRate.value = Math.min(Math.max(options.rate, 0.5), 3);
      source.connect(context.destination);

      let cancelled = false;

      this.cancelActive = () => {
        cancelled = true;
        source.stop();
      };

      source.onended = () => {
        if (this.activeSource === source) {
          this.activeSource = null;
          this.cancelActive = null;
        }

        resolve(!cancelled);
      };

      this.activeSource = source;
      source.start();
    });
  }

  cancel(): void {
    // A pending synthesis result is abandoned; a playing source stops
    // and resolves its speak() promise with false via onended
    this.client.abandonPending();
    this.cancelActive?.();
  }

  dispose(): void {
    this.cancel();
    void this.context?.close();
    this.context = null;
  }
}
