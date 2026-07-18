import type { CommonTagResponse } from "@src/background/handlers/common-tag-handler";
import type { RegexTagResponse } from "@src/background/handlers/regex-tag-handler";
import { Color } from "@src/common/color";
import {
  clearHideSourceMarks,
  markWorkForHiding,
} from "@src/common/hide-modes";
import { messaging } from "@src/common/messaging";
import { countTagColors } from "@src/common/tag-color-summary";
import { ContentScript } from "../content-script";
import summaryStyles from "../styles/tag-color-summary.css?inline";
import { appendTagColorSummary } from "../tag-color-indicator";

export default class TagHighlighter extends ContentScript {
  private static get TAG_SELECTOR(): string {
    return "a.tag";
  }
  private static get WORK_SELECTOR(): string {
    return "li.work.blurb.group";
  }
  private static get PROCESSED_ATTRIBUTE(): string {
    return "data-toybox-tag-processed";
  }

  // Store collected data between lifecycle phases
  private commonTagsMap = new Map<string, CommonTagResponse>();
  private regexTagsMap = new Map<string, RegexTagResponse>();

  getEnabled(): boolean {
    // Check if the page has already been processed
    if (document.body.hasAttribute(TagHighlighter.PROCESSED_ATTRIBUTE)) {
      this.logger.log("Page has already been processed, skipping");

      return false;
    }

    // Check if this is a tag detail page
    const tagDetailsPageHeading = document.querySelector(
      "div.primary.header.module>ul.navigation.actions",
    );

    if (tagDetailsPageHeading !== null) {
      this.logger.log("This is a tag detail page, script not applicable");

      return false;
    }

    // Check if there are any tags on the page
    const hasTags =
      document.querySelector(TagHighlighter.TAG_SELECTOR) !== null;

    if (!hasTags) {
      this.logger.log("No tags found on the page, script not applicable");

      return false;
    }

    return this.settings.enableTagHighlighter;
  }

  async onPreProcess(): Promise<void> {
    try {
      // Collect tags from the page and fetch data from background
      const [commonTags, regexTags] = await Promise.all([
        this.collectCommonTags(),
        this.collectRegexTags(),
      ]);

      this.logger.log(
        `Collected ${String(commonTags.length)} common tags and ${String(regexTags.length)} regex tag matches`,
      );

      // Convert arrays to Maps for O(1) lookups
      commonTags.forEach((tag) => this.commonTagsMap.set(tag.original, tag));
      regexTags.forEach((tag) => this.regexTagsMap.set(tag.original, tag));

      // Add hide reasons to works (data attribute modifications)
      this.addHideReasons();
    } catch (error) {
      this.logger.error("Error in preProcess:", error);
    }
  }

