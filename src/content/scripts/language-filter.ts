import {
  clearHideSourceMarks,
  markWorkForHiding,
} from "@src/common/hide-modes";
import { ContentScript } from "../content-script";

export default class LanguageFilter extends ContentScript {
  private static get WORK_SELECTOR(): string {
    return "li.work.blurb.group";
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  async onSettingsReset(): Promise<void> {
    // Marks from the old allowlist are stale; re-mark from scratch
    clearHideSourceMarks(["language"]);
  }

  getEnabled(): boolean {
    return (
      this.settings.hideWorks &&
      this.settings.hideModes.language !== "none" &&
      this.settings.hideLanguagesAllowlist.length > 0
    );
  }

  async onPreProcess(): Promise<void> {
    const works = document.querySelectorAll<HTMLElement>(
      LanguageFilter.WORK_SELECTOR,
    );

    if (works.length === 0) {
      this.logger.log("No works found to filter");

      return;
    }

    const allowedLanguages = this.settings.hideLanguagesAllowlist.map(
      (lang) => lang.text,
    );

    this.logger.log(
      `Filtering works not in allowed languages: ${allowedLanguages.join(", ")}`,
    );

    let hiddenCount = 0;

    works.forEach((work) => {
      const language = this.extractLanguage(work);

      if (language && !allowedLanguages.includes(language)) {
        this.markWorkAsHidden(work, language);
        hiddenCount++;
      }
    });

    this.logger.log(
      `Marked ${String(hiddenCount)} works for hiding due to language filtering`,
    );
  }

  private extractLanguage(work: HTMLElement): string | null {
    // Language is in the stats section: dl.stats dd.language
    const statsElement = work.querySelector("dl.stats");

    if (!statsElement) {
      return null;
    }

    const languageElement = statsElement.querySelector("dd.language");

    if (!languageElement) {
      return null;
    }

    return languageElement.textContent.trim();
  }

  private markWorkAsHidden(work: HTMLElement, language: string): void {
    this.logger.log(`Marking work ${work.id} for hiding: language ${language}`);

    markWorkForHiding(work, "language", `Language not allowed: ${language}`);
  }
}
