/// <reference types="chrome" />
import { isThemeOnlyPatch } from "@src/ao3_theme_injector/theme-options";
import {
  getAllSettings,
  setSetting,
  type Settings,
} from "@src/common/settings";
import { onMounted, onUnmounted, ref, type Ref } from "vue";

const RELOAD_DEBOUNCE_MS = 800;

export type PopupSettings = {
  settings: Ref<Settings | null>;
  version: Ref<string>;
  /** Optimistic patch write with rollback; schedules the tab reload. */
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  openOptions: () => void;
};

// The popup runs as an extension page: Chrome exposes chrome.*, Firefox
// exposes both; use whichever is present.
const extensionApi = () => (typeof chrome === "undefined" ? browser : chrome);

/**
 * Shared popup state: one settings object, one optimistic write path, and
 * one debounced reload of the active AO3 tab — every screen's controls
 * funnel through here so a burst of changes still reloads once.
 */
export function usePopupSettings(): PopupSettings {
  const settings = ref<Settings | null>(null);
  const version = ref("");

  // Only ever auto-reload the active tab of this window, and only when it
  // is an AO3 page: users can have dozens of AO3 tabs open, and reloading
  // them all would hammer AO3's servers. Background tabs pick changes up
  // on their own next load. The tab is captured at popup open so the
  // pagehide flush below can fire without awaiting a query.
  const activeAo3TabId = ref<number | null>(null);

  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let reloadPending = false;

  const flushReload = () => {
    if (!reloadPending) return;

    reloadPending = false;
    clearTimeout(reloadTimer);

    if (activeAo3TabId.value !== null) {
      try {
        void extensionApi().tabs.reload(activeAo3TabId.value);
      } catch (error) {
        console.error("Failed to reload tab", error);
      }
    }
  };

  // Debounced so a burst of toggle flips causes one reload, not one per
  // tap; flushed on pagehide so closing the popup can't swallow it.
  const scheduleReload = () => {
    reloadPending = true;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(flushReload, RELOAD_DEBOUNCE_MS);
  };

  onMounted(async () => {
    window.addEventListener("pagehide", flushReload);

    try {
      settings.value = await getAllSettings();
    } catch (error) {
      console.error("Failed to load settings", error);
    }

    try {
      version.value = extensionApi().runtime.getManifest().version;
    } catch {
      version.value = "";
    }

    try {
      const [tab] = await extensionApi().tabs.query({
        active: true,
        currentWindow: true,
      });

      // Url is only exposed for hosts the extension has permission for (AO3)
      if (tab.id !== undefined && tab.url?.includes("archiveofourown.org")) {
        activeAo3TabId.value = tab.id;
      }
    } catch (error) {
      console.error("Failed to query active tab", error);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("pagehide", flushReload);
  });

  const updateSettings = async (patch: Partial<Settings>) => {
    if (!settings.value) return;

    const previous = settings.value;
    settings.value = { ...previous, ...patch };

    try {
      await Promise.all(
        Object.entries(patch).map(([key, value]) =>
          setSetting(key as keyof Settings, value as never),
        ),
      );

      // Theme settings hot-apply everywhere: the injector in each open
      // tab watches storage and swaps its stylesheet — no reload needed.
      if (!isThemeOnlyPatch(patch)) {
        scheduleReload();
      }
    } catch (error) {
      console.error("Failed to save settings", error);
      settings.value = previous;
    }
  };

  const openOptions = () => {
    void extensionApi().runtime.openOptionsPage();
  };

  return { settings, version, updateSettings, openOptions };
}
