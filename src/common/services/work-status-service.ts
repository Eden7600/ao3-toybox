import { serverFeaturesEnabled } from "@src/common/build-env";
import { messaging } from "@src/common/messaging";
import type { ReadingPosition } from "@src/common/reading-position";
import {
  authService,
  isServerNotConfiguredError,
} from "@src/common/services/auth-service";
import type { Settings } from "@src/common/settings";
import type {
  WorkStatus,
  WorkStatusMap,
  WorkStatusResponse,
} from "@src/common/work-status";
import type { WorkVisitPayload } from "@src/types/work-visit";

const MAX_IDS_PER_REQUEST = 100;

type ModeSettings = Pick<Settings, "connectToServer">;

// Server mode requires both the user setting and a build that ships the
// server features (SERVER_FEATURES=disabled builds are local-only).
function useServer(settings: ModeSettings): boolean {
  return serverFeaturesEnabled && settings.connectToServer;
}

/**
 * Single door for per-work reading status. With the server connection on,
 * everything goes to the API and local data is neither read nor written;
 * otherwise everything stays in the extension's local store via background
 * messaging and no network requests are made. Server failures return null
 * (features simply don't render) — there is deliberately no cross-mode
 * fallback, so the two datasets never mix.
 */
export const workStatusService = {
  async getStatuses(
    settings: ModeSettings,
    workIds: string[],
  ): Promise<WorkStatusMap | null> {
    if (!useServer(settings)) {
      return messaging.sendMessage("getLocalWorkStatuses", workIds);
    }

    const batches: string[][] = [];

    for (let i = 0; i < workIds.length; i += MAX_IDS_PER_REQUEST) {
      batches.push(workIds.slice(i, i + MAX_IDS_PER_REQUEST));
    }

    try {
      const results = await Promise.all(
        batches.map(async (batch) => {
          const response = await authService.authenticatedFetch(
            await authService.apiUrl("/api/fanfic/works/status"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ work_ids: batch }),
            },
          );

          if (!response.ok) {
            throw new Error(
              `Work status request failed: ${String(response.status)}`,
            );
          }

          const data = (await response.json()) as WorkStatusResponse;

          return data.works;
        }),
      );

      const statuses: WorkStatusMap = {};
      results.forEach((works) => {
        Object.assign(statuses, works);
      });

      return statuses;
    } catch (error) {
      logUnlessNotConfigured(error);

      return null;
    }
  },

  async getStatus(
    settings: ModeSettings,
    workId: string,
  ): Promise<WorkStatus | null> {
    const statuses = await this.getStatuses(settings, [workId]);

    return statuses?.[workId] ?? null;
  },

  /** Returns false when the visit could not be recorded. */
  async sendVisit(
    settings: ModeSettings,
    payload: WorkVisitPayload,
  ): Promise<boolean> {
    if (!useServer(settings)) {
      await messaging.sendMessage("recordLocalVisit", {
        workId: payload.workId,
        chapter: payload.currentChapter,
        subscribed: payload.currentlySubscribed,
      });

      return true;
    }

    try {
      const response = await authService.authenticatedFetch(
        await authService.apiUrl("/api/fanfic/visit"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${String(response.status)}`);
      }

      return true;
    } catch (error) {
      logUnlessNotConfigured(error);

      return false;
    }
  },

  /** Throws on failure so callers can surface the error in their UI. */
  async setIgnored(
    settings: ModeSettings,
    workId: string,
    ignored: boolean,
  ): Promise<void> {
    if (!useServer(settings)) {
      await messaging.sendMessage("setLocalIgnored", { workId, ignored });

      return;
    }

    const response = await authService.authenticatedFetch(
      await authService.apiUrl("/api/fanfic/ignore"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workId, status: ignored }),
      },
    );

    if (!response.ok) {
      throw new Error(`Ignore request failed: ${String(response.status)}`);
    }
  },

  /** Returns false when the update could not be recorded. */
  async setSubscribed(
    settings: ModeSettings,
    workId: string,
    subscribed: boolean,
  ): Promise<boolean> {
    if (!useServer(settings)) {
      await messaging.sendMessage("setLocalSubscribed", {
        workId,
        subscribed,
      });

      return true;
    }

    try {
      const response = await authService.authenticatedFetch(
        await authService.apiUrl("/api/fanfic/subscribe"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workId, status: subscribed }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${String(response.status)}`);
      }

      return true;
    } catch (error) {
      logUnlessNotConfigured(error);

      return false;
    }
  },

  /** Throws on failure so callers can surface the error in their UI. */
  async resetHighestChapter(
    settings: ModeSettings,
    workId: string,
    chapter: number,
  ): Promise<{ last_chapter: number; highest_chapter: number }> {
    if (!useServer(settings)) {
      const status = await messaging.sendMessage("resetLocalHighestChapter", {
        workId,
        chapter,
      });

      return {
        last_chapter: status.last_chapter ?? chapter,
        highest_chapter: status.highest_chapter ?? chapter,
      };
    }

    const response = await authService.authenticatedFetch(
      await authService.apiUrl(`/api/fanfic/works/${workId}/highest-chapter`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter }),
      },
    );

    if (!response.ok) {
      throw new Error(`Progress reset failed: ${String(response.status)}`);
    }

    return (await response.json()) as {
      last_chapter: number;
      highest_chapter: number;
    };
  },

  /** Returns false when the position could not be recorded. */
  async sendReadingPosition(
    settings: ModeSettings,
    workId: string,
    position: ReadingPosition,
    keepalive: boolean,
  ): Promise<boolean> {
    if (!useServer(settings)) {
      await messaging.sendMessage("setLocalReadingPosition", {
        workId,
        position,
      });

      return true;
    }

    try {
      const response = await authService.authenticatedFetch(
        await authService.apiUrl(
          `/api/fanfic/works/${workId}/reading-position`,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapter: position.chapter,
            paragraph: position.paragraph,
            paragraphCount: position.paragraph_count,
            offset: position.offset,
          }),
          keepalive,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Reading position update failed: ${String(response.status)}`,
        );
      }

      return true;
    } catch (error) {
      logUnlessNotConfigured(error);

      return false;
    }
  },
};

function logUnlessNotConfigured(error: unknown): void {
  if (!isServerNotConfiguredError(error)) {
    console.warn("[work-status-service]", error);
  }
}
