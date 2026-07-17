import type { Logger } from "@src/common/logger";
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

    const runPhase = async (
      phase: "onInitialize" | "onPreProcess" | "onProcess" | "onPostProcess",
    ) => {
      const promises = enabledScripts
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
