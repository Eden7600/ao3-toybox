import type { WorkStatusRow } from "@src/common/work-status";
import Dexie from "dexie";
import type { CommonTag } from "../models/CommonTag";
import type { IgnoreListEntry } from "../models/IgnoreList";
import type { RegexTag } from "../models/RegexTag";
import type { Subscription } from "../models/Subscription";
class Database extends Dexie {
  public commonTags: Dexie.Table<CommonTag, number>;
  public regexTags: Dexie.Table<RegexTag, number>;
  public subscriptions: Dexie.Table<Subscription, number>;
  public ignoreList: Dexie.Table<IgnoreListEntry, number>;
  public workStatus: Dexie.Table<WorkStatusRow, string>;

  public constructor() {
    super("ReadersToybox");

    this.version(11).stores({
      commonTags: "++id, name",
      regexTags: "++id, name, regex",
      subscriptions: "id, name, url, author",
      ignoreList: "id, name, url, author",
    });

    // Version 12: Add caseInsensitive field to regexTags
    this.version(12)
      .stores({
        commonTags: "++id, name",
        regexTags: "++id, name, regex",
        subscriptions: "id, name, url, author",
        ignoreList: "id, name, url, author",
      })
      .upgrade((tx) => {
        // Set default value of caseInsensitive to false for existing tags
        return tx
          .table("regexTags")
          .toCollection()
          .modify((tag: RegexTag) => {
            tag.caseInsensitive ??= false;
          });
      });

    // Version 13: Split hide into hideWork and hideTag for tags
    this.version(13)
      .stores({
        commonTags: "++id, name",
        regexTags: "++id, name, regex",
        subscriptions: "id, name, url, author",
        ignoreList: "id, name, url, author",
      })
      .upgrade((tx) => {
        const migrateCommonTags = tx
          .table("commonTags")
          .toCollection()
          .modify((tag: CommonTag & { hide?: boolean }) => {
            if (typeof tag.hideWork === "undefined") {
              tag.hideWork = tag.hide ?? false;
            }

            if (typeof tag.hideTag === "undefined") {
              tag.hideTag = false;
            }
            // Legacy hide field can remain; it is no longer read
          });

        const migrateRegexTags = tx
          .table("regexTags")
          .toCollection()
          .modify((tag: RegexTag & { hide?: boolean }) => {
            if (typeof tag.hideWork === "undefined") {
              tag.hideWork = tag.hide ?? false;
            }

            if (typeof tag.hideTag === "undefined") {
              tag.hideTag = false;
            }
            // Legacy hide field can remain; it is no longer read
          });

        return Promise.all([migrateCommonTags, migrateRegexTags]);
      });

    // Version 14: Local-mode work status (visits, progress, ignore, position)
    this.version(14).stores({
      commonTags: "++id, name",
      regexTags: "++id, name, regex",
      subscriptions: "id, name, url, author",
      ignoreList: "id, name, url, author",
      workStatus: "workId",
    });

    this.commonTags = this.table("commonTags");
    this.regexTags = this.table("regexTags");
    this.subscriptions = this.table("subscriptions");
    this.ignoreList = this.table("ignoreList");
    this.workStatus = this.table("workStatus");
  }
}

export const db = new Database();
