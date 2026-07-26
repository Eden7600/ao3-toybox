// Engine-agnostic read-aloud state machine. The controller owns sentence
// progression, pause/resume exactness, and failure handling; engines only
// know how to speak one string. Every engine callback is treated as
// untrusted: a per-sentence watchdog catches engines that never fire
// events, and two consecutive failures on the same sentence stop playback
// cleanly at a known index (the spec's degradation requirement).

export type SpeakOptions = {
  /** 0.5–3, engine-native rate. */
  rate: number;
  /** 0.5–2. */
  pitch: number;
  /** Engine-specific voice key; null = engine default. */
  voiceId: string | null;
};

export type SpeechEngine = {
  /**
   * Speak one sentence. Resolves true when it finished, false when it was
   * cancelled, rejects on engine error. Implementations must settle the
   * promise when cancel() is called.
   */
  speak(text: string, options: SpeakOptions): Promise<boolean>;
  /** Stop the current utterance; the pending speak() must settle. */
  cancel(): void;
  /**
   * Optional hint: the sentence likely to be spoken next. Engines with
   * synthesis latency use it to prepare ahead so playback is gapless;
   * it must never affect correctness.
   */
  prefetch?(text: string, options: SpeakOptions): void;
};

export type PlaybackStatus = "idle" | "speaking" | "paused" | "ended" | "error";

export type PlaybackState = {
  status: PlaybackStatus;
  /** Current sentence index; on "error" the sentence to resume from. */
  index: number;
  errorMessage?: string;
};

export type PlaybackCallbacks = {
  onState?: (state: PlaybackState) => void;
  /** Fired as each sentence starts speaking (highlight/scroll hook). */
  onSentence?: (index: number) => void;
  /** Fired once when the final sentence finishes. */
  onComplete?: () => void;
};

/** Consecutive failures on one sentence before playback stops. */
const MAX_FAILURE_STREAK = 2;

/**
 * Watchdog budget for one sentence: generous fixed floor plus a
 * per-character allowance scaled by rate. Slow engines get headroom;
 * an engine that never calls back gets caught.
 */
export function watchdogTimeoutMs(text: string, rate: number): number {
  const effectiveRate = Math.max(rate, 0.5);

  return 5000 + Math.ceil((text.length * 120) / effectiveRate);
}

export class PlaybackController {
  private readonly engine: SpeechEngine;
  private readonly sentences: readonly string[];
  private readonly callbacks: PlaybackCallbacks;
  private options: SpeakOptions;

  private state: PlaybackState = { status: "idle", index: 0 };
  /** Bumped by every user action; a stale run loop sees it and exits. */
  private generation = 0;

  constructor(
    engine: SpeechEngine,
    sentences: readonly string[],
    options: SpeakOptions,
    callbacks: PlaybackCallbacks = {},
  ) {
    this.engine = engine;
    this.sentences = sentences;
    this.options = { ...options };
    this.callbacks = callbacks;
  }

  getState(): PlaybackState {
    return this.state;
  }

  /** Rate/pitch/voice changes apply from the next spoken sentence. */
  setOptions(patch: Partial<SpeakOptions>): void {
    this.options = { ...this.options, ...patch };
  }

  /** Start from an explicit index, resume from pause/error, or restart. */
  play(fromIndex?: number): void {
    if (this.sentences.length === 0) {
      return;
    }

    const resumable =
      this.state.status === "paused" || this.state.status === "error";
    const start = Math.min(
      Math.max(fromIndex ?? (resumable ? this.state.index : 0), 0),
      this.sentences.length - 1,
    );

    const generation = ++this.generation;

    this.engine.cancel();
    void this.run(generation, start);
  }

  pause(): void {
    if (this.state.status !== "speaking") {
      return;
    }

    this.generation++;
    this.engine.cancel();
    this.setState({ status: "paused", index: this.state.index });
  }

  stop(): void {
    this.generation++;
    this.engine.cancel();
    this.setState({ status: "idle", index: 0 });
  }

  /** Step one sentence; keeps the paused/speaking mode it was in. */
  step(delta: 1 | -1): void {
    const target = Math.min(
      Math.max(this.state.index + delta, 0),
      this.sentences.length - 1,
    );

    if (this.state.status === "speaking") {
      this.play(target);

      return;
    }

    if (this.state.status === "paused" || this.state.status === "error") {
      this.setState({ status: "paused", index: target });
    }
  }

  private setState(state: PlaybackState): void {
    this.state = state;
    this.callbacks.onState?.(state);
  }

  private async run(generation: number, startIndex: number): Promise<void> {
    let index = startIndex;
    let failureStreak = 0;
    let lastError = "speech failed";

    while (index < this.sentences.length) {
      this.setState({ status: "speaking", index });
      this.callbacks.onSentence?.(index);

      const text = this.sentences[index];
      const next = this.sentences[index + 1] as string | undefined;
      let outcome: "ended" | "cancelled" | "failed";

      try {
        const speaking = this.speakWithWatchdog(text);

        // Hint after issuing the current sentence, so an engine that
        // queues work keeps this one first
        if (next !== undefined) {
          this.engine.prefetch?.(next, this.options);
        }

        // Sequential by design: exactly one sentence speaks at a time
        // eslint-disable-next-line no-await-in-loop
        const ended = await speaking;

        outcome = ended ? "ended" : "cancelled";
      } catch (error) {
        outcome = "failed";
        lastError = error instanceof Error ? error.message : String(error);
      }

      if (generation !== this.generation) {
        // Superseded by pause/stop/seek — that action owns the state now
        return;
      }

      if (outcome === "cancelled") {
        // Engine cancelled underneath us without a user action: treat as
        // a failure so a self-cancelling engine cannot spin the loop
        outcome = "failed";
        lastError = "utterance was cancelled by the engine";
      }

      if (outcome === "failed") {
        failureStreak++;

        if (failureStreak >= MAX_FAILURE_STREAK) {
          this.setState({ status: "error", index, errorMessage: lastError });

          return;
        }

        continue; // Retry the same sentence once
      }

      failureStreak = 0;
      index++;
    }

    this.setState({ status: "ended", index: this.sentences.length });
    this.callbacks.onComplete?.();
  }

  private speakWithWatchdog(text: string): Promise<boolean> {
    const budget = watchdogTimeoutMs(text, this.options.rate);

    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        // Settles the engine's pending speak(); its late resolution is
        // ignored because we've already rejected
        this.engine.cancel();
        reject(new Error("speech engine timed out"));
      }, budget);

      this.engine.speak(text, this.options).then(
        (ended) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(ended);
          }
        },
        (error: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
      );
    });
  }
}
