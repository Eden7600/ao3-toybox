<script setup lang="ts">
import {
  backupFilename,
  buildBackup,
  parseBackup,
  planNaturalKeyImport,
  planWorkStatusImport,
  sanitizeImportedSettings,
} from "@src/common/backup";
import { db } from "@src/common/db/Database";
import { Logger } from "@src/common/logger";
import type { CommonTag } from "@src/common/models/CommonTag";
import type { RegexTag } from "@src/common/models/RegexTag";
import {
  defaultSettings,
  getAllSettings,
  resetAllSettings,
  setAllSettings,
} from "@src/common/settings";
import ExportToggle from "@src/options_ui/components/ExportToggle.vue";
import { Download, Trash2 } from "@lucide/vue";
import { saveAs } from "file-saver";
import { ref } from "vue";

import { Button, useToast } from "@src/common/ui";

const toast = useToast();
const logger = new Logger("ExportImport");

const exportSubscriptions = ref(true);
const exportTags = ref(true);
const exportRegexTags = ref(true);
const exportIgnoreList = ref(true);
const exportWorkStatus = ref(true);
const exportSettings = ref(true);

const importWipeExisting = ref(false);
const importSubscriptions = ref(true);
const importTags = ref(true);
const importRegexTags = ref(true);
const importIgnoreList = ref(true);
const importWorkStatus = ref(true);
const importSettings = ref(true);
const importResult = ref("");
const importWarnings = ref<string[]>([]);

const wipeSubscriptions = ref(false);
const wipeTags = ref(false);
const wipeRegexTags = ref(false);
const wipeIgnoreList = ref(false);
const wipeWorkStatus = ref(false);
const wipeSettings = ref(false);

const importData = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;

  if (!files || files.length === 0) {
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    void runImport(e.target?.result as string);
  };
  reader.readAsText(files[0]);
};

