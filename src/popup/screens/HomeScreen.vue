<script setup lang="ts">
import {
  BookOpen,
  ChevronRight,
  EyeOff,
  Filter,
  Moon,
  Palette,
  Settings as SettingsIcon,
} from "@lucide/vue";
import { computed, type Component } from "vue";

import { serverFeaturesEnabled } from "@src/common/build-env";
import type { Settings } from "@src/common/settings";

type ToggleKey =
  | "hideWorks"
  | "enableTagHighlighter"
  | "ao3ThemeEnabled"
  | "enableReaderSettings";

type QuickToggle = {
  key: ToggleKey;
  label: string;
  icon: Component;
  hint: string;
};

const quickToggles: QuickToggle[] = [
  {
    key: "hideWorks",
    label: "Work hiding",
    icon: EyeOff,
    hint: "Master switch — off shows everything, filters keep their settings",
  },
  {
    key: "enableTagHighlighter",
    label: "Tag highlights",
    icon: Palette,
    hint: "Colored tags and the inline tag controls",
  },
  {
    key: "ao3ThemeEnabled",
    label: "AO3 theme",
    icon: Moon,
    hint: "Injected site theme",
  },
  {
    key: "enableReaderSettings",
    label: "Reading settings",
    icon: BookOpen,
    hint: "Reader panel on work pages",
  },
];

const navRows = [
  {
    screen: "filters" as const,
    label: "Hide filters",
    icon: Filter,
    hint: "Per-filter behaviors and word-count presets",
  },
  {
    screen: "theme" as const,
    label: "Theme",
    icon: Palette,
    hint: "Accent color and OLED mode",
  },
];

const props = defineProps<{
  settings: Settings | null;
  update: (patch: Partial<Settings>) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: "navigate", screen: "filters" | "theme"): void;
  (e: "options"): void;
}>();

const toggle = (key: ToggleKey) => {
  if (!props.settings) return;

  void props.update({ [key]: !props.settings[key] });
};

const serverConnected = computed(() =>
  Boolean(
    serverFeaturesEnabled &&
      props.settings?.connectToServer &&
      props.settings?.apiToken,
  ),
);
</script>

<template>
  <!-- Connection chip; server-less builds are always local, so no chip -->
  <div v-if="serverFeaturesEnabled" class="px-4 pb-3">
    <span
      class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border"
      :class="
        serverConnected
          ? 'border-green-700 text-green-400 bg-green-950/40'
          : 'border-surface-700 text-gray-400 bg-surface-900'
      "
    >
      <span
        class="w-1.5 h-1.5 rounded-full"
        :class="serverConnected ? 'bg-green-400' : 'bg-gray-500'"
      ></span>
      {{ serverConnected ? "Server connected" : "Local mode" }}
    </span>
  </div>

  <!-- Quick toggles -->
  <div class="border-t border-surface-800">
    <button
      v-for="item in quickToggles"
      :key="item.key"
      role="switch"
      :aria-checked="settings?.[item.key] ?? false"
      :disabled="!settings"
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-900 transition-colors disabled:opacity-50"
      @click="toggle(item.key)"
    >
      <component :is="item.icon" class="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-medium">{{ item.label }}</span>
        <span class="block text-[11px] text-gray-500 leading-snug">{{
          item.hint
        }}</span>
      </span>
      <span
        class="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
        :class="settings?.[item.key] ? 'bg-primary-600' : 'bg-surface-700'"
        aria-hidden="true"
      >
        <span
          class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          :class="settings?.[item.key] ? 'translate-x-4' : ''"
        ></span>
      </span>
    </button>
  </div>

  <!-- Drill-down rows -->
  <div class="border-t border-surface-800">
    <button
      v-for="row in navRows"
      :key="row.screen"
      :disabled="!settings"
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-900 transition-colors disabled:opacity-50"
      @click="emit('navigate', row.screen)"
    >
      <component :is="row.icon" class="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-medium">{{ row.label }}</span>
        <span class="block text-[11px] text-gray-500 leading-snug">{{
          row.hint
        }}</span>
      </span>
      <ChevronRight class="w-3.5 h-3.5 shrink-0 text-gray-500" aria-hidden="true" />
    </button>
  </div>

  <!-- Apply hint -->
  <div class="px-4 py-2.5 border-t border-surface-800">
    <span class="text-[11px] text-gray-500 leading-snug">
      Theme changes apply to open tabs instantly. Other changes reload this
      tab automatically — background AO3 tabs pick them up on their next
      reload
    </span>
  </div>

  <!-- Footer -->
  <div class="p-3 border-t border-surface-800">
    <button
      class="w-full px-3 py-2 flex items-center justify-center gap-2 bg-surface-800 hover:bg-surface-700 rounded-md text-sm font-medium transition-colors"
      @click="emit('options')"
    >
      <SettingsIcon class="w-4 h-4" aria-hidden="true" />
      Options
    </button>
  </div>
</template>
