import {
  COMPLETED_TEXT_COLOR,
  DATE_TEXT_KEYFRAMES,
  dateBadgeStyle,
  interpolateColor,
  naturalDateLabel,
} from "@src/common/date-badge";
import { ContentScript } from "../content-script";

export default class DateFormatter extends ContentScript {
  getEnabled(): boolean {
    return (
      this.settings.enableDateBadge || this.settings.enableDateNaturalLanguage
    );
  }

  applyDateStyles(element: HTMLElement, color: number[]) {
    const style = dateBadgeStyle(color, this.settings.ao3ThemeOled);

    element.style.color = style.color;

    if (style.backgroundColor) {
      element.style.backgroundColor = style.backgroundColor;
    }

    element.style.padding = style.padding;
    element.style.borderRadius = style.borderRadius;
    element.style.border = style.border;
    element.style.fontWeight = style.fontWeight;
  }

  async onProcess(): Promise<void> {
    const works: NodeListOf<HTMLLIElement> = document.querySelectorAll(
      "li.work.blurb.group",
    );

    for (const work of works) {
      const chapterElement: HTMLElement | null =
        work.querySelector("dd.chapters");
      const lastUpdatedElement: HTMLElement | null =
        work.querySelector("p.datetime");

      if (!chapterElement || !lastUpdatedElement) {
        this.logger.error("Failed to find chapter or last updated element");
        continue;
      }

      // Create a new element to replace lastUpdatedElement
      const newUpdatedElement = document.createElement("p");
      newUpdatedElement.className = lastUpdatedElement.className;
      newUpdatedElement.textContent = lastUpdatedElement.textContent;

      const today = new Date();
      const lastUpdatedText = lastUpdatedElement.textContent;
      if (!lastUpdatedText) continue;
      const lastUpdatedDate = new Date(lastUpdatedText);

      const timeDifference = today.getTime() - lastUpdatedDate.getTime();
      const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));

      if (this.settings.enableDateBadge) {
        const color = interpolateColor(DATE_TEXT_KEYFRAMES, daysDifference);

        this.applyDateStyles(newUpdatedElement, color);
      }

      if (this.settings.enableDateNaturalLanguage) {
        newUpdatedElement.textContent = naturalDateLabel(daysDifference);
      }

      // Insert newUpdatedElement after lastUpdatedElement and hide lastUpdatedElement
      if (!lastUpdatedElement.parentNode) continue;
      lastUpdatedElement.parentNode.insertBefore(
        newUpdatedElement,
        lastUpdatedElement.nextSibling,
      );
      lastUpdatedElement.style.display = "none";

      if (!chapterElement.textContent) continue;
      const published = parseInt(chapterElement.textContent.split("/")[0], 10);
      const total = parseInt(chapterElement.textContent.split("/")[1], 10);
      const isWorkCompleted = published === total;

      if (isWorkCompleted) {
        // Badge styling is opt-in via enableDateBadge — completed works
        // used to get badged even with the setting off
        if (this.settings.enableDateBadge) {
          this.applyDateStyles(newUpdatedElement, COMPLETED_TEXT_COLOR);
        }

        // Replace date text with "Completed" for completed works
        if (this.settings.showCompletedText) {
          newUpdatedElement.textContent = "Completed";
        }
      }
    }
  }
}
