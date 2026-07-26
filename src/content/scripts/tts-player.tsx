import { isWorkPage, scrapeCurrentChapter } from "@src/common/ao3";
import {
  PlaybackController,
  type PlaybackState,
} from "@src/common/tts/playback-controller";
import {
  PiperSpeechEngine,
  PiperWorkerClient,
  type PiperAssets,
} from "@src/common/tts/piper-engine";
import { PIPER_VOICES, piperVoiceById } from "@src/common/tts/piper-protocol";
import {
  buildSentenceList,
  detectContentLocale,
  type TtsSentence,
} from "@src/common/tts/sentence-source";
import {
  migrateTtsSettings,
  TTS_OPEN_EVENT,
  TTS_PITCH_MAX,
  TTS_PITCH_MIN,
  TTS_RATE_MAX,
  TTS_RATE_MIN,
  TTS_SETTINGS_STORAGE_KEY,
  type TtsSettings,
} from "@src/common/tts/tts-settings";
import {
  loadVoices,
  pickDefaultVoice,
  toVoiceInfo,
  voiceKey,
  WebSpeechEngine,
  type TtsVoiceInfo,
} from "@src/common/tts/web-speech-engine";
import { localExtStorage } from "@webext-core/storage";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ContentScript } from "../content-script";
import { createShadowHost } from "../shadow-host";
import rtBaseStyles from "../styles/rt-base.css?inline";
import ttsPlayerStyles from "../styles/tts-player.css?inline";

const HIGHLIGHT_NAME = "toybox-tts-sentence";
const HIGHLIGHT_STYLE_ID = "toybox-tts-highlight-style";
const PREVIEW_SENTENCE = "This is how your reading voice sounds.";

/* ---------------------------------------------------------------- */
/* Sentence highlight + follow-along (page-facing, DOM-untouched)   */
/* ---------------------------------------------------------------- */

