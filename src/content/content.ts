import { Logger } from "@src/common/logger";
const logger = new Logger("CTS-Root");

import type { Browser } from "@src/common/constants";
import { sameLiveContentSettings } from "@src/common/live-settings";
import {
  getAllSettings,
  normalizeStoredSettings,
  type Settings,
  type StoredSettings,
} from "@src/common/settings";
import { ContentScript, type ContentScriptModule } from "./content-script";
import { ContentScriptManager } from "./content-script-manager";

const observer = new MutationObserver((mutationsList) => {
  scriptManager.handleMutations(mutationsList).catch((error: unknown) => {
    logger.error(
      `Failed to handle mutations: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
});

const scriptManager = new ContentScriptManager(logger);

async function start(): Promise<void> {
  logger.log("Starting ContentScript System");

  const allScripts = {
    ...import.meta.glob<ContentScriptModule>("./scripts/*.ts"),
    ...import.meta.glob<ContentScriptModule>("./scripts/*.tsx"),
  };

  try {
    // Only load settings once and pass them to all scripts
    const settings = await getAllSettings();
    logger.log("Loaded settings", settings);

    // Pull the browser from the ENV
    const browser = process.env.BROWSER as Browser;

    for (const path in allScripts) {
      if (!Object.hasOwn(allScripts, path)) continue;
      // eslint-disable-next-line no-await-in-loop
      const scriptModule = await allScripts[path]();

      if (scriptModule.default.prototype instanceof ContentScript) {
        // eslint-disable-next-line new-cap
        const scriptInstance = new scriptModule.default(settings, browser);
        scriptManager.addScript(scriptInstance);
      } else {
        logger.error(
          `Module at ${path} does not have a valid default export extending ContentScript, skipping`,
        );
      }
    }

    scriptManager.triggerAll().catch((error: unknown) => {
      logger.error(
        `Failed to trigger content scripts: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    watchSettings(settings);
  } catch (error) {
    logger.error(
      `Failed to start PageProcessor module: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  observer.observe(document.body, { attributes: true });
}

/**
 * Live settings: changes from the popup or options page land in storage;
 * every script gets the fresh snapshot, and the live-reapply scripts
 * undo and redo their page work so the change shows without a reload.
 * Theme-only changes are the injector's job and skip the reapply.
 */
function watchSettings(initial: Settings): void {
  let current = initial;

  const api = typeof chrome === "undefined" ? browser : chrome;

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !("settings" in changes)) return;

    const next = normalizeStoredSettings(
      changes.settings.newValue as StoredSettings | null,
    );
    const reapplyNeeded = !sameLiveContentSettings(current, next);

    current = next;
    scriptManager.updateAllSettings(next);

    if (!reapplyNeeded) return;

    logger.log("Live settings change detected, reapplying");

    scriptManager.reapplyLive().catch((error: unknown) => {
      logger.error(
        `Failed to reapply live scripts: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  });
}

void start();
