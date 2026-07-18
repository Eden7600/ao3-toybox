import type { Logger } from "@src/common/logger";
import type { Settings } from "@src/common/settings";
import type { ContentScript } from "./content-script";

export class ContentScriptManager {
  private scripts: ContentScript[];
  private logger: Logger;

  constructor(logger: Logger) {
    this.scripts = [];
    this.logger = logger;
  }

  addScript(script: ContentScript): void {
    this.scripts.push(script);
  }

  async triggerAll(): Promise<void> {
    this.logger.log("Content Script Manager is triggering all scripts");

    const enabledScripts = this.scripts.filter((script) => {
      const enabled = script.getEnabled();

      if (enabled) {
        this.logger.info(`Script ${script.constructor.name} is enabled`);
      } else {
        this.logger.softWarn(`Script ${script.constructor.name} is disabled`);
      }

      return enabled;
    });

    await this.runPhases(enabledScripts);
  }

  /** Push a fresh settings snapshot to every script. */
  updateAllSettings(settings: Settings): void {
    this.scripts.forEach((script) => {
      script.updateSettings(settings);
    });
  }

  /**
   * Live settings change: scripts that support reapply undo their page
   * work first (all of them — a feature just turned off must clean up),
   * then the currently-enabled ones run their phases again. Phase order
   * is preserved so marking scripts run before the hide processor.
   */
  async reapplyLive(): Promise<void> {
    const liveScripts = this.scripts.filter(
      (script) => script.supportsLiveReapply,
    );

    this.logger.log(
      `Reapplying ${String(liveScripts.length)} live scripts after settings change`,
    );

    await Promise.all(
      liveScripts.map(async (script) => {
        try {
          await script.onSettingsReset?.();
        } catch (error) {
          this.logger.error(
            `Error in onSettingsReset for script ${script.constructor.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );

    await this.runPhases(liveScripts.filter((script) => script.getEnabled()));
  }

  private async runPhases(scripts: ContentScript[]): Promise<void> {
    const runPhase = async (
      phase: "onInitialize" | "onPreProcess" | "onProcess" | "onPostProcess",
    ) => {
      const promises = scripts
        .filter((script) => script[phase])
        .map((script) =>
          (script[phase] as () => Promise<void>)().catch((error: unknown) => {
            this.logger.error(
              `Error in ${phase} for script ${script.constructor.name}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }),
        );
      await Promise.all(promises);
    };

    await runPhase("onInitialize");
    await runPhase("onPreProcess");
    await runPhase("onProcess");
    await runPhase("onPostProcess");
  }

  async handleMutations(mutations: MutationRecord[]): Promise<void> {
    await Promise.all(
      this.scripts.map(async (script) => {
        try {
          await script.onMutation?.(mutations);
        } catch (error) {
          this.logger.error(
            `Error in onMutation for script ${script.constructor.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );
  }
}
