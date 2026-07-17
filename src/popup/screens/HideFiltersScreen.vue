<script setup lang="ts">
import {
  hideSourceLabels,
  type HideMode,
  type HideModes,
  type HideSource,
} from "@src/common/hide-modes";
import type { Settings } from "@src/common/settings";
import { EyeOff, SlidersHorizontal } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  settings: Settings | null;
  update: (patch: Partial<Settings>) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: "options"): void;
}>();

const modeOptions: Array<{ value: HideMode; label: string }> = [
  { value: "none", label: "Off" },
  { value: "collapse", label: "Collapse" },
  { value: "remove", label: "Remove" },
];

const groups: Array<{ title: string; sources: HideSource[] }> = [
  {
    title: "Content",
    sources: ["excluded-tags", "podfic", "language", "fandom"],
  },
  {
    title: "Stats",
    sources: ["kudos-hits", "words-chapter", "word-count"],
  },
  {
    title: "Reading history",
    sources: [
      "ignored",
      "visited",
      "subscribed",
      "read-finished",
      "read-caught-up",
      "read-behind",
      "read-barely-started",
    ],
  },
];

const rowDisabled = (source: HideSource): boolean => {
  if (!props.settings?.hideWorks) return true;

  return source === "subscribed" && props.settings.neverHideSubscribedWorks;
};

const setMode = (source: HideSource, mode: HideMode) => {
  if (!props.settings) return;

  const modes: HideModes = { ...props.settings.hideModes, [source]: mode };
  void props.update({ hideModes: modes });
};

const toggleMaster = () => {
  if (!props.settings) return;

  void props.update({ hideWorks: !props.settings.hideWorks });
};

type WordPreset = { label: string; min: number; max: number };

const wordPresets: WordPreset[] = [
  { label: ">1k", min: 1000, max: 0 },
  { label: ">10k", min: 10000, max: 0 },
  { label: ">5k", min: 0, max: 5000 },
  { label: "<10k", min: 0, max: 10000 },
];

// A preset label when the bounds match one, null for custom bounds set in
// the options page (irrelevant while the filter is off).
const activeWordPreset = computed<string | null>(() => {
  const current = props.settings;

  if (!current || current.hideModes["word-count"] === "none") return null;

  const match = wordPresets.find(
    (preset) =>
      preset.min === current.hideWordCountMin &&
      preset.max === current.hideWordCountMax,
  );

  return match ? match.label : null;
});

const applyWordPreset = (preset: WordPreset) => {
  if (!props.settings) return;

  const modes: HideModes = { ...props.settings.hideModes };

  // The shortcut is a browsing filter, so removal reads best — but a
  // mode the user picked explicitly (e.g. collapse) is respected.
  if (modes["word-count"] === "none") {
    modes["word-count"] = "remove";
  }

  void props.update({
    hideModes: modes,
    hideWordCountMin: preset.min,
    hideWordCountMax: preset.max,
  });
};
</script>

<template>
  <!-- Master switch mirror -->
  <div class="border-t border-surface-800">
    <button
      role="switch"
      :aria-checked="settings?.hideWorks ?? false"
      :disabled="!settings"
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-900 transition-colors disabled:opacity-50"
      @click="toggleMaster"
    >
      <EyeOff class="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-medium">Work hiding</span>
        <span class="block text-[11px] text-gray-500 leading-snug"
          >Master switch for every filter below</span
        >
      </span>
      <span
        class="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
        :class="settings?.hideWorks ? 'bg-primary-600' : 'bg-surface-700'"
        aria-hidden="true"
      >
        <span
          class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          :class="settings?.hideWorks ? 'translate-x-4' : ''"
        ></span>
      </span>
    </button>
  </div>

  <!-- Filter groups -->
  <div v-for="group in groups" :key="group.title">
    <div
      class="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-t border-surface-800"
    >
      {{ group.title }}
    </div>
    <div v-for="source in group.sources" :key="source" class="px-4 py-2">
      <span
        class="block text-sm font-medium mb-1.5"
        :class="rowDisabled(source) ? 'text-gray-600' : ''"
      >
        {{ hideSourceLabels[source] }}
      </span>
      <div
        class="flex gap-1"
        role="group"
        :aria-label="`${hideSourceLabels[source]} behavior`"
      >
        <button
          v-for="option in modeOptions"
          :key="option.value"
          class="flex-1 px-1 py-1 text-[11px] font-medium rounded-md border transition-colors disabled:opacity-40"
          :class="
            settings?.hideModes[source] === option.value
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-surface-700 text-gray-300 hover:bg-surface-800'
          "
          :disabled="!settings || rowDisabled(source)"
          @click="setMode(source, option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- Word-count presets live under their filter row -->
      <div
        v-if="source === 'word-count'"
        class="flex gap-1 mt-1.5"
        role="group"
        aria-label="Word count presets"
      >
        <button
          v-for="preset in wordPresets"
          :key="preset.label"
          class="flex-1 px-1 py-1 text-[11px] font-medium rounded-md border transition-colors disabled:opacity-40"
          :class="
            activeWordPreset === preset.label
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-surface-700 text-gray-300 hover:bg-surface-800'
          "
          :disabled="!settings || rowDisabled(source)"
          @click="applyWordPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>
  </div>

  <!-- Subscribed exemption note -->
  <div
    v-if="settings?.neverHideSubscribedWorks"
    class="px-4 py-2 border-t border-surface-800"
  >
    <span class="text-[11px] text-gray-500 leading-snug">
      "Never Hide Subscribed Works" is on — the subscribed filter is bypassed
    </span>
  </div>

  <!-- Footer -->
  <div class="p-3 border-t border-surface-800">
    <button
      class="w-full px-3 py-2 flex items-center justify-center gap-2 bg-surface-800 hover:bg-surface-700 rounded-md text-sm font-medium transition-colors"
      @click="emit('options')"
    >
      <SlidersHorizontal class="w-4 h-4" aria-hidden="true" />
      Thresholds &amp; more in Options
    </button>
  </div>
</template>
