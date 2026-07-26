import {
  PiperCancelledError,
  PiperWorkerClient,
  wavDurationSeconds,
  type PiperAssets,
  type PiperWorkerLike,
} from "@src/common/tts/piper-engine";
import {
  PIPER_VOICES,
  piperVoiceById,
  type PiperWorkerRequest,
  type PiperWorkerResponse,
} from "@src/common/tts/piper-protocol";
import { DEFAULT_TTS_SETTINGS } from "@src/common/tts/tts-settings";
import { describe, expect, it } from "vitest";

describe("PIPER_VOICES", () => {
  it("has unique ids and honest metadata", () => {
    const ids = PIPER_VOICES.map((voice) => voice.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const voice of PIPER_VOICES) {
      expect(voice.sizeMB).toBeGreaterThan(0);
      expect(voice.label.length).toBeGreaterThan(0);
      expect(voice.lang.startsWith("en")).toBe(true);
    }
  });

  it("contains the default voice from settings", () => {
    expect(piperVoiceById(DEFAULT_TTS_SETTINGS.piperVoiceId)).not.toBeNull();
    expect(piperVoiceById("nope")).toBeNull();
  });
});

describe("wavDurationSeconds", () => {
  it("computes duration from 16-bit mono payload size", () => {
    // 22050 Hz * 2 bytes * 2 seconds + 44-byte header
    expect(wavDurationSeconds(44 + 22050 * 2 * 2, 22050)).toBe(2);
    expect(wavDurationSeconds(10, 22050)).toBe(0);
  });
});

/**
 * Worker double: records posted requests; the test answers them
 * explicitly through the onmessage handler the client attaches.
 */
function fakeWorker() {
  const worker: PiperWorkerLike & { posted: PiperWorkerRequest[] } = {
    posted: [],
    onmessage: null,
    postMessage(message) {
      worker.posted.push(message);
    },
    terminate() {
      /* Test double */
    },
  };

  const respond = (response: PiperWorkerResponse) => {
    worker.onmessage?.({ data: response } as MessageEvent<PiperWorkerResponse>);
  };

  return { worker, respond };
}

const TEST_ASSETS: PiperAssets = {
  workerJs: "worker.js",
  ortGlueMjs: "glue.mjs",
  ortWasm: "ort.wasm",
  piperData: "piper.data",
  piperWasm: "piper.wasm",
};

function clientWith(worker: PiperWorkerLike): PiperWorkerClient {
  return new PiperWorkerClient(TEST_ASSETS, () => Promise.resolve(worker));
}

async function drain(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

describe("PiperWorkerClient", () => {
  it("serializes concurrent requests instead of throwing", async () => {
    const { worker, respond } = fakeWorker();
    const client = clientWith(worker);

    const first = client.request(
      {
        type: "init",
        voiceId: "v",
        wasmPaths: {
          onnxWasm: { mjs: "glue", wasm: "ort.wasm" },
          piperData: "piper.data",
          piperWasm: "piper.wasm",
        },
      },
      ["ready"],
    );
    const second = client.request({ type: "stored" }, ["stored"]);

    await drain();
    // Only the first request reaches the worker until it settles
    expect(worker.posted.map((m) => m.type)).toEqual(["init"]);

    respond({ type: "ready" });
    await expect(first).resolves.toMatchObject({ type: "ready" });
    await drain();

    expect(worker.posted.map((m) => m.type)).toEqual(["init", "stored"]);
    respond({ type: "stored", voices: [] });
    await expect(second).resolves.toMatchObject({ type: "stored" });
  });

  it("abandonPending cancels the active request but queued ones proceed", async () => {
    const { worker, respond } = fakeWorker();
    const client = clientWith(worker);

    const first = client.request(
      { type: "synthesize", id: 1, text: "one" },
      ["audio"],
      1,
    );
    const second = client.request(
      { type: "synthesize", id: 2, text: "two" },
      ["audio"],
      2,
    );

    await drain();
    client.abandonPending();
    await expect(first).rejects.toBeInstanceOf(PiperCancelledError);
    await drain();

    expect(worker.posted.map((m) => m.type)).toEqual([
      "synthesize",
      "synthesize",
    ]);

    // The abandoned synthesis still finishes in the worker — its stale
    // audio must not satisfy the second request
    respond({ type: "audio", id: 1, buffer: new ArrayBuffer(1) });
    await drain();

    respond({ type: "audio", id: 2, buffer: new ArrayBuffer(2) });
    await expect(second).resolves.toMatchObject({ type: "audio", id: 2 });

    // Abandoning with nothing in flight is a no-op
    client.abandonPending();
  });
});
