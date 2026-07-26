// Read-aloud preferences: per-reader ergonomics with high write
// frequency, stored as their own localExtStorage blob exactly like
// reading-settings. The single enableTts gate lives in settings-schema so
// the popup/options can toggle the whole feature.

export type TtsVoiceTier = "system" | "piper";

export type TtsSettings = {
  /** Which engine speaks: browser voices or the downloaded Piper voice. */
  tier: TtsVoiceTier;
  /** Web-speech voice key (name|lang); null = best available default. */
  voiceId: string | null;
  /** Curated Piper voice id (see piper-protocol PIPER_VOICES). */
  piperVoiceId: string;
  rate: number;
  pitch: number;
  highlightSentence: boolean;
  autoScroll: boolean;
};

export const TTS_SETTINGS_STORAGE_KEY = "reader_toybox_tts_settings";

/** Document event other scripts dispatch to open the read-aloud player. */
export const TTS_OPEN_EVENT = "toybox-tts-open";

export const TTS_RATE_MIN = 0.5;
export const TTS_RATE_MAX = 3;
export const TTS_PITCH_MIN = 0.5;
export const TTS_PITCH_MAX = 2;

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  tier: "system",
  voiceId: null,
  piperVoiceId: "en_US-hfc_female-medium",
  rate: 1,
  pitch: 1,
  highlightSentence: true,
  autoScroll: true,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converts whatever is in storage into the settings shape: partial
 * shapes keep their valid fields, numbers clamp into range, garbage
 * returns defaults.
 */
export function migrateTtsSettings(saved: unknown): TtsSettings {
  if (!saved || typeof saved !== "object") {
    return { ...DEFAULT_TTS_SETTINGS };
  }

  const record = saved as Record<string, unknown>;
  const settings: TtsSettings = { ...DEFAULT_TTS_SETTINGS };

  if (record.tier === "system" || record.tier === "piper") {
    settings.tier = record.tier;
  }

  if (typeof record.voiceId === "string" && record.voiceId !== "") {
    settings.voiceId = record.voiceId;
  }

  if (typeof record.piperVoiceId === "string" && record.piperVoiceId !== "") {
    settings.piperVoiceId = record.piperVoiceId;
  }

  if (typeof record.rate === "number" && Number.isFinite(record.rate)) {
    settings.rate = clamp(record.rate, TTS_RATE_MIN, TTS_RATE_MAX);
  }

  if (typeof record.pitch === "number" && Number.isFinite(record.pitch)) {
    settings.pitch = clamp(record.pitch, TTS_PITCH_MIN, TTS_PITCH_MAX);
  }

  if (typeof record.highlightSentence === "boolean") {
    settings.highlightSentence = record.highlightSentence;
  }

  if (typeof record.autoScroll === "boolean") {
    settings.autoScroll = record.autoScroll;
  }

  return settings;
}
