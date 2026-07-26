// Content-side half of the enhanced voice tier: owns the blob worker
// running Piper, and implements the SpeechEngine contract by playing
// each synthesized WAV through an AudioContext. Speed maps to
// playbackRate (Piper has no native rate control — this shifts pitch
// slightly with tempo); the pitch preference does not apply to this
// engine.
//
// Synthesis is slower than the gap listeners tolerate (~0.5–1.5 s per
// sentence single-threaded; page-origin workers can never be
// crossOriginIsolated, so WASM threads are off the table). Two things
// hide that: worker requests are queued, never rejected for being
// concurrent, and the controller's prefetch hint synthesizes the next
// sentence while the current one plays, so steady-state playback is
// gapless.

import type { SpeakOptions, SpeechEngine } from "./playback-controller";
import type {
  PiperWasmPaths,
  PiperWorkerRequest,
  PiperWorkerResponse,
} from "./piper-protocol";
import { chunkForSynthesis } from "./speech-text";

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

/** The subset of Worker the client touches; injectable for tests. */
export type PiperWorkerLike = {
  postMessage(message: PiperWorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<PiperWorkerResponse>) => void) | null;
};

type Pending = {
  resolve: (response: PiperWorkerResponse) => void;
  reject: (error: Error) => void;
  /** Response types that settle this request. */
  accepts: string[];
  /** For synthesize: the id the audio response must carry. A stale
   *  response from an abandoned synthesis is ignored, not mismatched. */
  matchId?: number;
};

const ignoreRejection = () => undefined;

/** Signals that cancel() abandoned the in-flight request — an expected
 *  outcome, distinct from a worker failure. */
export class PiperCancelledError extends Error {
  constructor() {
    super("piper request cancelled");
    this.name = "PiperCancelledError";
  }
}

/**
 * Request/response bridge over the worker's message stream. Requests
 * are strictly serialized through an internal queue — concurrent
 * callers (playback, prefetch, the settings UI mid-init) simply wait
 * their turn instead of erroring.
 */
export class PiperWorkerClient {
  private worker: PiperWorkerLike | null = null;
  private pending: Pending | null = null;
  private onProgress: ((progress: PiperProgress) => void) | null = null;
  private readonly assets: PiperAssets;
  private readonly createWorker: (() => Promise<PiperWorkerLike>) | null;
  private glueUrl = "";
  /** Serialization tail: every request chains behind the previous one. */
  private queueTail: Promise<unknown> = Promise.resolve();

  constructor(
    assets: PiperAssets,
    createWorker: (() => Promise<PiperWorkerLike>) | null = null,
  ) {
    this.assets = assets;
    this.createWorker = createWorker;
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
  private async spawnWorker(): Promise<PiperWorkerLike> {
    if (this.createWorker) {
      return this.createWorker();
    }

    const [workerCode, glueCode] = await Promise.all([
      fetch(this.assets.workerJs).then((response) => response.text()),
      fetch(this.assets.ortGlueMjs).then((response) => response.text()),
    ]);

    this.glueUrl = URL.createObjectURL(
      new Blob([glueCode], { type: "text/javascript" }),
    );

    return new Worker(
      URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" })),
    );
  }

  private async ensureWorker(): Promise<PiperWorkerLike> {
    if (this.worker) {
      return this.worker;
    }

    const worker = await this.spawnWorker();

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

        return;
      }

      if (!pending.accepts.includes(message.type)) {
        return;
      }

      if (
        message.type === "audio" &&
        pending.matchId !== undefined &&
        message.id !== pending.matchId
      ) {
        // Leftover audio from an abandoned synthesis — drop it
        return;
      }

      this.pending = null;
      pending.resolve(message);
    };

    this.worker = worker;

    return worker;
  }

  wasmPaths(): PiperWasmPaths {
    return {
      onnxWasm: { mjs: this.glueUrl, wasm: this.assets.ortWasm },
      piperData: this.assets.piperData,
      piperWasm: this.assets.piperWasm,
    };
  }

  /** Bumped by clearQueue(); queued-but-unposted requests from an
   *  older epoch cancel instead of reaching the worker. */
  private queueEpoch = 0;

  request(
    message: PiperWorkerRequest,
    accepts: string[],
    matchId?: number,
  ): Promise<PiperWorkerResponse> {
    const epoch = this.queueEpoch;

    const run = async (): Promise<PiperWorkerResponse> => {
      if (epoch !== this.queueEpoch) {
        throw new PiperCancelledError();
      }

      const worker = await this.ensureWorker();

      return new Promise((resolve, reject) => {
        this.pending = { resolve, reject, accepts, matchId };
        worker.postMessage(message);
      });
    };

    // Chain regardless of how the predecessor settled
    const result = this.queueTail.then(run, run);

    this.queueTail = result.catch(ignoreRejection);

    return result;
  }

  /** Cancels queued requests that have not reached the worker yet —
   *  a seek must not wait behind stale prefetch synthesis. */
  clearQueue(): void {
    this.queueEpoch++;
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
    this.clearQueue();
    this.abandonPending();
  }
}

