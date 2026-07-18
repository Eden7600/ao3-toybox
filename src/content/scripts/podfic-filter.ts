import { extractStatNumber } from "@src/common/blurb-stats";
import {
  clearHideSourceMarks,
  markWorkForHiding,
} from "@src/common/hide-modes";
import { ContentScript } from "../content-script";

export default class PodficFilter extends ContentScript {
  private static get WORK_SELECTOR(): string {
    return "li.work.blurb.group";
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  async onSettingsReset(): Promise<void> {
    clearHideSourceMarks(["podfic"]);
  }

  getEnabled(): boolean {
    return this.settings.hideWorks && this.settings.hideModes.podfic !== "none";
  }

  async onPreProcess(): Promise<void> {
    const works = document.querySelectorAll<HTMLElement>(
      PodficFilter.WORK_SELECTOR,
    );

    if (works.length === 0) {
      this.logger.log("No works found to filter");

      return;
    }

    let hiddenCount = 0;

    works.forEach((work) => {
      const reason = this.matchReason(work);

      if (reason) {
        this.logger.log(`Marking work ${work.id} for hiding: ${reason}`);
        markWorkForHiding(work, "podfic", reason);
        hiddenCount++;
      }
    });

    this.logger.log(
      `Marked ${String(hiddenCount)} works for hiding as podfic/non-text`,
    );
  }

  private matchReason(work: HTMLElement): string | null {
    const title = work.querySelector('h4.heading > a[href*="/works/"]');

    if (title?.textContent.toLowerCase().includes("podfic")) {
      return "Podfic in title";
    }

    const summary = work.querySelector("blockquote.userstuff.summary");

    if (summary?.textContent.toLowerCase().includes("podfic")) {
      return "Podfic in summary";
    }

    // Exactly 0: a missing/hidden words stat parses to null and must not
    // count as non-text.
    if (extractStatNumber(work, "dd.words") === 0) {
      return "Non-text work (0 words)";
    }

    return null;
  }
}
