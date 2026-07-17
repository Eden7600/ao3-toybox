import { serverFeaturesEnabled } from "@src/common/build-env";
import { cleanTagUrl } from "@src/common/clean-urls";
import { markdownService } from "@src/common/markdown";
import {
  authService,
  isServerNotConfiguredError,
} from "@src/common/services/auth-service";
import { getCategoryUrl, getRatingUrl } from "@src/common/tags";
import { TagType, type TagRecord } from "@src/types/tags";
import type { WorkData } from "@src/types/work-scraper";
import { ContentScript } from "../content-script";

type AuthorData = {
  name: string;
  url: string | undefined;
};

type Stats = {
  language: string;
  wordCount: number;
  chapterCount: number;
  isComplete: boolean;
  kudos: number | null;
  hits: number | null;
  bookmarks: number | null;
  comments: number | null;
};

export default class WorkListingObserver extends ContentScript {
  private scrapedWorks: WorkData[] = [];

  getEnabled(): boolean {
    if (!serverFeaturesEnabled || !this.settings.connectToServer) {
      return false;
    }

    this.logger.log("Checking if work listing observer is enabled");

    const urlPatterns = [
      /\/works\/\d+$/,
      /\/tags\/.*\/works/,
      /\/users\/.*\/works/,
      /\/collections\/.*\/works/,
    ];

    // Check pathname against simple patterns
    const isEnabledByPathname = urlPatterns.some((pattern) =>
      pattern.test(window.location.pathname),
    );

    // Special case for the works filter page
    const isFilterPage =
      window.location.pathname === "/works" &&
      window.location.search.includes("commit=Sort+and+Filter");

    const isEnabled = isEnabledByPathname || isFilterPage;

    this.logger.log(
      "Work listing observer is enabled",
      isEnabled,
      window.location.pathname,
      window.location.search,
    );

    return isEnabled;
  }

  async onInitialize(): Promise<void> {
    const workListings = document.querySelectorAll("li.work.blurb.group");

    this.scrapedWorks = [];

    this.logger.log("Scraping works", workListings);

    workListings.forEach((work) => {
      try {
        const workData = this.scrapeWork(work);

        if (workData) {
          this.scrapedWorks.push(workData);
        }
      } catch (error) {
        this.logger.error("Failed to scrape work", error);
      }
    });
  }

  async onPostProcess(): Promise<void> {
    if (this.scrapedWorks.length > 0) {
      await this.sendWorksToServer(this.scrapedWorks);
      this.scrapedWorks = []; // Clear after sending
    }
  }

  private scrapeWork(work: Element): WorkData | null {
    // Extract work ID from the element's ID attribute
    const workId = work.id.replace("work_", "");
    if (!workId) return null;

    // Get basic work info
    const title = work.querySelector("h4.heading a")?.textContent.trim() ?? "";

    // Get author links and extract data
    const authors: AuthorData[] = Array.from(
      work.querySelectorAll<HTMLAnchorElement>("h4.heading a[rel='author']"),
    ).map(({ pathname }) => ({
      name: pathname.split("/")[2] ?? "",
      url: pathname,
    }));

    // If no authors found, add Anonymous author
    if (authors.length === 0) {
      authors.push({
        name: "Anonymous",
        url: undefined,
      });
    }

    // Get fandom tags in same format as other tags
    const fandomTags = Array.from(
      work.querySelectorAll("h5.fandoms a.tag"),
    ).map((tag) => ({
      name: tag.textContent.trim(),
      type: TagType.FANDOM,
      url: (tag as HTMLAnchorElement).pathname || "",
      typeConfidence: 10,
    }));

    // Get summary and convert HTML to markdown
    const summary = this.extractSummaryAsMarkdown(work);

    // Get statistics
    const stats = this.scrapeStats(work);

    // Get tags and combine with fandom tags and required tags

    const tags: TagRecord[] = [
      ...fandomTags,
      ...this.scrapeTags(work),
      ...this.scrapeRequiredTags(work),
    ];

    // Get dates
    const dateText = work.querySelector("p.datetime")?.textContent;
    const publishedAt = dateText ? new Date(dateText) : new Date();

    return {
      id: workId,
      title,
      authors,
      summary,
      ...stats,
      tags,
      publishedAt,
      updatedAt: new Date(), // Current time as update time
    };
  }

