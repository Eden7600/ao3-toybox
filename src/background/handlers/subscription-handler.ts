import { db } from "@src/common/db/Database";
import { Logger } from "@src/common/logger";
import type { Subscription } from "@src/common/models/Subscription";

const logger = new Logger("BG-Subscription");

export class SubscriptionHandler {
  async checkIdsAgainstSubscriptions(ids: number[]): Promise<Subscription[]> {
    try {
      return await db.subscriptions
        .where("id")
        .anyOf(...ids)
        .toArray();
    } catch (error) {
      logger.error("Error in checkIdsAgainstSubscriptions:", error);
      throw new Error("Failed to check IDs against subscriptions", {
        cause: error,
      });
    }
  }

  async scrapeSubscriptionsPage(data: Subscription[]): Promise<void> {
    try {
      await db.transaction("rw", db.subscriptions, async () => {
        await db.subscriptions.bulkPut(data);
      });
    } catch (error) {
      logger.error("Error in scrapeSubscriptionsPage:", error);
      throw new Error("Failed to scrape and update subscriptions", {
        cause: error,
      });
    }
  }

  async addSingleSubscription(data: Subscription): Promise<void> {
    try {
      await db.transaction("rw", db.subscriptions, async () => {
        await db.subscriptions.put(data);
      });
    } catch (error) {
      logger.error("Error in addSingleSubscription:", error);
      throw new Error("Failed to add a single subscription", {
        cause: error,
      });
    }
  }

  async removeSingleSubscription(id: number): Promise<void> {
    try {
      await db.transaction("rw", db.subscriptions, async () => {
        await db.subscriptions.delete(id);
      });
    } catch (error) {
      logger.error("Error in removeSingleSubscription:", error);
      throw new Error("Failed to remove the subscription", {
        cause: error,
      });
    }
  }

  async fetchAllSubscriptions(): Promise<Subscription[]> {
    try {
      return await db.subscriptions.toArray();
    } catch (error) {
      logger.error("Error in fetchAllSubscriptions:", error);
      throw new Error("Failed to fetch all subscriptions", {
        cause: error,
      });
    }
  }
}
