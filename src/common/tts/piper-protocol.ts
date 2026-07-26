// Shared contract between the piper worker (page-origin blob worker)
// and the content-side engine. Pure types + the curated voice list —
// no runtime dependencies, so both bundles and tests import it freely.

/** Curated Piper voices offered in the picker. Sizes verified against
 *  the Hugging Face repo; stated to the user before download. */
export type PiperVoice = {
  /** Piper-tts-web VoiceId. */
  id: string;
  label: string;
  lang: string;
  sizeMB: number;
};

export const PIPER_VOICES: PiperVoice[] = [
  {
    id: "en_US-hfc_female-medium",
    label: "Hazel — US English, female",
    lang: "en-US",
    sizeMB: 60,
  },
  {
    id: "en_US-lessac-medium",
    label: "Lessac — US English, female",
    lang: "en-US",
    sizeMB: 60,
  },
  {
    id: "en_GB-alba-medium",
    label: "Alba — British English, female",
    lang: "en-GB",
    sizeMB: 60,
  },
  {
    id: "en_US-hfc_male-medium",
    label: "Cole — US English, male",
    lang: "en-US",
    sizeMB: 60,
  },
  {
    id: "en_US-joe-medium",
    label: "Joe — US English, male",
    lang: "en-US",
    sizeMB: 60,
  },
  {
    id: "en_GB-northern_english_male-medium",
    label: "Arthur — Northern English, male",
    lang: "en-GB",
    sizeMB: 60,
  },
  // Low-quality tier: same download size, but 16 kHz synthesis needs
  // roughly a quarter less compute — for devices that can't keep up
  // with the medium voices (no English x_low models exist upstream)
  {
    id: "en_US-amy-low",
    label: "Amy — US English, female (faster, lower quality)",
    lang: "en-US",
    sizeMB: 60,
  },
  {
    id: "en_US-danny-low",
    label: "Danny — US English, male (faster, lower quality)",
    lang: "en-US",
    sizeMB: 60,
  },
];

export function piperVoiceById(id: string): PiperVoice | null {
  return PIPER_VOICES.find((voice) => voice.id === id) ?? null;
}

/**
 * Asset locations resolved on the content side (extension URLs / blob
 * URLs) and handed to the worker, which has no extension APIs. The ORT
 * glue module travels as a blob URL because a page-origin worker cannot
 * module-import a chrome-extension:// URL; ORT accepts the {mjs, wasm}
 * object form of wasmPaths verbatim through piper's onnxWasm field.
 */
export type PiperWasmPaths = {
  onnxWasm: { mjs: string; wasm: string };
  piperData: string;
  piperWasm: string;
};

export type PiperWorkerRequest =
  | { type: "init"; voiceId: string; wasmPaths: PiperWasmPaths }
  | { type: "synthesize"; id: number; text: string }
  | { type: "download"; voiceId: string }
  | { type: "remove"; voiceId: string }
  | { type: "stored" };

export type PiperWorkerResponse =
  | { type: "boot" }
  | { type: "ready" }
  | { type: "progress"; loaded: number; total: number }
  | { type: "audio"; id: number; buffer: ArrayBuffer }
  | { type: "stored"; voices: string[] }
  | { type: "downloaded"; voices: string[] }
  | { type: "removed"; voices: string[] }
  | { type: "error"; context: string; error: string };
