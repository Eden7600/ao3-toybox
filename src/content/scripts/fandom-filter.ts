import {
  clearHideSourceMarks,
  markWorkForHiding,
} from "@src/common/hide-modes";
import { ContentScript } from "../content-script";

export default class FandomFilter extends ContentScript {
  private static get WORK_SELECTOR(): string {
    return "li.work.blurb.group";
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  async onSettingsReset(): Promise<void> {
    // Marks from the old threshold are stale; re-mark from scratch
    clearHideSourceMarks(["fandom"]);
  }

  getEnabled(): boolean {
    return this.settings.hideWorks && this.settings.hideModes.fandom !== "none";
  }

  async onPreProcess(): Promise<void> {
    const works = document.querySelectorAll<HTMLElement>(
      FandomFilter.WORK_SELECTOR,
    );

    if (works.length === 0) {
      this.logger.log("No works found to filter");

      return;
    }

    const threshold = this.settings.hideExcessiveFandomsThreshold;
    this.logger.log(
      `Filtering works with more than ${String(threshold)} fandoms`,
    );

    let hiddenCount = 0;

    works.forEach((work) => {
      const fandomCount = this.countFandoms(work);

      if (fandomCount > threshold) {
        this.markWorkAsHidden(work, fandomCount);
        hiddenCount++;
      }
    });

    this.logger.log(
      `Marked ${String(hiddenCount)} works for hiding due to excessive fandoms`,
    );
  }

  private countFandoms(work: HTMLElement): number {
    const fandomElements = work.querySelectorAll("h5.fandoms a.tag");

    return fandomElements.length;
  }

  private markWorkAsHidden(work: HTMLElement, fandomCount: number): void {
    const threshold = this.settings.hideExcessiveFandomsThreshold;

    this.logger.log(
      `Marking work ${work.id} for hiding: ${String(fandomCount)} fandoms`,
    );

    markWorkForHiding(
      work,
      "fandom",
      `Too many fandoms (${String(fandomCount)} fandoms, max ${String(threshold)})`,
    );
  }
}
