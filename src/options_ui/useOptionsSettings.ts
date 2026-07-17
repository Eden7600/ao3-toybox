import { onMounted, ref, watch, type Ref } from "vue";

import { useToast } from "@src/common/ui";

import { Logger } from "@src/common/logger";
import {
  defaultSettings,
  getAllSettings,
  setAllSettings,
  type Settings,
} from "@src/common/settings";

/**
 * Shared persistence wiring for options views: fetch settings on mount,
 * save on any change, surface failures as toasts. The assignment of the
 * freshly-fetched settings must not echo a save — the watcher skips
 * exactly that one trigger.
 */
export function useOptionsSettings(scope: string): {
  settings: Ref<Settings>;
  loaded: Ref<boolean>;
  loadError: Ref<string | null>;
} {
  const logger = new Logger(scope);
  const toast = useToast();

  // Clone so a page never mutates the shared defaultSettings object while
  // storage is still loading
  const settings = ref<Settings>(structuredClone(defaultSettings));
  const loaded = ref(false);
  const loadError = ref<string | null>(null);

  let skipNextSave = false;

  onMounted(async () => {
    try {
      const stored = await getAllSettings();
      skipNextSave = true;
      settings.value = stored;
      loaded.value = true;
      logger.log("Settings fetched successfully", stored);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to fetch settings:", message);
      loadError.value = `Failed to load settings: ${message}`;
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Failed to fetch settings",
        life: 3000,
      });
    }
  });

  watch(
    settings,
    async (newSettings) => {
      if (skipNextSave) {
        skipNextSave = false;

        return;
      }

      try {
        await setAllSettings(newSettings);
        logger.log("Settings updated successfully");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to update settings:", message);
        toast.add({
          severity: "error",
          summary: "Error",
          detail: `Failed to save settings: ${message}`,
          life: 3000,
        });
      }
    },
    { deep: true },
  );

  return { settings, loaded, loadError };
}
