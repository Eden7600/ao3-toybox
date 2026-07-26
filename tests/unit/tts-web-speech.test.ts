import {
  DEFAULT_TTS_SETTINGS,
  migrateTtsSettings,
} from "@src/common/tts/tts-settings";
import {
  loadVoices,
  pickDefaultVoice,
  voiceKey,
} from "@src/common/tts/web-speech-engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeVoice(
  name: string,
  lang: string,
  options: { local?: boolean; isDefault?: boolean } = {},
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    localService: options.local ?? true,
    default: options.isDefault ?? false,
    voiceURI: name,
  };
}

type Listener = () => void;

function fakeSynth(initial: SpeechSynthesisVoice[]) {
  let voices = initial;
  const listeners = new Set<Listener>();

  const populate = (next: SpeechSynthesisVoice[]) => {
    voices = next;
    listeners.forEach((fn) => {
      fn();
    });
  };

  return {
    synth: {
      getVoices: () => voices,
      addEventListener: (_: string, fn: Listener) => listeners.add(fn),
      removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
    } as unknown as SpeechSynthesis,
    populate,
  };
}

describe("loadVoices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately when voices are already populated", async () => {
    const { synth } = fakeSynth([fakeVoice("Alice", "en-US")]);

    await expect(loadVoices(synth)).resolves.toHaveLength(1);
  });

  it("waits for voiceschanged when the first read is empty", async () => {
    const { synth, populate } = fakeSynth([]);
    const pending = loadVoices(synth);

    populate([fakeVoice("Bob", "en-GB")]);

    await expect(pending).resolves.toHaveLength(1);
  });

  it("settles with an empty list after the settle window", async () => {
    const { synth } = fakeSynth([]);
    const pending = loadVoices(synth, 500);

    await vi.advanceTimersByTimeAsync(600);
    await expect(pending).resolves.toEqual([]);
  });
});

describe("pickDefaultVoice", () => {
  it("prefers local voices for the content language, then platform default", () => {
    const network = fakeVoice("Google US", "en-US", { local: false });
    const local = fakeVoice("Zira", "en-US");
    const localDefault = fakeVoice("David", "en-GB", { isDefault: true });
    const french = fakeVoice("Amelie", "fr-FR");

    expect(
      pickDefaultVoice([network, local, localDefault, french], "en")?.name,
    ).toBe("David");
    expect(pickDefaultVoice([network, local, french], "en-US")?.name).toBe(
      "Zira",
    );
    expect(pickDefaultVoice([french], "en")).toBeNull();
  });
});

describe("voiceKey", () => {
  it("is stable across sessions for the same voice", () => {
    expect(voiceKey(fakeVoice("Zira", "en-US"))).toBe("Zira|en-US");
  });
});

describe("migrateTtsSettings", () => {
  it("returns defaults for garbage", () => {
    expect(migrateTtsSettings(null)).toEqual(DEFAULT_TTS_SETTINGS);
    expect(migrateTtsSettings("nope")).toEqual(DEFAULT_TTS_SETTINGS);
  });

  it("keeps valid fields and clamps numbers into range", () => {
    const migrated = migrateTtsSettings({
      voiceId: "Zira|en-US",
      rate: 99,
      pitch: 0,
      highlightSentence: false,
      autoScroll: "yes",
    });

    expect(migrated).toEqual({
      tier: "system",
      voiceId: "Zira|en-US",
      piperVoiceId: "en_US-hfc_female-medium",
      rate: 3,
      pitch: 0.5,
      highlightSentence: false,
      autoScroll: true,
      autoContinue: false,
    });
  });

  it("keeps a saved autoContinue preference", () => {
    expect(migrateTtsSettings({ autoContinue: true }).autoContinue).toBe(true);
  });

  it("keeps a valid tier and piper voice, rejects unknown tiers", () => {
    expect(
      migrateTtsSettings({ tier: "piper", piperVoiceId: "en_GB-alba-medium" }),
    ).toMatchObject({ tier: "piper", piperVoiceId: "en_GB-alba-medium" });
    expect(migrateTtsSettings({ tier: "cloud" }).tier).toBe("system");
  });

  it("falls back to the default voice when a saved voice leaves the list", () => {
    expect(
      migrateTtsSettings({ piperVoiceId: "en_US-ryan-high" }),
    ).toMatchObject({ piperVoiceId: "en_US-hfc_female-medium" });
  });
});
