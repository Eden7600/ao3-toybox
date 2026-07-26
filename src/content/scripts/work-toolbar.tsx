import {
  AO3_WORK_NAVIGATION_SELECTOR,
  extractWorkIdFromUrl,
  isWorkPage,
  scrapeCurrentChapter,
} from "@src/common/ao3";
import type { Logger } from "@src/common/logger";
import { workStatusService } from "@src/common/services/work-status-service";
import type { Settings } from "@src/common/settings";
import type { ValueStore } from "@src/common/value-store";
import { createValueStore } from "@src/common/value-store";
import {
  hasFreshChapters,
  parseChapterCount,
  workPageProgress,
  type WorkPageProgress,
} from "@src/common/work-status";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ContentScript } from "../content-script";
import {
  toolbarBadgeFor,
  ToolbarIcon,
  toolbarIconIdFor,
  toolbarShortLabelFor,
} from "../toolbar-icons";
import {
  collectFeedbackActions,
  collectNativeActions,
  type NativeAction,
} from "../native-actions";
import { createShadowHost } from "../shadow-host";
import rtBaseStyles from "../styles/rt-base.css?inline";
import workToolbarStyles from "../styles/work-toolbar.css?inline";

// Extension-section state is shared between the top and bottom toolbar
// instances (separate render roots), so it lives in stores, not useState
function useValueStore<T>(store: ValueStore<T>): T {
  const [value, setValue] = useState(store.get());

  useEffect(() => store.subscribe(setValue), [store]);

  return value;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Compact-mode face of a control: universally recognizable actions
 * collapse to an icon (comment counts survive as a small badge),
 * chapter navigation shortens to "Next"/"Previous", everything else
 * keeps its text.
 */
const ActionFace = ({
  label,
  compact,
}: {
  label: string;
  compact: boolean;
}) => {
  const iconId = compact ? toolbarIconIdFor(label) : null;

  if (!iconId) {
    return <>{(compact ? toolbarShortLabelFor(label) : null) ?? label}</>;
  }

  const badge = toolbarBadgeFor(label);

  return (
    <>
      <ToolbarIcon id={iconId} />
      {badge !== null && <span class="rt-toolbar-badge">{badge}</span>}
    </>
  );
};

/** Compacted buttons carry the full label in title/aria-label. */
function compactAttrs(label: string, compact: boolean) {
  const iconified = compact && toolbarIconIdFor(label) !== null;
  const shortened =
    compact && !iconified && toolbarShortLabelFor(label) !== null;

  return {
    class: `rt-toolbar-btn${iconified ? " rt-icon-only" : ""}`,
    title: iconified || shortened ? label : undefined,
    "aria-label": iconified ? label : undefined,
  };
}

/**
 * One adopted native control. Anchors keep their real href so middle/ctrl
 * click and copy-link work, but a plain left click activates the ORIGINAL
 * element so AO3's JS behaviors (share modal, inline comments, AJAX
 * forms) run exactly as before.
 */
const NativeActionButton = ({
  action,
  compact,
}: {
  action: NativeAction;
  compact: boolean;
}) => {
  if (action.kind === "menu") {
    return <NativeMenu action={action} compact={compact} />;
  }

  if (action.href) {
    return (
      <a
        {...compactAttrs(action.label, compact)}
        href={action.href}
        onClick={(event) => {
          if (isPlainLeftClick(event)) {
            event.preventDefault();
            action.activate();
          }
        }}
      >
        <ActionFace label={action.label} compact={compact} />
      </a>
    );
  }

  return (
    <button {...compactAttrs(action.label, compact)} onClick={action.activate}>
      <ActionFace label={action.label} compact={compact} />
    </button>
  );
};

const NativeMenu = ({
  action,
  compact,
}: {
  action: Extract<NativeAction, { kind: "menu" }>;
  compact: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Two dismissal paths around the closed shadow boundary: the listener
    // on the shadow root sees real targets for clicks inside our UI, while
    // the document listener only ever sees the retargeted host — so it
    // must ignore anything from inside the shadow (the shadow listener
    // owns those) or it would close the menu before item clicks land.
    const rootNode = wrapperRef.current?.getRootNode();
    const shadowRoot = rootNode instanceof ShadowRoot ? rootNode : null;

    const onShadowPointerDown = (event: Event) => {
      const target = event.target instanceof Node ? event.target : null;

      if (!target || !wrapperRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onDocumentPointerDown = (event: Event) => {
      if (!shadowRoot || !event.composedPath().includes(shadowRoot.host)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    shadowRoot?.addEventListener("pointerdown", onShadowPointerDown);
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      shadowRoot?.removeEventListener("pointerdown", onShadowPointerDown);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const attrs = compactAttrs(action.label, compact);

  return (
    <span class="rt-toolbar-menu" ref={wrapperRef}>
      <button
        {...attrs}
        class={`${attrs.class}${open ? " pressed" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((previous) => !previous);
        }}
      >
        <ActionFace label={action.label} compact={compact} /> ▾
      </button>
      {open && (
        <div class="rt-toolbar-menu-panel" role="menu">
          {action.items.map((item) => (
            <a
              key={`${item.label}-${item.href}`}
              class="rt-toolbar-menu-item"
              role="menuitem"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </span>
  );
};

const ProgressSection = ({
  settings,
  workId,
  store,
  currentChapter,
  availableChapters,
  logger,
}: {
  settings: Settings;
  workId: string;
  store: ValueStore<WorkPageProgress>;
  currentChapter: number | null;
  availableChapters: number | null;
  logger: Logger;
}) => {
  const progress = useValueStore(store);
  const [pending, setPending] = useState(false);

  const fresh = hasFreshChapters(
    {
      last_chapter: progress.lastChapter,
      highest_chapter: progress.highestChapter,
    },
    availableChapters,
  );
  const canReset =
    currentChapter !== null && progress.highestChapter > currentChapter;

  const handleReset = async () => {
    if (currentChapter === null) {
      return;
    }

    setPending(true);

    try {
      const next = await workStatusService.resetHighestChapter(
        settings,
        workId,
        currentChapter,
      );

      store.set({
        lastChapter: next.last_chapter,
        highestChapter: next.highest_chapter,
      });
    } catch (error) {
      logger.warn("Failed to reset chapter progress", error);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <span
        class={`rt-toolbar-chip${fresh ? " fresh" : ""}`}
        title={
          fresh
            ? `New chapters available (${String(availableChapters)} published) · last read · highest reached`
            : "Last read chapter · highest chapter reached"
        }
      >
        📖 Ch {progress.lastChapter}
        {progress.highestChapter !== progress.lastChapter &&
          ` · top ${String(progress.highestChapter)}`}
      </span>
      {canReset && (
        <button
          class="rt-toolbar-btn"
          disabled={pending}
          onClick={() => void handleReset()}
        >
          Reset progress to Ch {currentChapter}
        </button>
      )}
    </>
  );
};

const IgnoreSection = ({
  settings,
  workId,
  store,
  logger,
}: {
  settings: Settings;
  workId: string;
  store: ValueStore<boolean>;
  logger: Logger;
}) => {
  const ignored = useValueStore(store);
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    setPending(true);

    try {
      await workStatusService.setIgnored(settings, workId, !ignored);
      store.set(!ignored);
    } catch (error) {
      logger.warn("Failed to toggle ignore state", error);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      class={`rt-toolbar-btn${ignored ? " pressed" : ""}`}
      disabled={pending}
      title={
        ignored
          ? "Stop ignoring this work"
          : "Ignore this work and hide it from listings"
      }
      onClick={() => void handleToggle()}
    >
      {ignored ? "✓ Ignored" : "🚫 Ignore"}
    </button>
  );
};

const WorkToolbarUI = ({
  settings,
  workId,
  nav,
  initialActions,
  extraActions,
  ignoreStore,
  progressStore,
  currentChapter,
  availableChapters,
  logger,
}: {
  settings: Settings;
  workId: string;
  nav: HTMLElement;
  initialActions: NativeAction[];
  /** Instance-specific adoptions (bottom: kudos + back-to-top); kept
   *  outside the nav re-collect so mutations don't drop them. */
  extraActions: NativeAction[];
  /** Null hides the ignore section (setting off or status unavailable). */
  ignoreStore: ValueStore<boolean> | null;
  progressStore: ValueStore<WorkPageProgress> | null;
  currentChapter: number | null;
  availableChapters: number | null;
  logger: Logger;
}) => {
  const [nativeActions, setNativeActions] = useState(initialActions);

  // AO3's AJAX rewrites the hidden originals (Subscribe ↔ Unsubscribe,
  // Mark for Later ↔ Mark as Read); re-adopt whenever the native list
  // changes so labels and handlers stay current.
  useEffect(() => {
    let timer: number | null = null;

    const observer = new MutationObserver(() => {
      timer ??= window.setTimeout(() => {
        timer = null;
        setNativeActions(collectNativeActions(nav, workId));
      }, 100);
    });

    observer.observe(nav, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();

      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [nav, workId]);

  return (
    <div class="rt-toolbar">
      <span class="rt-toolbar-brand" title="AO3 Toybox work toolbar">
        Toybox
      </span>
      {[...nativeActions, ...extraActions].map((action) => (
        <NativeActionButton
          key={`${action.kind}-${action.label}`}
          action={action}
          compact={settings.compactWorkToolbar}
        />
      ))}
      <span class="rt-toolbar-spacer" />
      {progressStore && (
        <ProgressSection
          settings={settings}
          workId={workId}
          store={progressStore}
          currentChapter={currentChapter}
          availableChapters={availableChapters}
          logger={logger}
        />
      )}
      {ignoreStore && (
        <IgnoreSection
          settings={settings}
          workId={workId}
          store={ignoreStore}
          logger={logger}
        />
      )}
    </div>
  );
};

export default class WorkToolbar extends ContentScript {
  getEnabled(): boolean {
    // The toolbar hosts the (adopted) work navigation, so it mounts on
    // every work page; the extension sections gate individually.
    return isWorkPage();
  }

  async onProcess(): Promise<void> {
    const workId = extractWorkIdFromUrl();
    const navigation = document.querySelector<HTMLElement>(
      AO3_WORK_NAVIGATION_SELECTOR,
    );

    if (
      !workId ||
      !navigation?.parentNode ||
      navigation.dataset.toyboxToolbar
    ) {
      return;
    }

    navigation.dataset.toyboxToolbar = "true";

    let nativeActions: NativeAction[] = [];

    try {
      nativeActions = collectNativeActions(navigation, workId);
    } catch (error) {
      this.logger.error("Failed to adopt native work actions", error);
    }

    const currentChapter = scrapeCurrentChapter();
    const { progressStore, ignoreStore } = await this.createSectionStores(
      workId,
      currentChapter,
    );

    if (nativeActions.length === 0 && !progressStore && !ignoreStore) {
      return;
    }

    const availableChapters = parseChapterCount(
      document.querySelector("dl.stats dd.chapters")?.textContent,
    );

    const mountToolbar = (
      place: (host: HTMLElement) => void,
      extraActions: NativeAction[] = [],
    ): void => {
      // Flow-root + clear keep the host below AO3's floated action lis —
      // overlapping them swallowed their hover/click events.
      const { host, root } = createShadowHost({
        css: `${rtBaseStyles}\n${workToolbarStyles}`,
        hostStyle: "display: flow-root; clear: both; margin: 6px 0;",
      });

      place(host);

      render(
        <WorkToolbarUI
          settings={this.settings}
          workId={workId}
          nav={navigation}
          initialActions={nativeActions}
          extraActions={extraActions}
          ignoreStore={ignoreStore}
          progressStore={progressStore}
          currentChapter={currentChapter}
          availableChapters={availableChapters}
          logger={this.logger}
        />,
        root,
      );
    };

    const navParent = navigation.parentNode;

    mountToolbar((host) => {
      navParent.insertBefore(host, navigation.nextSibling);
    });

    this.mountBottomToolbar(mountToolbar, nativeActions.length > 0);

    // Only after the replacement is live; a failed adoption leaves AO3's
    // own controls untouched.
    if (nativeActions.length > 0) {
      navigation.style.setProperty("display", "none", "important");
    }
  }

  /**
   * Extension-section state, shared between the top and bottom toolbar
   * instances so acting in one is reflected in the other. One status
   * request feeds every section; null (server mode hiccup) or a disabled
   * setting suppresses a section's store — but never the navigation.
   */
  private async createSectionStores(
    workId: string,
    currentChapter: number | null,
  ): Promise<{
    progressStore: ValueStore<WorkPageProgress> | null;
    ignoreStore: ValueStore<boolean> | null;
  }> {
    const statuses = await workStatusService.getStatuses(this.settings, [
      workId,
    ]);

    if (!statuses) {
      return { progressStore: null, ignoreStore: null };
    }

    const status = statuses[workId] ?? null;
    const progress = this.settings.showChapterProgress
      ? workPageProgress(status, currentChapter)
      : null;

    return {
      progressStore: progress ? createValueStore(progress) : null,
      // Never-visited works still get the ignore button (default off state)
      ignoreStore: this.settings.showIgnoreControl
        ? createValueStore(status?.ignored ?? false)
        : null,
    };
  }

  /**
   * Second instance at the bottom of the chapter content: before AO3's
   * #feedback section (present even with comments disabled), after
   * #workskin as a fallback, skipped when neither exists.
   *
   * The feedback section's own actions row (↑ Top, chapter links, kudos,
   * comments) would sit right under this instance and double its chapter
   * and comments buttons, so its unique actions — kudos and back-to-top —
   * are adopted into the toolbar and the native row is hidden. Only when
   * the header adoption succeeded: the row's chapter/comments links are
   * dupes of header actions, and hiding them without that coverage would
   * lose navigation.
   */
  private mountBottomToolbar(
    mountToolbar: (
      place: (host: HTMLElement) => void,
      extraActions?: NativeAction[],
    ) => void,
    navAdopted: boolean,
  ): void {
    if (!this.settings.showBottomWorkToolbar) {
      return;
    }

    const feedback = document.querySelector<HTMLElement>("#feedback");
    const feedbackParent = feedback?.parentNode;

    if (feedback && feedbackParent) {
      let extraActions: NativeAction[] = [];
      const nativeRow = navAdopted
        ? feedback.querySelector<HTMLElement>(":scope > ul.actions")
        : null;

      if (nativeRow) {
        try {
          extraActions = collectFeedbackActions(nativeRow);
        } catch (error) {
          this.logger.error("Failed to adopt feedback actions", error);
        }
      }

      mountToolbar((host) => {
        feedbackParent.insertBefore(host, feedback);
      }, extraActions);

      if (nativeRow && extraActions.length > 0) {
        nativeRow.style.setProperty("display", "none", "important");
      }

      return;
    }

    const workskin = document.querySelector<HTMLElement>("#workskin");
    const workskinParent = workskin?.parentNode;

    if (workskin && workskinParent) {
      mountToolbar((host) => {
        workskinParent.insertBefore(host, workskin.nextSibling);
      });
    }
  }
}
