import {
  computeBlurbRatios,
  extractStatNumber,
  formatKudosPerHit,
  formatRatio,
} from "@src/common/blurb-stats";
import { ensureFinishAtTicker } from "@src/common/finish-at-ticker";
import {
  finishReadingAt,
  formatFinishAt,
  formatReadingTime,
  readingMinutes,
} from "@src/common/reading-time";
import { ContentScript } from "../content-script";

export default class RatioStats extends ContentScript {
  private static get WORK_SELECTOR(): string {
    return "li.work.blurb.group";
  }

  /** Every stat class this script may inject, for the live-reset sweep. */
  private static get STAT_CLASSES(): string[] {
    return [
      "toybox-kudos-hits",
      "toybox-words-chapter",
      "toybox-reading-time",
      "toybox-finish-at",
    ];
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  /** Remove every injected stat pair; onProcess re-injects per settings. */
  async onSettingsReset(): Promise<void> {
    const selector = RatioStats.STAT_CLASSES.map(
      (className) => `.toybox-stat.${className}`,
    ).join(", ");

    document.querySelectorAll(selector).forEach((element) => {
      element.remove();
    });
  }

  getEnabled(): boolean {
    return (
      this.settings.showKudosPerHitRatio ||
      this.settings.showWordsPerChapterRatio ||
      this.settings.showBlurbReadingTime ||
      this.settings.showBlurbFinishAt
    );
  }

  async onProcess(): Promise<void> {
    const works = document.querySelectorAll<HTMLElement>(
      RatioStats.WORK_SELECTOR,
    );

    let injectedCount = 0;

    works.forEach((work) => {
      const stats = work.querySelector("dl.stats");

      if (!stats) {
        return;
      }

      const ratios = computeBlurbRatios(work);

      if (
        this.settings.showKudosPerHitRatio &&
        ratios.kudosPerHit !== null &&
        this.appendStat(
          stats,
          "toybox-kudos-hits",
          "Kudos/Hits:",
          formatKudosPerHit(ratios.kudosPerHit),
        )
      ) {
        injectedCount++;
      }

      if (
        this.settings.showWordsPerChapterRatio &&
        ratios.wordsPerChapter !== null &&
        this.appendStat(
          stats,
          "toybox-words-chapter",
          "Words/Chapter:",
          formatRatio(ratios.wordsPerChapter, 0),
        )
      ) {
        injectedCount++;
      }

      // Both time stats derive from the blurb's word count; blurbs
      // without one get neither
      const minutes = readingMinutes(
        extractStatNumber(work, "dd.words"),
        this.settings.readingWpm,
      );

      if (
        this.settings.showBlurbReadingTime &&
        minutes !== null &&
        this.appendStat(
          stats,
          "toybox-reading-time",
          "Reading Time:",
          formatReadingTime(minutes),
        )
      ) {
        injectedCount++;
      }

      if (this.settings.showBlurbFinishAt && minutes !== null) {
        const now = new Date();
        const finishAt = this.appendStat(
          stats,
          "toybox-finish-at",
          "Finish At:",
          formatFinishAt(finishReadingAt(now, minutes), now),
        );

        if (finishAt) {
          // The ticker keeps the clock time current while the tab is
          // visible; the stat means "if you started now"
          finishAt.dataset.toyboxFinishMinutes = String(minutes);
          ensureFinishAtTicker();
          injectedCount++;
        }
      }
    });

    this.logger.log(`Injected ${String(injectedCount)} ratio stats`);
  }

  /**
   * Append a dt/dd stat pair unless this blurb already carries it —
   * listings can be re-processed and stats must not duplicate. Returns
   * the created dd, or null when the stat already existed.
   */
  private appendStat(
    stats: Element,
    className: string,
    label: string,
    value: string,
  ): HTMLElement | null {
    if (stats.querySelector(`dd.${className}`)) {
      return null;
    }

    const dt = document.createElement("dt");
    dt.className = `toybox-stat ${className}`;
    dt.textContent = label;

    const dd = document.createElement("dd");
    dd.className = `toybox-stat ${className}`;
    dd.textContent = value;

    stats.append(dt, dd);

    return dd;
  }
}