  async onProcess(): Promise<void> {
    try {
      // Apply visual modifications (colors and text content)
      this.applyVisualModifications();
      document.body.setAttribute(TagHighlighter.PROCESSED_ATTRIBUTE, "true");
    } catch (error) {
      this.logger.error("Error in process:", error);
    }
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  /**
   * Live settings change: put every touched tag back to its stock state
   * (styles, alias names, hidden-tag display), drop the color summaries,
   * retract this script's hide marks, and clear the processed guard so a
   * re-run starts from a clean page. The tag config is refetched from the
   * background on the re-run, so config edits land too.
   */
  async onSettingsReset(): Promise<void> {
    document.body.removeAttribute(TagHighlighter.PROCESSED_ATTRIBUTE);

    document
      .querySelectorAll<HTMLElement>("[data-toybox-highlighted]")
      .forEach((tag) => {
        tag.style.backgroundColor = "";
        tag.style.color = "";
        tag.style.opacity = "";
        delete tag.dataset.toyboxHighlighted;
      });

    document
      .querySelectorAll<HTMLElement>("[data-toybox-original-name]")
      .forEach((tag) => {
        tag.textContent = tag.dataset.toyboxOriginalName ?? tag.textContent;
        delete tag.dataset.toyboxOriginalName;
      });

    document
      .querySelectorAll<HTMLElement>("a.tag[data-toybox-hide-tag]")
      .forEach((tag) => {
        tag.style.display = "";
        delete tag.dataset.toyboxHideTag;
      });

    document
      .querySelectorAll(".toybox-stat.toybox-tag-colors")
      .forEach((element) => {
        element.remove();
      });

    clearHideSourceMarks(["excluded-tags"]);

    this.commonTagsMap.clear();
    this.regexTagsMap.clear();
  }

  private async collectRegexTags(): Promise<RegexTagResponse[]> {
    const pageTags = Array.from(
      document.querySelectorAll(TagHighlighter.TAG_SELECTOR),
    ).map((a) => a.textContent);

    try {
      const response = await messaging.sendMessage(
        "processRegexTags",
        pageTags,
      );

      return response;
    } catch (error) {
      this.logger.error("Error collecting regex tags:", error);

      return [];
    }
  }

  private async collectCommonTags(): Promise<CommonTagResponse[]> {
    const pageTags = Array.from(
      document.querySelectorAll(TagHighlighter.TAG_SELECTOR),
    ).map((a) => a.textContent);

    try {
      const response = await messaging.sendMessage(
        "processCommonTags",
        pageTags,
      );

      return response;
    } catch (error) {
      this.logger.error("Error collecting common tags:", error);

      return [];
    }
  }

  /**
   * PreProcess phase: Add hide reasons as data attributes
   */
  private addHideReasons(): void {
    const works = document.querySelectorAll<HTMLElement>(
      TagHighlighter.WORK_SELECTOR,
    );

    if (works.length === 0) {
      this.logger.log("No work listings found, skipping hide reasons");

      return;
    }

    works.forEach((work) => {
      const tagElements = work.querySelectorAll<HTMLAnchorElement>(
        TagHighlighter.TAG_SELECTOR,
      );

      tagElements.forEach((tagElement) => {
        this.addHideReasonForTag(tagElement, work);
      });
    });
  }

  /**
   * Process phase: Apply visual modifications (colors and text content)
   */
  private applyVisualModifications(): void {
    const works = document.querySelectorAll<HTMLElement>(
      TagHighlighter.WORK_SELECTOR,
    );

    // If there are no works (e.g., on a tag search page without work listings),
    // we still want to highlight tags outside of work contexts
    if (works.length === 0) {
      this.logger.log("No work listings found, highlighting all tags on page");
      this.highlightAllTags();

      return;
    }

    const showSummary = this.settings.showTagColorSummary;

    if (showSummary) {
      this.injectSummaryStyles();
    }

    works.forEach((work) => {
      const title = work.querySelector("h4.heading>a");
      this.logger.log(
        `Applying highlights for work: ${String(title?.textContent)}`,
      );

      const tagElements = work.querySelectorAll<HTMLAnchorElement>(
        TagHighlighter.TAG_SELECTOR,
      );

      const resolvedColors: Array<string | null> = [];

      tagElements.forEach((tagElement) => {
        resolvedColors.push(this.applyTagHighlight(tagElement));
      });

      if (showSummary) {
        appendTagColorSummary(
          work,
          countTagColors(resolvedColors),
          this.settings.tagColorSummaryStyle,
        );
      }
    });
  }

  private injectSummaryStyles(): void {
    if (document.body.dataset.toyboxTagColorSummaryStyles) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.textContent = summaryStyles;
    document.head.appendChild(styleElement);
    document.body.dataset.toyboxTagColorSummaryStyles = "true";
  }

  private highlightAllTags(): void {
    const tagElements = document.querySelectorAll<HTMLAnchorElement>(
      TagHighlighter.TAG_SELECTOR,
    );

    tagElements.forEach((tagElement) => {
      this.applyTagHighlight(tagElement);
    });
  }

  private addHideReasonForTag(
    tagElement: HTMLAnchorElement,
    workElement: HTMLElement,
  ): void {
    const tag = tagElement.textContent;
    if (!tag) return;

    // The master switch suspends the whole hiding system (chips included)
    if (!this.settings.hideWorks) {
      return;
    }

    // Check if this tag should trigger hiding
    const commonTag = this.commonTagsMap.get(tag);
    const regexTag = this.regexTagsMap.get(tag);
    const hideWork =
      (commonTag?.hideWork ?? false) || (regexTag?.hideWork ?? false);
    const hideTag =
      (commonTag?.hideTag ?? false) || (regexTag?.hideTag ?? false);

    // If the tag itself should be hidden, mark it for hiding via data attribute
    if (hideTag) {
      tagElement.dataset.toyboxHideTag = "true";
    }

    // Work hiding additionally honors the excluded-tags hide mode
    if (this.settings.hideModes["excluded-tags"] === "none" || !hideWork) {
      return;
    }

    const tagName = tagElement.textContent;

    this.logger.log(`Marking work for hiding due to tag: ${tagName}`);

    markWorkForHiding(
      workElement,
      "excluded-tags",
      `Contains excluded tag: ${tagName}`,
    );
  }

  /**
   * Styles one tag link and returns the color it resolved to (common
   * config wins over regex), so callers can roll up per-work counts.
   * Hidden tags return null — they shouldn't leak into the summary.
   */
  private applyTagHighlight(tagElement: HTMLAnchorElement): string | null {
    const tag = tagElement.textContent;
    if (!tag) return null;

    // If this tag has been marked to be hidden, hide it regardless of color
    if (tagElement.dataset.toyboxHideTag === "true") {
      tagElement.style.display = "none";

      return null;
    }

    // First check common tags - O(1) lookup
    const commonTag = this.commonTagsMap.get(tag);

    if (commonTag?.color) {
      this.styleTag(tagElement, commonTag.color);

      // Update the text content to the real name if it's an alias; keep
      // the original so a live settings reset can restore it
      if (commonTag.realName !== tag) {
        tagElement.dataset.toyboxOriginalName ??= tag;
        tagElement.textContent = commonTag.realName;
      }

      return commonTag.color;
    }

    // Then check regex tags - O(1) lookup
    const regexTag = this.regexTagsMap.get(tag);

    if (regexTag?.color) {
      this.styleTag(tagElement, regexTag.color);

      return regexTag.color;
    }

    return null;
  }

  /** Inline-styles one tag, marked so onSettingsReset can find it. */
  private styleTag(tagElement: HTMLAnchorElement, color: string): void {
    if (color === "fade") {
      tagElement.style.backgroundColor = "";
      tagElement.style.color = "";
      tagElement.style.opacity = "0.5";
    } else {
      tagElement.style.backgroundColor = Color.getBackgroundColor(color);
      tagElement.style.color = Color.getForegroundColor(color);
      tagElement.style.opacity = "";
    }

    tagElement.dataset.toyboxHighlighted = "true";
  }
}