  private extractSummaryAsMarkdown(work: Element): string | null {
    return markdownService.extractSummaryAsMarkdown(work, "blockquote.summary");
  }

  private scrapeStats(work: Element): Stats {
    const stats: Stats = {
      language: "English", // Default to English
      wordCount: 0,
      chapterCount: 0,
      isComplete: false,
      kudos: null,
      hits: null,
      bookmarks: null,
      comments: null,
    };

    // Extract stats from the dl.stats element
    const statsElement = work.querySelector("dl.stats");

    if (statsElement) {
      // Language
      stats.language =
        statsElement.querySelector("dd.language")?.textContent.trim() ??
        "English";

      // Word count
      const wordsText = statsElement.querySelector("dd.words")?.textContent;
      stats.wordCount = wordsText
        ? parseInt(wordsText.replace(/,/g, ""), 10)
        : 0;

      // Chapters
      const chaptersText =
        statsElement.querySelector("dd.chapters")?.textContent;

      if (chaptersText) {
        const [current, total] = chaptersText.split("/");
        stats.chapterCount = parseInt(current, 10) || 0;
        stats.isComplete = total !== "?";
      }

      // Other stats
      stats.kudos = this.extractNumber(statsElement, "dd.kudos");
      stats.hits = this.extractNumber(statsElement, "dd.hits");
      stats.bookmarks = this.extractNumber(statsElement, "dd.bookmarks");
      stats.comments = this.extractNumber(statsElement, "dd.comments");
    }

    return stats;
  }

  private scrapeTags(work: Element): TagRecord[] {
    const tags: TagRecord[] = [];
    const tagsList = work.querySelector("ul.tags.commas");

    if (tagsList) {
      // Process each tag category
      const tagCategories = {
        warnings: TagType.WARNING,
        rating: TagType.RATING,
        relationships: TagType.RELATIONSHIP,
        characters: TagType.CHARACTER,
        freeforms: TagType.FREEFORM,
      };

      Object.entries(tagCategories).forEach(([className, tagType]) => {
        const categoryTags = tagsList.querySelectorAll(`li.${className} a.tag`);
        categoryTags.forEach((tag) => {
          const name = tag.textContent.trim();
          let url = (tag as HTMLAnchorElement).pathname || "";

          // Use cleanTagUrl to remove /works suffix
          url = cleanTagUrl(url);

          if (name) {
            tags.push({ name, type: tagType, url, typeConfidence: 10 });
          }
        });
      });
    }

    return tags;
  }

  private scrapeRequiredTags(work: Element): TagRecord[] {
    const tags: TagRecord[] = [];
    const requiredTagsList = work.querySelector("ul.required-tags");

    if (requiredTagsList) {
      const requiredTagItems = requiredTagsList.querySelectorAll("li");

      requiredTagItems.forEach((item) => {
        const span = item.querySelector(
          "span[class*='rating-'], span[class*='category-']",
        );

        if (span) {
          const textSpan = span.querySelector("span.text");
          const text = textSpan?.textContent.trim();

          if (text) {
            // Determine if this is a rating or category based on the span class
            const spanClass = span.className;

            if (spanClass.includes("rating-")) {
              // This is a rating tag
              tags.push({
                name: text,
                type: TagType.RATING,
                url: getRatingUrl(text),
                typeConfidence: 10,
              });
            } else if (spanClass.includes("category-")) {
              // This is a category tag - could be multiple categories separated by commas
              const categories = text.split(",").map((cat) => cat.trim());

              categories.forEach((category) => {
                if (category) {
                  tags.push({
                    name: category,
                    type: TagType.CATEGORY,
                    url: getCategoryUrl(category),
                    typeConfidence: 10,
                  });
                }
              });
            }
          }
        }
      });
    }

    return tags;
  }

  private extractNumber(element: Element, selector: string): number {
    const text = element.querySelector(selector)?.textContent;
    if (!text) return 0;

    return parseInt(text.replace(/,/g, ""), 10) || 0;
  }

  private async sendWorksToServer(works: WorkData[]) {
    try {
      const response = await authService.authenticatedFetch(
        await authService.apiUrl("/api/fanfic/works/bulk-import"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(works),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${String(response.status)}`);
      }

      this.logger.log(
        `Successfully sent ${String(works.length)} works to server`,
      );
    } catch (error) {
      if (isServerNotConfiguredError(error)) {
        return;
      }

      this.logger.error("Failed to send works to server", error);
    }
  }
}
