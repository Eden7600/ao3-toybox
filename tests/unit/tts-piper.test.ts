import {
  PiperCancelledError,
  PiperWorkerClient,
  wavDurationSeconds,
  type PiperAssets,
} from "@src/common/tts/piper-engine";
import { PIPER_VOICES, piperVoiceById } from "@src/common/tts/piper-protocol";
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

describe("PiperWorkerClient.abandonPending", () => {
  it("rejects the in-flight request with a cancellation error", async () => {
    const client = new PiperWorkerClient({} as PiperAssets);

    // Reach the private pending slot the way cancel() does in production:
    // fake an in-flight request without a real worker
    const pending = new Promise((resolve, reject) => {
      (
        client as unknown as {
          pending: {
            resolve: typeof resolve;
            reject: typeof reject;
            accepts: string[];
          };
        }
      ).pending = { resolve, reject, accepts: ["audio"] };
    });

    client.abandonPending();

    await expect(pending).rejects.toBeInstanceOf(PiperCancelledError);
    // Abandoning again with nothing in flight is a no-op
    client.abandonPending();
  });
});