function supportsHighlights(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

/**
 * ::highlight() paints the spoken sentence without touching the author's
 * markup — work skins and reading-position anchors stay byte-identical.
 */
function ensureHighlightStyle(): void {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");

  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) {
  background-color: color-mix(in srgb, var(--ao3-accent-color, #990000) 28%, transparent);
}`;
  document.head.appendChild(style);
}

function setSentenceHighlight(range: Range | null): void {
  if (!supportsHighlights()) {
    return;
  }

  if (range) {
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
  } else {
    CSS.highlights.delete(HIGHLIGHT_NAME);
  }
}

/** Keep the spoken sentence in a comfortable band of the viewport. */
function scrollRangeIntoView(range: Range): void {
  const rect = range.getBoundingClientRect();

  if (rect.height === 0 && rect.width === 0) {
    return;
  }

  const upper = window.innerHeight * 0.15;
  const lower = window.innerHeight * 0.65;

  if (rect.top < upper || rect.bottom > lower) {
    window.scrollBy({
      top: rect.top - window.innerHeight * 0.3,
      behavior: "smooth",
    });
  }
}

/** Sentence index at a click point, for click-to-start-here. */
function sentenceIndexAtPoint(
  sentences: readonly TtsSentence[],
  x: number,
  y: number,
): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };

  let node: Node | null = null;
  let offset = 0;

  if (typeof doc.caretPositionFromPoint === "function") {
    const position = doc.caretPositionFromPoint(x, y);

    if (position) {
      node = position.offsetNode;
      offset = position.offset;
    }
    // Deprecated, but the only caret-from-point API Chrome <128 has
    // eslint-disable-next-line @typescript-eslint/no-deprecated
  } else if (typeof doc.caretRangeFromPoint === "function") {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const range = doc.caretRangeFromPoint(x, y);

    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }

  if (!node) {
    return null;
  }

  for (const [index, sentence] of sentences.entries()) {
    try {
      if (sentence.range?.isPointInRange(node, offset)) {
        return index;
      }
    } catch {
      // Detached or foreign-document node — not a sentence hit
      return null;
    }
  }

  return null;
}

/* ---------------------------------------------------------------- */
/* Icons                                                            */
/* ---------------------------------------------------------------- */

const icon = (path: string) => () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d={path} />
  </svg>
);

const ListenIcon = icon(
  "M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z",
);
const PlayIcon = icon("m7 4 13 8-13 8V4z");
const PauseIcon = icon("M7 4h3v16H7z M14 4h3v16h-3z");
const PrevIcon = icon("m17 4-9 8 9 8V4z M6 4v16");
const NextIcon = icon("m7 4 9 8-9 8V4z M18 4v16");
const GearIcon = icon(
  "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5A7 7 0 0 0 19 12z",
);
const CloseIcon = icon("M18 6 6 18 M6 6l12 12");

/* ---------------------------------------------------------------- */
/* Player UI                                                        */
/* ---------------------------------------------------------------- */

type SessionRefs = {
  controller: PlaybackController;
  engine: WebSpeechEngine | PiperSpeechEngine;
  sentences: TtsSentence[];
};

/** Download/storage state of the enhanced tier, owned by the player. */
type PiperState = {
  /** Voice ids present in this origin's storage; null = not queried. */
  stored: string[] | null;
  downloadingPct: number | null;
  error: string | null;
};

const SystemVoiceSection = ({
  noVoices,
  voices,
  prefs,
  updatePrefs,
}: {
  noVoices: boolean;
  voices: TtsVoiceInfo[] | null;
  prefs: TtsSettings;
  updatePrefs: (patch: Partial<TtsSettings>) => void;
}) => {
  if (noVoices) {
    return (
      <p class="tts-message">
        Your browser exposes no text-to-speech voices. Install system voices
        (Windows: Settings → Time &amp; Language → Speech; Android: system
        text-to-speech), then reload — or switch to the natural voice tier
        above.
      </p>
    );
  }

  if (voices === null) {
    return <p class="tts-message">Loading voices…</p>;
  }

  return (
    <>
      <label class="tts-field">
        <span class="tts-field-label">Voice</span>
        <select
          class="tts-select"
          value={prefs.voiceId ?? ""}
          onChange={(event) => {
            updatePrefs({
              voiceId: (event.target as HTMLSelectElement).value || null,
            });
          }}
        >
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name} ({voice.lang}){voice.local ? "" : " — online"}
            </option>
          ))}
        </select>
      </label>
      <label class="tts-field">
        <span class="tts-field-label">
          Pitch
          <span class="readout">{prefs.pitch.toFixed(1)}</span>
        </span>
        <input
          class="tts-slider"
          type="range"
          min={TTS_PITCH_MIN}
          max={TTS_PITCH_MAX}
          step={0.1}
          value={prefs.pitch}
          onInput={(event) => {
            updatePrefs({
              pitch: Number((event.target as HTMLInputElement).value),
            });
          }}
        />
      </label>
    </>
  );
};

const PiperVoiceSection = ({
  prefs,
  piper,
  updatePrefs,
  downloadVoice,
  removeVoice,
}: {
  prefs: TtsSettings;
  piper: PiperState;
  updatePrefs: (patch: Partial<TtsSettings>) => void;
  downloadVoice: () => void;
  removeVoice: () => void;
}) => {
  const voice = piperVoiceById(prefs.piperVoiceId) ?? PIPER_VOICES[0];
  const downloaded = piper.stored?.includes(voice.id) ?? false;
  const downloading = piper.downloadingPct !== null;

  return (
    <>
      <label class="tts-field">
        <span class="tts-field-label">Natural voice</span>
        <select
          class="tts-select"
          value={voice.id}
          disabled={downloading}
          onChange={(event) => {
            updatePrefs({
              piperVoiceId: (event.target as HTMLSelectElement).value,
            });
          }}
        >
          {PIPER_VOICES.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
              {piper.stored?.includes(candidate.id)
                ? " — downloaded"
                : ` — ${String(candidate.sizeMB)} MB download`}
            </option>
          ))}
        </select>
      </label>
      {piper.error && <p class="tts-message error">{piper.error}</p>}
      {downloading ? (
        <p class="tts-message">Downloading… {String(piper.downloadingPct)}%</p>
      ) : downloaded ? (
        <p class="tts-message">
          Stored in this browser and used offline from now on.{" "}
          <button class="tts-link-button" onClick={removeVoice}>
            Remove (frees ~{String(voice.sizeMB)} MB)
          </button>
        </p>
      ) : (
        <>
          <p class="tts-message">
            One-time {String(voice.sizeMB)} MB download from Hugging Face,
            stored locally in your browser. Nothing you read is ever sent
            anywhere — speech is generated on this device.
          </p>
          <button class="tts-preview" onClick={downloadVoice}>
            ⬇ Download voice ({String(voice.sizeMB)} MB)
          </button>
        </>
      )}
      {downloaded && (
        <p class="tts-message">
          Speed applies to natural voices; pitch is fixed.
        </p>
      )}
    </>
  );
};

const PlayerPopover = ({
  noVoices,
  playback,
  nextChapterHref,
  showSettings,
  voices,
  prefs,
  piper,
  updatePrefs,
  preview,
  downloadVoice,
  removeVoice,
}: {
  noVoices: boolean;
  playback: PlaybackState;
  nextChapterHref: string | null;
  showSettings: boolean;
  voices: TtsVoiceInfo[] | null;
  prefs: TtsSettings;
  piper: PiperState;
  updatePrefs: (patch: Partial<TtsSettings>) => void;
  preview: () => void;
  downloadVoice: () => void;
  removeVoice: () => void;
}) => (
  <div class="tts-popover" role="dialog" aria-label="Read aloud settings">
    {playback.status === "error" && (
      <p class="tts-message error">
        Speech stopped ({playback.errorMessage ?? "unknown error"}). Press play
        to resume from the same sentence.
      </p>
    )}
    {playback.status === "ended" && (
      <>
        <p class="tts-message">Finished reading this page.</p>
        {nextChapterHref && (
          <a class="tts-next-link" href={nextChapterHref}>
            Continue: Next Chapter →
          </a>
        )}
      </>
    )}
    {showSettings && (
      <>
        <h2 class="tts-popover-title">Listening</h2>
        <div class="tts-field">
          <span class="tts-field-label">Voice tier</span>
          <div class="tts-tier" role="group" aria-label="Voice tier">
            <button
              class={`tts-tier-btn${prefs.tier === "system" ? " active" : ""}`}
              aria-pressed={prefs.tier === "system"}
              onClick={() => {
                updatePrefs({ tier: "system" });
              }}
            >
              System
            </button>
            <button
              class={`tts-tier-btn${prefs.tier === "piper" ? " active" : ""}`}
              aria-pressed={prefs.tier === "piper"}
              onClick={() => {
                updatePrefs({ tier: "piper" });
              }}
            >
              Natural
            </button>
          </div>
        </div>
        {prefs.tier === "piper" ? (
          <PiperVoiceSection
            prefs={prefs}
            piper={piper}
            updatePrefs={updatePrefs}
            downloadVoice={downloadVoice}
            removeVoice={removeVoice}
          />
        ) : (
          <SystemVoiceSection
            noVoices={noVoices}
            voices={voices}
            prefs={prefs}
            updatePrefs={updatePrefs}
          />
        )}
        <label class="tts-field">
          <span class="tts-field-label">
            Speed
            <span class="readout">{prefs.rate.toFixed(1)}×</span>
          </span>
          <input
            class="tts-slider"
            type="range"
            min={TTS_RATE_MIN}
            max={TTS_RATE_MAX}
            step={0.1}
            value={prefs.rate}
            onInput={(event) => {
              updatePrefs({
                rate: Number((event.target as HTMLInputElement).value),
              });
            }}
          />
        </label>
        <label class="tts-check">
          <input
            type="checkbox"
            checked={prefs.highlightSentence}
            onChange={(event) => {
              updatePrefs({
                highlightSentence: (event.target as HTMLInputElement).checked,
              });
            }}
          />
          Highlight the spoken sentence
        </label>
        <label class="tts-check">
          <input
            type="checkbox"
            checked={prefs.autoScroll}
            onChange={(event) => {
              updatePrefs({
                autoScroll: (event.target as HTMLInputElement).checked,
              });
            }}
          />
          Follow along (auto-scroll)
        </label>
        <button
          class="tts-preview"
          // A natural voice can only be previewed once its model exists;
          // the download CTA sits directly above this button
          disabled={
            prefs.tier === "piper" &&
            !(piper.stored?.includes(prefs.piperVoiceId) ?? false)
          }
          onClick={preview}
        >
          ▶ Preview voice
        </button>
      </>
    )}
  </div>
);

const PlayerCluster = ({
  playback,
  cannotSpeak,
  total,
  showSettings,
  togglePlay,
  step,
  toggleSettings,
  closePlayer,
}: {
  playback: PlaybackState;
  cannotSpeak: boolean;
  total: number | null;
  showSettings: boolean;
  togglePlay: () => void;
  step: (delta: 1 | -1) => void;
  toggleSettings: () => void;
  closePlayer: () => void;
}) => {
  const speaking = playback.status === "speaking";
  const stepDisabled =
    cannotSpeak || playback.status === "idle" || playback.status === "ended";

  return (
    <div class="tts-cluster" role="group" aria-label="Read aloud player">
      <button
        class="tts-btn"
        aria-label="Previous sentence"
        title="Previous sentence"
        disabled={stepDisabled}
        onClick={() => {
          step(-1);
        }}
      >
        <PrevIcon />
      </button>
      <button
        class="tts-btn primary"
        aria-label={speaking ? "Pause" : "Play"}
        title={speaking ? "Pause" : "Read aloud from here"}
        disabled={cannotSpeak}
        onClick={togglePlay}
      >
        {speaking ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        class="tts-btn"
        aria-label="Next sentence"
        title="Next sentence"
        disabled={stepDisabled}
        onClick={() => {
          step(1);
        }}
      >
        <NextIcon />
      </button>
      {total !== null && playback.status !== "idle" && (
        <span class="tts-counter">
          {Math.min(playback.index + 1, total)} / {total}
        </span>
      )}
      <button
        class="tts-btn"
        aria-label="Voice settings"
        aria-expanded={showSettings}
        title="Voice settings"
        onClick={toggleSettings}
      >
        <GearIcon />
      </button>
      <button
        class="tts-btn"
        aria-label="Close reader"
        title="Stop and close"
        onClick={closePlayer}
      >
        <CloseIcon />
      </button>
    </div>
  );
};

const TtsPlayerUI = ({
  initialPrefs,
  piperAssets,
}: {
  initialPrefs: TtsSettings;
  piperAssets: PiperAssets;
}) => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [voices, setVoices] = useState<TtsVoiceInfo[] | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({
    status: "idle",
    index: 0,
  });
  const [followSuppressed, setFollowSuppressed] = useState(false);
  const [piper, setPiper] = useState<PiperState>({
    stored: null,
    downloadingPct: null,
    error: null,
  });

  const session = useRef<SessionRefs | null>(null);
  const piperClient = useRef<PiperWorkerClient | null>(null);
  const prefsRef = useRef(prefs);
  const suppressedRef = useRef(false);

  prefsRef.current = prefs;
  suppressedRef.current = followSuppressed;

  const ensurePiperClient = (): PiperWorkerClient => {
    piperClient.current ??= new PiperWorkerClient(piperAssets);

    return piperClient.current;
  };

  const nextChapterHref = useMemo(
    () =>
      document
        .querySelector("ul.work.navigation.actions li.chapter.next a")
        ?.getAttribute("href") ?? null,
    [],
  );

  const dropSession = () => {
    const active = session.current;

    if (!active) {
      return;
    }

    active.controller.stop();

    if (active.engine instanceof PiperSpeechEngine) {
      active.engine.dispose();
    }

    session.current = null;
    setSentenceHighlight(null);
    setPlayback({ status: "idle", index: 0 });
  };

  const updatePrefs = (patch: Partial<TtsSettings>) => {
    const next = { ...prefsRef.current, ...patch };

    prefsRef.current = next;
    setPrefs(next);
    void localExtStorage.setItem(TTS_SETTINGS_STORAGE_KEY, next);

    // Engine identity changes invalidate the session; everything else
    // hot-applies to the running controller
    if (
      patch.tier !== undefined ||
      (patch.piperVoiceId !== undefined && next.tier === "piper")
    ) {
      dropSession();
    } else {
      session.current?.controller.setOptions({
        rate: next.rate,
        pitch: next.pitch,
        voiceId: next.voiceId,
      });
    }

    if (patch.highlightSentence === false) {
      setSentenceHighlight(null);
    }
  };

  const ensureSession = (): SessionRefs => {
    if (session.current) {
      return session.current;
    }

    ensureHighlightStyle();

    const sentences = buildSentenceList(document, scrapeCurrentChapter());
    const usePiper =
      prefsRef.current.tier === "piper" &&
      (piper.stored?.includes(prefsRef.current.piperVoiceId) ?? false);
    const engine = usePiper
      ? new PiperSpeechEngine(
          ensurePiperClient(),
          prefsRef.current.piperVoiceId,
        )
      : new WebSpeechEngine(window.speechSynthesis);
    const controller = new PlaybackController(
      engine,
      sentences.map((sentence) => sentence.text),
      {
        rate: prefsRef.current.rate,
        pitch: prefsRef.current.pitch,
        voiceId: prefsRef.current.voiceId,
      },
      {
        onState(state) {
          setPlayback(state);

          if (state.status !== "speaking" && state.status !== "paused") {
            setSentenceHighlight(null);
          }
        },
        onSentence(index) {
          const sentence = sentences[index] as TtsSentence | undefined;
          const range = sentence?.range ?? null;

          setSentenceHighlight(
            prefsRef.current.highlightSentence ? range : null,
          );

          if (range && prefsRef.current.autoScroll && !suppressedRef.current) {
            scrollRangeIntoView(range);
          }
        },
      },
    );

    session.current = { controller, engine, sentences };

    return session.current;
  };

  // Voice inventory, loaded once the player is opened
  useEffect(() => {
    if (!open || voices !== null) {
      return;
    }

    void loadVoices(window.speechSynthesis).then((available) => {
      setVoices(available.map(toVoiceInfo));

      // Resolve the effective voice once: keep a still-installed saved
      // voice, otherwise fall back to the best match for the content
      if (available.length > 0) {
        const saved = prefsRef.current.voiceId;
        const stillThere = available.some((v) => voiceKey(v) === saved);

        if (!saved || !stillThere) {
          const workskin = document.querySelector("#workskin, #chapters");
          const lang = workskin ? detectContentLocale(workskin) : "en";
          const fallback = pickDefaultVoice(available, lang) ?? available[0];

          updatePrefs({ voiceId: voiceKey(fallback) });
        }
      }
    });
  }, [open, voices]);

  // Downloaded-voice inventory, queried once the player is opened
  useEffect(() => {
    if (!open || piper.stored !== null) {
      return;
    }

    ensurePiperClient()
      .request({ type: "stored" }, ["stored"])
      .then((response) => {
        if (response.type === "stored") {
          setPiper((previous) => ({ ...previous, stored: response.voices }));
        }
      })
      .catch(() => {
        // No OPFS / worker failure: tier still offered, download will
        // surface the real error
        setPiper((previous) => ({ ...previous, stored: [] }));
      });
  }, [open, piper.stored]);

  const downloadVoice = () => {
    const voiceId = prefsRef.current.piperVoiceId;
    const client = ensurePiperClient();

    dropSession();
    setPiper((previous) => ({ ...previous, downloadingPct: 0, error: null }));
    client.setProgressListener(({ loaded, total }) => {
      setPiper((previous) => ({
        ...previous,
        downloadingPct: total > 0 ? Math.round((loaded / total) * 100) : 0,
      }));
    });

    client
      .request({ type: "download", voiceId }, ["downloaded"])
      .then((response) => {
        if (response.type === "downloaded") {
          setPiper({
            stored: response.voices,
            downloadingPct: null,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        setPiper((previous) => ({
          ...previous,
          downloadingPct: null,
          error: `Download failed: ${error instanceof Error ? error.message : String(error)}`,
        }));
      })
      .finally(() => {
        client.setProgressListener(null);
      });
  };

  const removeVoice = () => {
    const voiceId = prefsRef.current.piperVoiceId;

    dropSession();
    ensurePiperClient()
      .request({ type: "remove", voiceId }, ["removed"])
      .then((response) => {
        if (response.type === "removed") {
          setPiper({
            stored: response.voices,
            downloadingPct: null,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        setPiper((previous) => ({
          ...previous,
          error: `Remove failed: ${error instanceof Error ? error.message : String(error)}`,
        }));
      });
  };

  // Warm the natural voice while the reader reaches for play: model
  // init costs seconds, so start it as soon as the player is open and
  // the downloaded voice is the active tier
  useEffect(() => {
    if (
      !open ||
      prefs.tier !== "piper" ||
      !(piper.stored?.includes(prefs.piperVoiceId) ?? false) ||
      session.current !== null ||
      piper.downloadingPct !== null
    ) {
      return;
    }

    const warmed = ensureSession();

    if (warmed.engine instanceof PiperSpeechEngine) {
      warmed.engine.warmUp();
    }
  }, [open, prefs.tier, prefs.piperVoiceId, piper]);

  // External open requests (the toolbar's Listen button)
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
    };

    document.addEventListener(TTS_OPEN_EVENT, onOpen);

    return () => {
      document.removeEventListener(TTS_OPEN_EVENT, onOpen);
    };
  }, []);

  // Manual scrolling yields follow-along until explicitly re-engaged
  useEffect(() => {
    if (playback.status !== "speaking") {
      return;
    }

    const suppress = () => {
      setFollowSuppressed(true);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ["PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"].includes(
          event.key,
        )
      ) {
        suppress();
      }
    };

    window.addEventListener("wheel", suppress, { passive: true });
    window.addEventListener("touchmove", suppress, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", suppress);
      window.removeEventListener("touchmove", suppress);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [playback.status]);

  // Click a sentence to start reading from it (highlight mode only)
  useEffect(() => {
    if (!open || !prefs.highlightSentence) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const { target } = event;

      if (
        !(target instanceof Element) ||
        !target.closest("#chapters") ||
        target.closest("a, button, input, select, textarea")
      ) {
        return;
      }

      if (!(window.getSelection()?.isCollapsed ?? true)) {
        return;
      }

      const active = session.current ?? ensureSession();
      const index = sentenceIndexAtPoint(
        active.sentences,
        event.clientX,
        event.clientY,
      );

      if (index !== null) {
        setFollowSuppressed(false);
        active.controller.play(index);
      }
    };

    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [open, prefs.highlightSentence]);

  // Leaving the page mid-session: silence the engine
  useEffect(() => {
    const onPageHide = () => {
      session.current?.controller.stop();
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  const togglePlay = () => {
    const active = ensureSession();

    if (playback.status === "speaking") {
      active.controller.pause();
    } else {
      setFollowSuppressed(false);
      active.controller.play();
    }
  };

  const closePlayer = () => {
    session.current?.controller.stop();
    setSentenceHighlight(null);
    setShowSettings(false);
    setOpen(false);
  };

  const preview = () => {
    const active = ensureSession();

    if (playback.status === "speaking") {
      active.controller.pause();
    }

    void active.engine.speak(PREVIEW_SENTENCE, {
      rate: prefsRef.current.rate,
      pitch: prefsRef.current.pitch,
      voiceId: prefsRef.current.voiceId,
    });
  };

  const refollow = () => {
    setFollowSuppressed(false);

    const sentence = session.current?.sentences[playback.index];

    if (sentence?.range) {
      scrollRangeIntoView(sentence.range);
    }
  };

  if (!open) {
    return (
      <button
        class="tts-fab"
        aria-label="Read aloud"
        title="Read this work aloud"
        onClick={() => {
          setOpen(true);
        }}
      >
        <ListenIcon />
      </button>
    );
  }

  const noVoices = voices !== null && voices.length === 0;
  const piperReady = piper.stored?.includes(prefs.piperVoiceId) ?? false;
  // The natural tier speaks without any system voice; system-tier
  // playback needs the browser to expose at least one
  const cannotSpeak = noVoices && !(prefs.tier === "piper" && piperReady);
  const popoverOpen =
    showSettings ||
    cannotSpeak ||
    playback.status === "error" ||
    playback.status === "ended";

  return (
    <div style="position: relative;">
      {followSuppressed && playback.status === "speaking" && (
        <button class="tts-follow-chip" onClick={refollow}>
          ↓ Jump to spoken text
        </button>
      )}
      {popoverOpen && (
        <PlayerPopover
          noVoices={noVoices}
          playback={playback}
          nextChapterHref={nextChapterHref}
          showSettings={showSettings || cannotSpeak}
          voices={voices}
          prefs={prefs}
          piper={piper}
          updatePrefs={updatePrefs}
          preview={preview}
          downloadVoice={downloadVoice}
          removeVoice={removeVoice}
        />
      )}
      <PlayerCluster
        playback={playback}
        cannotSpeak={cannotSpeak}
        total={session.current?.sentences.length ?? null}
        showSettings={showSettings}
        togglePlay={togglePlay}
        step={(delta) => session.current?.controller.step(delta)}
        toggleSettings={() => {
          setShowSettings((previous) => !previous);
        }}
        closePlayer={closePlayer}
      />
    </div>
  );
};

/* ---------------------------------------------------------------- */
/* Content script                                                   */
/* ---------------------------------------------------------------- */

export default class TtsPlayer extends ContentScript {
  getEnabled(): boolean {
    return (
      this.settings.enableTts &&
      isWorkPage() &&
      typeof window.speechSynthesis !== "undefined"
    );
  }

  async onProcess(): Promise<void> {
    if (document.querySelector("[data-toybox-tts-player]")) {
      return;
    }

    const saved: unknown = await localExtStorage
      .getItem(TTS_SETTINGS_STORAGE_KEY)
      .catch(() => null);

    const { host, root } = createShadowHost({
      css: `${rtBaseStyles}\n${ttsPlayerStyles}`,
      // Sits beside the reading-settings FAB corner; its own host so the
      // player works with the reader panel disabled
      hostStyle:
        "position: fixed; bottom: 20px; right: 64px; z-index: 2147483646;",
    });

    host.dataset.toyboxTtsPlayer = "true";
    root.classList.add("tts-root");

    // Packaged pieces of the enhanced tier, resolved here so the engine
    // and worker stay extension-API-free
    const api = typeof chrome === "undefined" ? browser : chrome;
    const piperAssets: PiperAssets = {
      workerJs: api.runtime.getURL("content/tts-piper-worker.js"),
      ortGlueMjs: api.runtime.getURL("tts/ort-wasm-simd-threaded.jsep.mjs"),
      ortWasm: api.runtime.getURL("tts/ort-wasm-simd-threaded.jsep.wasm"),
      piperData: api.runtime.getURL("tts/piper_phonemize.data"),
      piperWasm: api.runtime.getURL("tts/piper_phonemize.wasm"),
    };

    render(
      <TtsPlayerUI
        initialPrefs={migrateTtsSettings(saved)}
        piperAssets={piperAssets}
      />,
      root,
    );

    this.logger.log("Read-aloud player mounted");
  }
}