const runImport = async (text: string) => {
  importResult.value = "";
  importWarnings.value = [];

  try {
    const { sections, warnings } = parseBackup(text);
    const counts: string[] = [];
    importWarnings.value = warnings;

    if (importSubscriptions.value && sections.subscriptions) {
      if (importWipeExisting.value) {
        await db.subscriptions.clear();
      }

      // AO3-id-keyed table: put by id is the correct merge
      await db.subscriptions.bulkPut(
        sections.subscriptions as Parameters<
          typeof db.subscriptions.bulkPut
        >[0],
      );
      counts.push(`${String(sections.subscriptions.length)} subscriptions`);
    }

    if (importTags.value && sections.commonTags) {
      if (importWipeExisting.value) {
        await db.commonTags.clear();
      }

      // Match by tag name, never by autoincrement id — ids from another
      // browser would clobber unrelated rows
      const plan = planNaturalKeyImport<CommonTag>(
        await db.commonTags.toArray(),
        sections.commonTags,
        (tag) => tag.name,
      );

      await db.commonTags.bulkPut(plan.toUpdate);
      await db.commonTags.bulkAdd(plan.toAdd);
      counts.push(
        `${String(plan.toAdd.length + plan.toUpdate.length)} common tags`,
      );
    }

    if (importRegexTags.value && sections.regexTags) {
      if (importWipeExisting.value) {
        await db.regexTags.clear();
      }

      // A regex tag's identity is its pattern
      const plan = planNaturalKeyImport<RegexTag>(
        await db.regexTags.toArray(),
        sections.regexTags,
        (tag) => tag.regex,
      );

      await db.regexTags.bulkPut(plan.toUpdate);
      await db.regexTags.bulkAdd(plan.toAdd);
      counts.push(
        `${String(plan.toAdd.length + plan.toUpdate.length)} regex tags`,
      );
    }

    if (importIgnoreList.value && sections.ignoreList) {
      if (importWipeExisting.value) {
        await db.ignoreList.clear();
      }

      await db.ignoreList.bulkPut(
        sections.ignoreList as Parameters<typeof db.ignoreList.bulkPut>[0],
      );
      counts.push(`${String(sections.ignoreList.length)} ignore list entries`);
    }

    if (importWorkStatus.value && sections.workStatus) {
      if (importWipeExisting.value) {
        await db.workStatus.clear();
      }

      // Furthest-wins ratchet merge: an older backup never regresses progress
      const plan = planWorkStatusImport(
        importWipeExisting.value ? [] : await db.workStatus.toArray(),
        sections.workStatus,
      );

      await db.workStatus.bulkPut(plan.rows);
      counts.push(`${String(plan.rows.length)} reading history entries`);
    }

    if (importSettings.value && sections.settings) {
      const { settings, droppedToken } = sanitizeImportedSettings(
        sections.settings,
        defaultSettings,
      );

      await setAllSettings({ ...defaultSettings, ...settings });
      counts.push("settings");

      if (droppedToken) {
        toast.add({
          severity: "info",
          summary: "API token not restored",
          detail:
            "Re-enter your token in Server Settings to resume server sync.",
          life: 6000,
        });
      }
    }

    importResult.value =
      counts.length > 0
        ? `Imported ${counts.join(", ")}`
        : "Nothing to import (no enabled sections found in the file)";
  } catch (error) {
    logger.error("Failed to import file", error);
    importResult.value = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const exportData = async () => {
  try {
    const now = new Date();
    const json = buildBackup(
      {
        ...(exportSubscriptions.value && {
          subscriptions: await db.subscriptions.toArray(),
        }),
        ...(exportTags.value && { commonTags: await db.commonTags.toArray() }),
        ...(exportRegexTags.value && {
          regexTags: await db.regexTags.toArray(),
        }),
        ...(exportIgnoreList.value && {
          ignoreList: await db.ignoreList.toArray(),
        }),
        ...(exportWorkStatus.value && {
          workStatus: await db.workStatus.toArray(),
        }),
        // Redact credentials: never write the token into a shareable export
        ...(exportSettings.value && {
          settings: { ...(await getAllSettings()), apiToken: "" },
        }),
      },
      now.toISOString(),
    );

    saveAs(
      new Blob([json], { type: "application/json" }),
      backupFilename(now),
    );
  } catch (error) {
    logger.error("Failed to export data", error);
    toast.add({
      severity: "error",
      summary: "Export failed",
      detail: error instanceof Error ? error.message : String(error),
      life: 5000,
    });
  }
};

const wipeData = async () => {
  if (wipeSubscriptions.value) {
    await db.subscriptions.clear();
  }

  if (wipeTags.value) {
    await db.commonTags.clear();
  }

  if (wipeRegexTags.value) {
    await db.regexTags.clear();
  }

  if (wipeIgnoreList.value) {
    await db.ignoreList.clear();
  }

  if (wipeWorkStatus.value) {
    await db.workStatus.clear();
  }

  if (wipeSettings.value) {
    await resetAllSettings();
  }
};
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg mb-4">
    <h1 class="text-2xl font-bold text-white">Import / Export</h1>
    <p class="text-gray-400 text-lg">
      Back up your data to a file, or move it to another browser. Imports merge
      with what's already here — reading progress is never lost to an older
      backup.
    </p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="bg-surface-900 rounded-lg p-4 lg:row-span-2">
      <h2 class="text-xl font-bold text-white px-2">Import</h2>
      <p class="text-gray-400 px-2">Import your data from a file</p>
      <div class="text-white divide-y divide-surface-800 mt-2">
        <ExportToggle v-model="importTags" label="Common tags" id="importTags" />
        <ExportToggle v-model="importRegexTags" label="Regex tags" id="importRegexTags" />
        <ExportToggle v-model="importWorkStatus" label="Reading history" id="importWorkStatus" />
        <ExportToggle v-model="importSettings" label="Settings" id="importSettings" />
        <ExportToggle v-model="importSubscriptions" label="Subscriptions" id="importSubscriptions" />
        <ExportToggle v-model="importIgnoreList" label="Ignore list" id="importIgnoreList" />
        <ExportToggle v-model="importWipeExisting" label="Wipe existing data first" id="importWipeExisting" />
      </div>
      <div class="mt-2 mx-2">
        <label class="block mb-2 text-sm font-medium text-white" for="file_input">Upload file</label>
        <input
          type="file"
          accept=".json,application/json"
          @change="importData"
          class="block w-full text-sm border rounded-lg cursor-pointer text-gray-400 focus:outline-none bg-surface-800 border-surface-700 placeholder-gray-400"
        />
      </div>

      <div v-if="importResult" class="mt-2 mx-2">
        <p class="text-white">{{ importResult }}</p>
        <p v-for="warning in importWarnings" :key="warning" class="text-yellow-400 text-sm">
          ⚠ {{ warning }}
        </p>
      </div>
    </div>

    <div class="bg-surface-900 rounded-lg p-4">
      <h2 class="text-xl font-bold text-white px-2">Export</h2>
      <p class="text-gray-400 px-2">Export your data to a file</p>
      <div class="text-white divide-y divide-surface-800 mt-2">
        <ExportToggle v-model="exportTags" label="Common tags" id="exportTags" />
        <ExportToggle v-model="exportRegexTags" label="Regex tags" id="exportRegexTags" />
        <ExportToggle v-model="exportWorkStatus" label="Reading history" id="exportWorkStatus" />
        <ExportToggle v-model="exportSettings" label="Settings" id="exportSettings" />
        <ExportToggle v-model="exportSubscriptions" label="Subscriptions" id="exportSubscriptions" />
        <ExportToggle v-model="exportIgnoreList" label="Ignore list" id="exportIgnoreList" />
        <Button class="mx-2 mt-2" @click="exportData">
          <Download class="w-4 h-4" aria-hidden="true" />
          Export Data
        </Button>
      </div>
    </div>

    <div class="bg-surface-900 rounded-lg p-4">
      <h2 class="text-xl font-bold text-white px-2">Wipe / Erase</h2>
      <p class="text-gray-400 px-2">Clear your data from the system</p>
      <div class="text-white divide-y divide-surface-800 mt-2">
        <ExportToggle v-model="wipeTags" label="Common tags" id="wipeTags" />
        <ExportToggle v-model="wipeRegexTags" label="Regex tags" id="wipeRegexTags" />
        <ExportToggle v-model="wipeWorkStatus" label="Reading history" id="wipeWorkStatus" />
        <ExportToggle v-model="wipeSettings" label="Settings" id="wipeSettings" />
        <ExportToggle v-model="wipeSubscriptions" label="Subscriptions" id="wipeSubscriptions" />
        <ExportToggle v-model="wipeIgnoreList" label="Ignore list" id="wipeIgnoreList" />
        <Button variant="danger" class="mx-2 mt-2" @click="wipeData">
          <Trash2 class="w-4 h-4" aria-hidden="true" />
          Destroy Data
        </Button>
      </div>
    </div>
  </div>
</template>
