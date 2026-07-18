import {
  computeBlurbRatios,
  formatKudosPerHit,
  formatRatio,
} from "@src/common/blurb-stats";
import {
  clearHideSourceMarks,
  markWorkForHiding,
} from "@src/common/hide-modes";
import { ContentScript } from "../content-script";

export default class RatioFilter extends ContentScript {
  private static get WORK_SELECTOR(): string {
    return "li.work.blurb.group";
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  async onSettingsReset(): Promise<void> {
    // Marks from the old thresholds are stale; re-mark from scratch
    clearHideSourceMarks(["kudos-hits", "words-chapter"]);
  }

  getEnabled(): boolean {
    return (
      this.settings.hideWorks &&
      (this.kudosHitsActive() || this.wordsChapterActive())
    );
  }

  private kudosHitsActive(): boolean {
    return this.settings.hideModes["kudos-hits"] !== "none";
  }

  private wordsChapterActive(): boolean {
    return (
      this.settings.hideModes["words-chapter"] !== "none" &&
      (this.settings.hideWordsPerChapterMin > 0 ||
        this.settings.hideWordsPerChapterMax > 0)
    );
  }

  async onPreProcess(): Promise<void> {
    const works = document.querySelectorAll<HTMLElement>(
      RatioFilter.WORK_SELECTOR,
    );

    if (works.length === 0) {
      this.logger.log("No works found to filter");

      return;
    }

    let hiddenCount = 0;

    works.forEach((work) => {
      // Works whose ratios can't be computed (0 kudos, hidden hits,
      // no published chapters) are never hidden by these filters.
      const ratios = computeBlurbRatios(work);

      if (this.kudosHitsActive() && ratios.kudosPerHit !== null) {
        // Threshold is stored as a percentage; the ratio is a fraction.
        const threshold = this.settings.hideKudosPerHitThreshold;

        if (ratios.kudosPerHit * 100 < threshold) {
          this.markWork(
            work,
            "kudos-hits",
            `Kudos/hits too low (${formatKudosPerHit(ratios.kudosPerHit)}, min ${String(threshold)}%)`,
          );
          hiddenCount++;
        }
      }

      if (this.wordsChapterActive() && ratios.wordsPerChapter !== null) {
        const min = this.settings.hideWordsPerChapterMin;
        const max = this.settings.hideWordsPerChapterMax;
        const value = formatRatio(ratios.wordsPerChapter, 0);

        if (min > 0 && ratios.wordsPerChapter < min) {
          this.markWork(
            work,
            "words-chapter",
            `Words/chapter too low (${value}, min ${String(min)})`,
          );
          hiddenCount++;
        } else if (max > 0 && ratios.wordsPerChapter > max) {
          this.markWork(
            work,
            "words-chapter",
            `Words/chapter too high (${value}, max ${String(max)})`,
          );
          hiddenCount++;
        }
      }
    });

    this.logger.log(
      `Marked ${String(hiddenCount)} works for hiding due to ratio filtering`,
    );
  }

  private markWork(
    work: HTMLElement,
    source: "kudos-hits" | "words-chapter",
    reason: string,
  ): void {
    this.logger.log(`Marking work ${work.id} for hiding: ${reason}`);

    markWorkForHiding(work, source, reason);
  }
}
