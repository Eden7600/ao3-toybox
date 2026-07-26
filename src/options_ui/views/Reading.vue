<script setup lang="ts">
import { progressBarColorOptions } from "@src/common/progress-bar";
import ProgressBarPreview from "@src/options_ui/components/ProgressBarPreview.vue";
import ReadingSpeedTest from "@src/options_ui/components/ReadingSpeedTest.vue";
import SettingsDropdown from "@src/options_ui/components/SettingsDropdown.vue";
import SettingsNumber from "@src/options_ui/components/SettingsNumber.vue";
import SettingsToggle from "@src/options_ui/components/SettingsToggle.vue";
import { useOptionsSettings } from "@src/options_ui/useOptionsSettings";
import { useToast } from "@src/common/ui";

const { settings } = useOptionsSettings("Reading");
const toast = useToast();

const progressBarPositionOptions = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const progressBarStyleOptions = [
  { value: "gradient", label: "Gradient" },
  { value: "solid", label: "Solid" },
];

const progressBarColorPickerOptions = progressBarColorOptions.map(
  (option) => ({ value: option.id, label: option.label }),
);

const progressBarScopeOptions = [
  { value: "work", label: "Whole work" },
  { value: "chapter", label: "Current chapter" },
];

const progressBarLabelOptions = [
  { value: "none", label: "None" },
  { value: "percent", label: "Percent read" },
  { value: "time", label: "Time remaining" },
  { value: "percent-time", label: "Percent + time" },
];

