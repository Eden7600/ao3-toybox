import { extractStatNumber } from "@src/common/blurb-stats";
import {
  clearHideSourceMarks,
  markWorkForHiding,
} from "@src/common/hide-modes";
import { ContentScript } from "../content-script";

export default class WordCountFilter extends ContentScript {
  private static get WORK_SELECTOR(): string {
    return "li.work.blurb.group";
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  async onSettingsReset(): Promise<void> {
    // Marks from the old bounds are stale; re-mark from scratch
    clearHideSourceMarks(["word-count"]);
  }

  getEnabled(): boolean {
    return (
      this.settings.hideWorks &&
      this.settings.hideModes["word-count"] !== "none" &&
      (this.settings.hideWordCountMin > 0 || this.settings.hideWordCountMax > 0)
    );
  }

  async onPreProcess(): Promise<void> {
    const works = document.querySelectorAll<HTMLElement>(
      WordCountFilter.WORK_SELECTOR,
    );

    if (works.length === 0) {
      this.logger.log("No works found to filter");

      return;
    }

    const min = this.settings.hideWordCountMin;
    const max = this.settings.hideWordCountMax;

    let hiddenCount = 0;

    works.forEach((work) => {
      // Works without a readable words stat are never hidden.
      const words = extractStatNumber(work, "dd.words");

      if (words === null) {
        return;
      }

      let reason: string | null = null;

      if (min > 0 && words < min) {
        reason = `Word count too low (${String(words)}, min ${String(min)})`;
      } else if (max > 0 && words > max) {
        reason = `Word count too high (${String(words)}, max ${String(max)})`;
      }

      if (reason) {
        this.logger.log(`Marking work ${work.id} for hiding: ${reason}`);
        markWorkForHiding(work, "word-count", reason);
        hiddenCount++;
      }
    });

    this.logger.log(
      `Marked ${String(hiddenCount)} works for hiding due to word count`,
    );
  }
}
