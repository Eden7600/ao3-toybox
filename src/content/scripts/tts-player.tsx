import { isWorkPage, scrapeCurrentChapter } from "@src/common/ao3";
import {
  PlaybackController,
  type PlaybackState,
} from "@src/common/tts/playback-controller";
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
  engine: WebSpeechEngine;
  sentences: TtsSentence[];
};

const PlayerPopover = ({
  noVoices,
  playback,
  nextChapterHref,
  showSettings,
  voices,
  prefs,
  updatePrefs,
  preview,
}: {
  noVoices: boolean;
  playback: PlaybackState;
  nextChapterHref: string | null;
  showSettings: boolean;
  voices: TtsVoiceInfo[] | null;
  prefs: TtsSettings;
  updatePrefs: (patch: Partial<TtsSettings>) => void;
  preview: () => void;
}) => (
  <div class="tts-popover" role="dialog" aria-label="Read aloud settings">
    {noVoices ? (
      <>
        <h2 class="tts-popover-title">No voices available</h2>
        <p class="tts-message">
          Your browser exposes no text-to-speech voices. Install system voices
          (Windows: Settings → Time &amp; Language → Speech; Android: system
          text-to-speech), then reload this page.
        </p>
      </>
    ) : (
      <>
        {playback.status === "error" && (
          <p class="tts-message error">
            Speech stopped ({playback.errorMessage ?? "unknown error"}). Press
            play to resume from the same sentence.
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
        {showSettings && voices !== null && (
          <>
            <h2 class="tts-popover-title">Listening</h2>
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
            <label class="tts-check">
              <input
                type="checkbox"
                checked={prefs.highlightSentence}
                onChange={(event) => {
                  updatePrefs({
                    highlightSentence: (event.target as HTMLInputElement)
                      .checked,
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
            <button class="tts-preview" onClick={preview}>
              ▶ Preview voice
            </button>
          </>
        )}
      </>
    )}
  </div>
);

const TtsPlayerUI = ({ initialPrefs }: { initialPrefs: TtsSettings }) => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [voices, setVoices] = useState<TtsVoiceInfo[] | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({
    status: "idle",
    index: 0,
  });
  const [followSuppressed, setFollowSuppressed] = useState(false);

  const session = useRef<SessionRefs | null>(null);
  const prefsRef = useRef(prefs);
  const suppressedRef = useRef(false);

  prefsRef.current = prefs;
  suppressedRef.current = followSuppressed;

  const nextChapterHref = useMemo(
    () =>
      document
        .querySelector("ul.work.navigation.actions li.chapter.next a")
        ?.getAttribute("href") ?? null,
    [],
  );

  const updatePrefs = (patch: Partial<TtsSettings>) => {
    const next = { ...prefsRef.current, ...patch };

    prefsRef.current = next;
    setPrefs(next);
    void localExtStorage.setItem(TTS_SETTINGS_STORAGE_KEY, next);
    session.current?.controller.setOptions({
      rate: next.rate,
      pitch: next.pitch,
      voiceId: next.voiceId,
    });

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
    const engine = new WebSpeechEngine(window.speechSynthesis);
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
  const total = session.current?.sentences.length ?? null;
  const speaking = playback.status === "speaking";
  const ended = playback.status === "ended";

  return (
    <div style="position: relative;">
      {followSuppressed && speaking && (
        <button class="tts-follow-chip" onClick={refollow}>
          ↓ Jump to spoken text
        </button>
      )}
      {(showSettings || noVoices || playback.status === "error" || ended) && (
        <PlayerPopover
          noVoices={noVoices}
          playback={playback}
          nextChapterHref={nextChapterHref}
          showSettings={showSettings}
          voices={voices}
          prefs={prefs}
          updatePrefs={updatePrefs}
          preview={preview}
        />
      )}
      <div class="tts-cluster" role="group" aria-label="Read aloud player">
        <button
          class="tts-btn"
          aria-label="Previous sentence"
          title="Previous sentence"
          disabled={noVoices || playback.status === "idle" || ended}
          onClick={() => session.current?.controller.step(-1)}
        >
          <PrevIcon />
        </button>
        <button
          class="tts-btn primary"
          aria-label={speaking ? "Pause" : "Play"}
          title={speaking ? "Pause" : "Read aloud from here"}
          disabled={noVoices}
          onClick={togglePlay}
        >
          {speaking ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          class="tts-btn"
          aria-label="Next sentence"
          title="Next sentence"
          disabled={noVoices || playback.status === "idle" || ended}
          onClick={() => session.current?.controller.step(1)}
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
          onClick={() => {
            setShowSettings((previous) => !previous);
          }}
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

    render(<TtsPlayerUI initialPrefs={migrateTtsSettings(saved)} />, root);

    this.logger.log("Read-aloud player mounted");
  }
}
