import { serverFeaturesEnabled } from "@src/common/build-env";
import { parseTagPage, type ParsedTagRef } from "@src/common/tag-page";
import { TagAliasStatus, TagType } from "@src/types/tags";
import { ContentScript } from "../content-script";

export default class TagDetailsObserver extends ContentScript {
  getEnabled(): boolean {
    if (!serverFeaturesEnabled || !this.settings.connectToServer) {
      return false;
    }

    return /\/tags\/.*(?<!\/works)$/.test(window.location.pathname);
  }

  async onPreProcess(): Promise<void> {
    try {
      const tagData = this.scrapeTagData();

      if (!tagData) {
        return;
      }

      await this.sendTagToServer(tagData);
    } catch (error) {
      this.logger.error("Failed to process tag page:", error);
    }
  }

  private scrapeTagData() {
    const parsed = parseTagPage(document);

    // Pages without a recognizable tag profile or category are skipped,
    // matching the previous scraper's bail-outs.
    if (!parsed || parsed.type === TagType.UNKNOWN) {
      return null;
    }

    const toServerTag = (tag: ParsedTagRef) => ({
      name: tag.name,
      type: tag.type,
      url: tag.url,
    });

    return {
      primaryTag: {
        name: parsed.name,
        type: parsed.type,
        url: window.location.pathname,
        aliasStatus: parsed.canonical
          ? TagAliasStatus.CANONICAL
          : TagAliasStatus.ORPHANED,
      },
      parentTags: parsed.parents.map(toServerTag),
      aliasTags: parsed.synonyms.map(toServerTag),
      childTags: parsed.children.map(toServerTag),
      metaTags: parsed.metas.map(toServerTag),
    };
  }

  private async sendTagToServer(
    tagData: NonNullable<ReturnType<TagDetailsObserver["scrapeTagData"]>>,
  ) {
    // Server sync is currently disabled; the commented block below is the
    // eventual implementation
    this.logger.log("Collected tag data (server sync disabled)", tagData);

    // Try {
    //   // Import the auth service
    //   const { authService } = await import("@src/common/services/auth-service");
    //   const response = await authService.authenticatedFetch(
    //     await authService.apiUrl("/tags/bulk"),
    //     {
    //       method: "PATCH",
    //       headers: {
    //         "Content-Type": "application/json",
    //       },
    //       body: JSON.stringify(tagData),
    //     },
    //   );
    //   if (!response.ok) {
    //     throw new Error(`HTTP error! status: ${String(response.status)}`);
    //   }
    // } catch (error) {
    //   this.logger.error("Failed to send tag data to server:", error);
    // }
  }
}
