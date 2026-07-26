import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ContentScript } from "../content-script";

import ArrowUpIcon from "../components/arrow-up-icon";
import CloseIcon from "../components/close-icon";
import SettingsIcon from "../components/settings-icon";

import {
  buildReadingCss,
  DEFAULT_READING_SETTINGS,
  markSpacerParagraphs,
  migrateReadingSettings,
  READING_FONT_FAMILY_GROUP,
  READING_SETTINGS_STORAGE_KEY,
  READING_SLIDERS,
  READING_TEXT_ALIGN_GROUP,
  type ReadingSettings,
} from "@src/common/reading-settings";
import { localExtStorage } from "@webext-core/storage";
import SliderRow from "../components/slider-row";
import ToggleGroup from "../components/toggle-group";
import { DOCK_ORDER, dockCornerHost } from "../corner-dock";
import { createShadowHost } from "../shadow-host";
import rtBaseStyles from "../styles/rt-base.css?inline";
import workSettingsStyles from "../styles/work-settings.css?inline";

const READING_STYLE_ID = "reader-toybox-reading-styles";

/**
 * Applies reading settings to the work via a single stylesheet in
 * document.head. All-default settings produce no CSS, so the element is
 * removed entirely and the page reverts to native AO3 rendering.
 */
function applyReadingStyles(settings: ReadingSettings): void {
  const css = buildReadingCss(settings);
  let styleEl = document.getElementById(READING_STYLE_ID);

  if (!css) {
    styleEl?.remove();

    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = READING_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = css;
}

const SettingsPanel = ({
  settings,
  onUpdate,
  onReset,
  onClose,
}: {
  settings: ReadingSettings;
  onUpdate: (patch: Partial<ReadingSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}) => (
  <div class="rt-panel" role="dialog" aria-label="Reading settings">
    <div class="rt-panel-header">
      <h2 class="rt-panel-title">Reading Settings</h2>
      <button
        class="rt-icon-button"
        aria-label="Close reading settings"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </div>
    <div class="rt-panel-body">
      <ToggleGroup
        group={READING_FONT_FAMILY_GROUP}
        value={settings.fontFamily}
        onChange={(value) => {
          onUpdate({ fontFamily: value as ReadingSettings["fontFamily"] });
        }}
      />
      <ToggleGroup
        group={READING_TEXT_ALIGN_GROUP}
        value={settings.textAlign ?? "default"}
        onChange={(value) => {
          onUpdate({
            textAlign:
              value === "default"
                ? null
                : (value as ReadingSettings["textAlign"]),
          });
        }}
      />
      {READING_SLIDERS.map((config) => (
        <SliderRow
          key={config.key}
          config={config}
          value={settings[config.key]}
          onChange={(value) => {
            onUpdate({ [config.key]: value });
          }}
        />
      ))}
      <div class="rt-setting">
        <label class="rt-toggle">
          <input
            type="checkbox"
            class="rt-sr-only"
            checked={settings.standardizeLineBreaks}
            onChange={(event) => {
              onUpdate({
                standardizeLineBreaks: (event.target as HTMLInputElement)
                  .checked,
              });
            }}
          />
          <span class="rt-toggle-track" aria-hidden="true" />
          <span class="rt-toggle-label">Standardize line breaks</span>
        </label>
        <p class="rt-setting-hint">
          Hides empty spacer paragraphs some authors add between paragraphs.
        </p>
      </div>
    </div>
    <div class="rt-panel-footer">
      <button class="rt-reset-button" onClick={onReset}>
        Reset to Defaults
      </button>
    </div>
  </div>
);

const ReadingSettingsUI = ({
  host,
  initialSettings,
  showReturnToTop,
}: {
  host: HTMLElement;
  initialSettings: ReadingSettings;
  showReturnToTop: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<ReadingSettings>(initialSettings);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const spacersMarked = useRef(false);

  useEffect(() => {
    // Marking is a one-time, invisible DOM pass; visibility of the marked
    // paragraphs is controlled entirely by the generated stylesheet.
    if (settings.standardizeLineBreaks && !spacersMarked.current) {
      markSpacerParagraphs(document);
      spacersMarked.current = true;
    }

    applyReadingStyles(settings);
  }, [settings]);

  const persist = (next: ReadingSettings) => {
    setSettings(next);
    void localExtStorage.setItem(READING_SETTINGS_STORAGE_KEY, next);
  };

  const closeAndRefocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAndRefocus();
      }
    };

    // ComposedPath (rather than event.target) sees through the shadow
    // boundary, so presses on the trigger or inside the panel are excluded.
    const onPointerDown = (event: PointerEvent) => {
      if (!event.composedPath().includes(host)) {
        closeAndRefocus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, host]);

  const settingsTrigger = (
    <button
      ref={triggerRef}
      class="rt-fab"
      aria-label="Reading settings"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      title="Customize your reading experience"
      onClick={() => {
        setIsOpen((prev) => !prev);
      }}
    >
      <SettingsIcon />
    </button>
  );

  return (
    <>
      {showReturnToTop ? (
        <div class="rt-fab-stack">
          <button
            class="rt-fab"
            aria-label="Return to top"
            title="Return to top"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <ArrowUpIcon />
          </button>
          {settingsTrigger}
        </div>
      ) : (
        settingsTrigger
      )}
      {isOpen && (
        <SettingsPanel
          settings={settings}
          onUpdate={(patch) => {
            persist({ ...settings, ...patch });
          }}
          onReset={() => {
            persist(DEFAULT_READING_SETTINGS);
          }}
          onClose={closeAndRefocus}
        />
      )}
    </>
  );
};

export default class WorkSettings extends ContentScript {
  getEnabled(): boolean {
    const isWorkPage = /\/works\/\d+/.test(window.location.pathname);

    return this.settings.enableReaderSettings && isWorkPage;
  }

  async onProcess(): Promise<void> {
    const saved: unknown = await localExtStorage
      .getItem(READING_SETTINGS_STORAGE_KEY)
      .catch(() => null);
    const initialSettings = migrateReadingSettings(saved);

    const { host, root } = createShadowHost({
      css: `${rtBaseStyles}\n${workSettingsStyles}`,
    });

    dockCornerHost(host, DOCK_ORDER.readingSettings);

    render(
      <ReadingSettingsUI
        host={host}
        initialSettings={initialSettings}
        showReturnToTop={this.settings.showReturnToTopButton}
      />,
      root,
    );
  }
}