/** WAV payload duration for 16-bit mono audio (tests and duration math). */
export function wavDurationSeconds(byteLength: number, sampleRate: number) {
  return Math.max(0, byteLength - 44) / (sampleRate * 2);
}

/** Synthesized chunks kept decoded and ready to play. Chunks are at
 *  most SYNTHESIS_CHUNK_LIMIT chars, so this stays small in memory. */
const AUDIO_CACHE_LIMIT = 8;

export class PiperSpeechEngine implements SpeechEngine {
  private readonly client: PiperWorkerClient;
  private readonly voiceId: string;
  private ready = false;
  private context: AudioContext | null = null;
  private cancelActive: (() => void) | null = null;
  private requestId = 0;
  /** Text → decoded audio (or its in-flight synthesis). */
  private readonly cache = new Map<string, Promise<AudioBuffer>>();
  /** Fired when audio actually starts (UI "generating…" indicator). */
  onAudibleStart: (() => void) | null = null;

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

  private ensureContext(): AudioContext {
    this.context ??= new AudioContext();

    return this.context;
  }

  /**
   * Synthesize and decode one sentence, deduplicated through the cache:
   * a prefetch and the speak that follows it share the same promise.
   */
  private audioFor(text: string): Promise<AudioBuffer> {
    const cached = this.cache.get(text);

    if (cached) {
      return cached;
    }

    const id = ++this.requestId;
    const synthesis = this.client
      .request({ type: "synthesize", id, text }, ["audio"], id)
      .then(async (response) => {
        if (response.type !== "audio") {
          throw new Error("piper worker returned an unexpected response");
        }

        return this.ensureContext().decodeAudioData(response.buffer);
      });

    this.cache.set(text, synthesis);
    // A failed or cancelled synthesis must not poison later attempts
    synthesis.catch(() => {
      this.cache.delete(text);
    });

    while (this.cache.size > AUDIO_CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;

      if (oldest === undefined) {
        break;
      }

      this.cache.delete(oldest);
    }

    return synthesis;
  }

  /** Load the model ahead of the first play (fire-and-forget). */
  warmUp(): void {
    void this.ensureReady().catch(ignoreRejection);
  }

  /** The sentence expected after the current one. Stored, not acted on:
   *  its chunks are queued when the current sentence's LAST chunk starts
   *  playing, so the current sentence's own chunks always synthesize
   *  first. */
  private hint: string | null = null;

  prefetch(text: string): void {
    this.hint = text;
  }

  private fireHint(): void {
    const { hint } = this;

    this.hint = null;

    if (hint === null) {
      return;
    }

    for (const chunk of chunkForSynthesis(hint)) {
      // Fire-and-forget: results land in the cache; failures (incl.
      // cancellation) just mean the later speak() synthesizes again
      this.audioFor(chunk).catch(ignoreRejection);
    }
  }

  /**
   * Long sentences play as pipelined clause chunks: while chunk N plays,
   * chunk N+1 synthesizes — audio starts after the first clause instead
   * of after the whole sentence.
   */
  async speak(text: string, options: SpeakOptions): Promise<boolean> {
    try {
      await this.ensureReady();
    } catch (error) {
      if (error instanceof PiperCancelledError) {
        return false;
      }

      throw error;
    }

    const chunks = chunkForSynthesis(text);
    let upcoming: Promise<AudioBuffer> = this.audioFor(chunks[0]);

    for (let index = 0; index < chunks.length; index++) {
      let buffer: AudioBuffer;

      try {
        // eslint-disable-next-line no-await-in-loop
        buffer = await upcoming;
      } catch (error) {
        if (error instanceof PiperCancelledError) {
          // Cancelled while synthesizing — the engine contract's "false"
          return false;
        }

        throw error;
      }

      if (index + 1 < chunks.length) {
        upcoming = this.audioFor(chunks[index + 1]);
      } else {
        this.fireHint();
      }

      // eslint-disable-next-line no-await-in-loop
      const played = await this.playBuffer(buffer, options.rate);

      if (!played) {
        return false;
      }
    }

    return true;
  }

  private async playBuffer(buffer: AudioBuffer, rate: number) {
    const context = this.ensureContext();

    if (context.state === "suspended") {
      await context.resume();
    }

    return new Promise<boolean>((resolve) => {
      const source = context.createBufferSource();

      source.buffer = buffer;
      // Rate via playback speed; Piper voices have no native rate knob
      source.playbackRate.value = Math.min(Math.max(rate, 0.5), 3);
      source.connect(context.destination);

      let cancelled = false;

      this.cancelActive = () => {
        cancelled = true;
        source.stop();
      };

      source.onended = () => {
        if (!cancelled) {
          this.cancelActive = null;
        }

        resolve(!cancelled);
      };

      this.onAudibleStart?.();
      source.start();
    });
  }

  cancel(): void {
    // Queued (prefetch) synthesis is cleared so a seek starts fresh, the
    // pending result is abandoned, and a playing source stops — which
    // resolves its speak() promise with false via onended
    this.client.clearQueue();
    this.client.abandonPending();
    this.cancelActive?.();
    this.cancelActive = null;
    this.hint = null;
  }

  dispose(): void {
    this.cancel();
    this.cache.clear();
    void this.context?.close();
    this.context = null;
  }
}