const adoptWpm = (wpm: number) => {
  settings.value.readingWpm = wpm;
  toast.add({
    severity: "success",
    summary: "Reading speed updated",
    detail: `Set to ${String(wpm)} words per minute`,
    life: 3000,
  });
};
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg flex items-center justify-between">
    <div class="flex flex-col">
      <h1 class="text-2xl font-bold text-white">Reading</h1>
      <p class="text-gray-400 text-lg">
        Your reading speed, time estimates, and reading comforts
      </p>
    </div>
  </div>

  <!-- Reading Speed -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">Reading Speed</h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsNumber
        v-model="settings.readingWpm"
        label="Words per Minute"
        description="Drives every reading-time estimate. The average adult reads around 250 WPM"
        :min="50"
        :max="2000"
        :step="10"
      />
      <ReadingSpeedTest
        :currentWpm="settings.readingWpm"
        @adopt="adoptWpm"
      />
    </div>
  </div>

  <!-- Reading Time Display -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">
      Reading Time Display
    </h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.showBlurbReadingTime"
        label="Reading Time on Listings"
        description="Add a total reading-time stat to work blurbs, from the work's word count and your speed"
      />
      <SettingsToggle
        v-model="settings.showBlurbFinishAt"
        label="Finish Time on Listings"
        description="Add a 'Finish At' clock-time stat to work blurbs — when you'd be done if you started now"
      />
      <SettingsToggle
        v-model="settings.enableChapterStats"
        label="Chapter Stats While Reading"
        description="Show a line above each chapter with its word count, reading time, and finish time"
      />
    </div>
  </div>

  <!-- Reading Page -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">Reading Page</h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.enableReaderSettings"
        label="Enable Improved Reading Experience"
        description="Enabling this option lets you change the font size, line height, and other reading settings directly on the reading page"
      />
      <SettingsToggle
        v-model="settings.showBottomWorkToolbar"
        label="Repeat Toolbar Below Chapters"
        description="Show the work toolbar again at the bottom of the chapter, so subscribe, bookmark, share, and next chapter are at hand when you finish reading"
      />
      <SettingsToggle
        v-model="settings.showReturnToTopButton"
        label="Return-to-Top Button"
        description="Add a return-to-top button joined to the reading settings gear in the corner of work pages"
      />
    </div>
  </div>

  <!-- Progress Bar -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">Progress Bar</h2>
    <p class="text-gray-400 text-sm">
      The preview below follows every setting — drag the slider to simulate
      reading, and click the bar to try click-to-jump when it's enabled.
    </p>
    <ProgressBarPreview :settings="settings" />
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.enableProgressBar"
        label="Show Reading Progress Bar"
        description="Show a progress bar along a screen edge while reading a work"
      />
      <SettingsDropdown
        v-model="settings.progressBarPosition"
        label="Position"
        description="Which edge of the screen the bar sits on"
        :options="progressBarPositionOptions"
        :disabled="!settings.enableProgressBar"
      />
      <SettingsNumber
        v-model="settings.progressBarThickness"
        label="Thickness"
        description="Bar thickness in pixels"
        :min="2"
        :max="24"
        :step="1"
        :disabled="!settings.enableProgressBar"
      />
      <SettingsNumber
        v-model="settings.progressBarOffset"
        label="Edge Offset"
        description="Inset from the screen edge in pixels — useful to clear floating browser UI"
        :min="0"
        :max="48"
        :step="2"
        :disabled="!settings.enableProgressBar"
      />
      <SettingsDropdown
        v-model="settings.progressBarStyle"
        label="Fill Style"
        description="A gradient along the reading direction, or a flat fill"
        :options="progressBarStyleOptions"
        :disabled="!settings.enableProgressBar"
      />
      <SettingsDropdown
        v-model="settings.progressBarColor"
        label="Fill Color"
        description="Follow your theme accent, or pick a fixed color"
        :options="progressBarColorPickerOptions"
        :disabled="!settings.enableProgressBar"
      />
      <SettingsDropdown
        v-model="settings.progressBarScope"
        label="Measure Progress Through"
        description="Fill against the whole work, or restart the bar for the chapter you're reading"
        :options="progressBarScopeOptions"
        :disabled="!settings.enableProgressBar"
      />
      <SettingsToggle
        v-model="settings.progressBarShowChapterMarkers"
        label="Chapter Markers"
        description="Tick marks on the bar at chapter boundaries (whole-work measure only)"
        :disabled="
          !settings.enableProgressBar || settings.progressBarScope === 'chapter'
        "
      />
      <SettingsDropdown
        v-model="settings.progressBarLabelMode"
        label="Progress Label"
        description="A small label riding the bar: percent read, estimated time remaining at your reading speed, or both"
        :options="progressBarLabelOptions"
        :disabled="!settings.enableProgressBar"
      />
      <SettingsToggle
        v-model="settings.progressBarClickToSeek"
        label="Click to Jump"
        description="Clicking a point on the bar scrolls the page to that part of the work"
        :disabled="!settings.enableProgressBar"
      />
    </div>
  </div>

  <!-- Your Name -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">Your Name</h2>
    <p class="text-gray-400 pb-2">
      For reader-insert works: replaces Y/N, YN, F/N, and Y/F/N with your
      first name, and L/N and Y/L/N with your last name, throughout the work
      text. Nothing happens until a name is filled in.
    </p>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.enableYnReplacer"
        label="Replace Name Placeholders"
        description="Swap the placeholder tokens for your names while reading works"
      />
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4"
      >
        <div class="flex flex-col flex-grow">
          <label
            for="yn-first-name"
            class="text-lg font-semibold text-white cursor-pointer"
          >
            First Name
          </label>
          <p class="text-base font-normal text-gray-400 mt-1">
            Used for Y/N, YN, F/N, and Y/F/N
          </p>
        </div>
        <input
          id="yn-first-name"
          v-model.lazy="settings.ynFirstName"
          type="text"
          placeholder="Your first name"
          :disabled="!settings.enableYnReplacer"
          class="w-full sm:w-[16rem] px-3 py-2 rounded-md bg-surface-800 border border-surface-700 text-white placeholder-gray-500 disabled:opacity-50"
        />
      </div>
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4"
      >
        <div class="flex flex-col flex-grow">
          <label
            for="yn-last-name"
            class="text-lg font-semibold text-white cursor-pointer"
          >
            Last Name
          </label>
          <p class="text-base font-normal text-gray-400 mt-1">
            Used for L/N and Y/L/N
          </p>
        </div>
        <input
          id="yn-last-name"
          v-model.lazy="settings.ynLastName"
          type="text"
          placeholder="Your last name"
          :disabled="!settings.enableYnReplacer"
          class="w-full sm:w-[16rem] px-3 py-2 rounded-md bg-surface-800 border border-surface-700 text-white placeholder-gray-500 disabled:opacity-50"
        />
      </div>
    </div>
  </div>
</template>
