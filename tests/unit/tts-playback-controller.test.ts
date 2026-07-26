import {
  PlaybackController,
  watchdogTimeoutMs,
  type PlaybackState,
  type SpeakOptions,
  type SpeechEngine,
} from "@src/common/tts/playback-controller";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OPTIONS: SpeakOptions = { rate: 1, pitch: 1, voiceId: null };

/**
 * Engine harness: every speak() parks a resolver the test settles
 * explicitly; cancel() settles the pending speak with false (the real
 * engine contract).
 */
class FakeEngine implements SpeechEngine {
  spoken: string[] = [];
  cancelCount = 0;
  private pending: {
    resolve: (ended: boolean) => void;
    reject: (error: Error) => void;
  } | null = null;

  speak(text: string): Promise<boolean> {
    this.spoken.push(text);

    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }

  cancel(): void {
    this.cancelCount++;
    this.pending?.resolve(false);
    this.pending = null;
  }

  /** Finish the current sentence successfully. */
  async end(): Promise<void> {
    this.pending?.resolve(true);
    this.pending = null;
    await drain();
  }

  /** Fail the current sentence. */
  async fail(message = "boom"): Promise<void> {
    this.pending?.reject(new Error(message));
    this.pending = null;
    await drain();
  }
}

async function drain(): Promise<void> {
  // Let the controller's run loop advance through its awaits —
  // sequential microtask turns are the point here
  for (let i = 0; i < 10; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

function record(states: PlaybackState[]) {
  return (state: PlaybackState) => {
    states.push(state);
  };
}

describe("PlaybackController", () => {
  it("speaks sentences in order and completes", async () => {
    const engine = new FakeEngine();
    const spokenOrder: number[] = [];
    let completed = false;

    const controller = new PlaybackController(
      engine,
      ["One.", "Two.", "Three."],
      OPTIONS,
      {
        onSentence(index) {
          spokenOrder.push(index);
        },
        onComplete() {
          completed = true;
        },
      },
    );

    controller.play();
    await drain();
    await engine.end();
    await engine.end();
    await engine.end();

    expect(engine.spoken).toEqual(["One.", "Two.", "Three."]);
    expect(spokenOrder).toEqual([0, 1, 2]);
    expect(completed).toBe(true);
    expect(controller.getState().status).toBe("ended");
  });

  it("pause holds the current sentence and resume reissues it", async () => {
    const engine = new FakeEngine();
    const controller = new PlaybackController(
      engine,
      ["One.", "Two."],
      OPTIONS,
      {},
    );

    controller.play();
    await drain();
    await engine.end();

    expect(controller.getState()).toMatchObject({
      status: "speaking",
      index: 1,
    });

    controller.pause();
    await drain();

    expect(controller.getState()).toMatchObject({ status: "paused", index: 1 });
    expect(engine.cancelCount).toBeGreaterThan(0);

    controller.play();
    await drain();

    // The paused sentence is reissued from its start (cancel-and-reissue)
    expect(engine.spoken).toEqual(["One.", "Two.", "Two."]);
  });

  it("stop returns to idle at index zero", async () => {
    const engine = new FakeEngine();
    const controller = new PlaybackController(
      engine,
      ["One.", "Two."],
      OPTIONS,
      {},
    );

    controller.play();
    await drain();
    controller.stop();
    await drain();

    expect(controller.getState()).toEqual({ status: "idle", index: 0 });
  });

  it("steps between sentences while paused without speaking", async () => {
    const engine = new FakeEngine();
    const controller = new PlaybackController(
      engine,
      ["One.", "Two.", "Three."],
      OPTIONS,
      {},
    );

    controller.play();
    await drain();
    controller.pause();
    await drain();

    controller.step(1);
    expect(controller.getState()).toMatchObject({ status: "paused", index: 1 });

    controller.step(-1);
    controller.step(-1); // Clamped at 0
    expect(controller.getState()).toMatchObject({ status: "paused", index: 0 });
    expect(engine.spoken).toEqual(["One."]);
  });

  it("retries a failed sentence once, then stops with an error state", async () => {
    const engine = new FakeEngine();
    const states: PlaybackState[] = [];
    const controller = new PlaybackController(
      engine,
      ["One.", "Two."],
      OPTIONS,
      { onState: record(states) },
    );

    controller.play();
    await drain();
    await engine.fail();

    // First failure: same sentence reissued
    expect(engine.spoken).toEqual(["One.", "One."]);

    await engine.fail("still broken");

    expect(controller.getState()).toMatchObject({
      status: "error",
      index: 0,
      errorMessage: "still broken",
    });

    // A single success after resume clears the streak
    controller.play();
    await drain();
    await engine.end();
    await engine.end();

    expect(controller.getState().status).toBe("ended");
  });

  it("play(index) starts from an explicit sentence", async () => {
    const engine = new FakeEngine();
    const controller = new PlaybackController(
      engine,
      ["One.", "Two.", "Three."],
      OPTIONS,
      {},
    );

    controller.play(2);
    await drain();

    expect(engine.spoken).toEqual(["Three."]);
  });

  describe("watchdog", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("cancels and retries an engine that never calls back", async () => {
      const engine = new FakeEngine();
      const controller = new PlaybackController(
        engine,
        ["Silent sentence."],
        OPTIONS,
        {},
      );

      controller.play();
      await vi.advanceTimersByTimeAsync(1);

      const budget = watchdogTimeoutMs("Silent sentence.", 1);

      await vi.advanceTimersByTimeAsync(budget + 1);
      expect(engine.spoken).toHaveLength(2); // Retry issued

      await vi.advanceTimersByTimeAsync(budget + 1);
      expect(controller.getState()).toMatchObject({
        status: "error",
        index: 0,
      });
    });
  });
});

describe("watchdogTimeoutMs", () => {
  it("scales with text length and inversely with rate", () => {
    const short = watchdogTimeoutMs("Hi.", 1);
    const long = watchdogTimeoutMs("A".repeat(500), 1);
    const fast = watchdogTimeoutMs("A".repeat(500), 2);

    expect(long).toBeGreaterThan(short);
    expect(fast).toBeLessThan(long);
    expect(watchdogTimeoutMs("Hi.", 0.1)).toBe(watchdogTimeoutMs("Hi.", 0.5));
  });
});
