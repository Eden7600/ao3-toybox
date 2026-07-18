import type { Browser } from "@src/common/constants";
import { Logger } from "@src/common/logger";
import type { Settings } from "@src/common/settings";

export type ContentScriptModule = {
  default: new (settings: Settings, browser: Browser) => ContentScript;
};

export abstract class ContentScript {
  protected browser: Browser;
  protected settings: Settings;
  protected logger: Logger;

  constructor(settings: Settings, browser: Browser) {
    this.browser = browser;
    this.settings = settings;
    this.logger = new Logger("CTS-" + this.constructor.name);
  }

  abstract getEnabled(): boolean;

  /** Swap in a fresh settings snapshot (live settings changes). */
  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  /**
   * Scripts that can undo and redo their page work without a reload
   * return true; on a live settings change the manager calls
   * onSettingsReset on them and then re-runs their phases.
   */
  get supportsLiveReapply(): boolean {
    return false;
  }

  // Undo page work before a live reapply; runs with the new settings already applied.
  onSettingsReset?(): Promise<void>;

  // This stage is when we scrape/read data from the page. No modifications are made to the page at this stage.
  onInitialize?(): Promise<void>;
  // This is where we make small modifications to the page, such as adding / removing attributes.
  onPreProcess?(): Promise<void>;
  // This is where we make large modifications to the page. This is where we add / remove elements, modify content, etc.
  onProcess?(): Promise<void>;
  // This is after we've made all our modifications to the page, things like sending data, etc.
  onPostProcess?(): Promise<void>;
  onMutation?(mutations: MutationRecord[]): Promise<void>;
}
