<script setup lang="ts">
import { ChevronLeft } from "@lucide/vue";
import { ref } from "vue";
import HideFiltersScreen from "./screens/HideFiltersScreen.vue";
import HomeScreen from "./screens/HomeScreen.vue";
import ThemeScreen from "./screens/ThemeScreen.vue";
import { usePopupSettings } from "./usePopupSettings";

type Screen = "home" | "filters" | "theme";

// Resets to home on every popup open by design — no persisted navigation
const screen = ref<Screen>("home");

const screenTitles: Record<Screen, string> = {
  home: "AO3 Toybox",
  filters: "Hide Filters",
  theme: "Theme",
};

const { settings, version, updateSettings, openOptions } = usePopupSettings();
</script>

<template>
  <!-- Fixed width sizes the desktop popup; Firefox Android opens popups as
       a near-full-width sheet (viewport >= 400px), where the bar stretches -->
  <div class="w-72 min-[400px]:w-full bg-surface-950 text-white">
    <!-- Header (shared; back chevron on detail screens) -->
    <div class="flex items-center gap-2 px-4 pt-4 pb-3">
      <button
        v-if="screen !== 'home'"
        class="w-7 h-7 -ml-1 flex items-center justify-center rounded-md hover:bg-surface-800 transition-colors"
        aria-label="Back"
        @click="screen = 'home'"
      >
        <ChevronLeft class="w-4 h-4" aria-hidden="true" />
      </button>
      <img v-else src="../icons/icon-32.png" alt="" class="w-7 h-7" />
      <h1 class="text-base font-bold leading-tight">
        {{ screenTitles[screen] }}
      </h1>
      <span
        v-if="version && screen === 'home'"
        class="ml-auto text-[11px] text-gray-500"
        >v{{ version }}</span
      >
    </div>

    <HomeScreen
      v-if="screen === 'home'"
      :settings="settings"
      :update="updateSettings"
      @navigate="screen = $event"
      @options="openOptions"
    />
    <HideFiltersScreen
      v-else-if="screen === 'filters'"
      :settings="settings"
      :update="updateSettings"
      @options="openOptions"
    />
    <ThemeScreen
      v-else
      :settings="settings"
      :update="updateSettings"
      @options="openOptions"
    />
  </div>
</template>
