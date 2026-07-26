// Baseline speech tier: the browser's own speechSynthesis voices. One
// utterance per sentence (the controller's contract) sidesteps the
// engines' long-utterance cutoffs and makes pause/resume exact via
// cancel-and-reissue — engine pause() is deliberately never used because
// its behavior differs per platform.

import type { SpeakOptions, SpeechEngine } from "./playback-controller";

export type TtsVoiceInfo = {
  /** Stable key persisted in settings. */
  id: string;
  name: string;
  lang: string;
  /** False for network voices (Chrome's Google voices) — online-only. */
  local: boolean;
  default: boolean;
};

export function voiceKey(voice: SpeechSynthesisVoice): string {
  return `${voice.name}|${voice.lang}`;
}

export function toVoiceInfo(voice: SpeechSynthesisVoice): TtsVoiceInfo {
  return {
    id: voiceKey(voice),
    name: voice.name,
    lang: voice.lang,
    local: voice.localService,
    default: voice.default,
  };
}

/**
 * Voice inventory with the async-population dance: getVoices() is often
 * empty until voiceschanged fires (Chrome), so an empty first read waits
 * for the event or the settle window before concluding "no voices".
 */
export function loadVoices(
  synth: SpeechSynthesis,
  settleMs = 1500,
): Promise<SpeechSynthesisVoice[]> {
  const immediate = synth.getVoices();

  if (immediate.length > 0) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) {
        return;
      }

      done = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    };

    synth.addEventListener("voiceschanged", finish);
    setTimeout(finish, settleMs);
  });
}

/**
 * Default voice for a content language: local voices strongly preferred
 * (network voices die offline), the platform default wins ties, then
 * alphabetical stability. Null when nothing matches the language at all —
 * callers fall back to the first available voice.
 */
export function pickDefaultVoice(
  voices: readonly SpeechSynthesisVoice[],
  contentLang: string,
): SpeechSynthesisVoice | null {
  const base = contentLang.toLowerCase().split("-")[0];
  const candidates = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(base),
  );

  if (candidates.length === 0) {
    return null;
  }

  const score = (voice: SpeechSynthesisVoice) =>
    (voice.localService ? 2 : 0) + (voice.default ? 1 : 0);

  return [...candidates].sort(
    (a, b) => score(b) - score(a) || a.name.localeCompare(b.name),
  )[0];
}

export class WebSpeechEngine implements SpeechEngine {
  private readonly synth: SpeechSynthesis;
  /** Settles the in-flight speak() when cancel() gets no engine event. */
  private settleActive: ((ended: boolean) => void) | null = null;

  constructor(synth: SpeechSynthesis) {
    this.synth = synth;
  }

  speak(text: string, options: SpeakOptions): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.rate = options.rate;
      utterance.pitch = options.pitch;

      if (options.voiceId) {
        const voice = this.synth
          .getVoices()
          .find((candidate) => voiceKey(candidate) === options.voiceId);

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
      }

      const settle = (ended: boolean) => {
        if (this.settleActive === settle) {
          this.settleActive = null;
        }

        resolve(ended);
      };

      utterance.onend = () => {
        settle(true);
      };

      utterance.onerror = (event) => {
        if (this.settleActive === settle) {
          this.settleActive = null;
        }

        // Cancellation surfaces as an error event on most engines; it is
        // an expected outcome, not a failure
        if (event.error === "canceled" || event.error === "interrupted") {
          resolve(false);
        } else {
          reject(new Error(`speech error: ${event.error}`));
        }
      };

      this.settleActive = settle;
      this.synth.speak(utterance);
    });
  }

  cancel(): void {
    // Some engines fire no event at all for cancelled utterances — settle
    // the pending promise ourselves first, then any late event is a no-op
    const settle = this.settleActive;

    this.settleActive = null;
    this.synth.cancel();
    settle?.(false);
  }
}
