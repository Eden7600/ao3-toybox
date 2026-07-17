<script setup lang="ts">
import {
  accentProfiles,
  type AccentId,
} from "@src/ao3_theme_injector/theme-profiles/accents";
import {
  catppuccinAccentProfiles,
  catppuccinFlavors,
  catppuccinSwatch,
  type CatppuccinAccentId,
  type CatppuccinFlavorId,
  type ThemeFamilyId,
} from "@src/ao3_theme_injector/theme-profiles/catppuccin";
import type { Settings } from "@src/common/settings";
import { Circle, Moon, Palette } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  settings: Settings | null;
  update: (patch: Partial<Settings>) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: "options"): void;
}>();

const isCatppuccin = computed(
  () => props.settings?.ao3ThemeFamily === "catppuccin",
);

// One grid model for both families so the template stays a single loop
const activeAccents = computed(() => {
  if (!isCatppuccin.value) {
    return accentProfiles.map((profile) => ({
      id: profile.id,
      label: profile.label,
      swatch: profile.swatch,
    }));
  }

  const flavor = props.settings?.ao3ThemeFlavor ?? "mocha";

  return catppuccinAccentProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    swatch: catppuccinSwatch(flavor, profile.id),
  }));
});

const selectedAccent = computed(() =>
  isCatppuccin.value
    ? props.settings?.ao3ThemeCatppuccinAccent
    : props.settings?.ao3ThemeAccent,
);

const toggleTheme = () => {
  if (!props.settings) return;

  void props.update({ ao3ThemeEnabled: !props.settings.ao3ThemeEnabled });
};

const toggleOled = () => {
  if (!props.settings) return;

  void props.update({ ao3ThemeOled: !props.settings.ao3ThemeOled });
};

const pickFamily = (family: ThemeFamilyId) => {
  void props.update({ ao3ThemeFamily: family });
};

const pickFlavor = (flavor: CatppuccinFlavorId) => {
  void props.update({ ao3ThemeFlavor: flavor });
};

const pickAccent = (accent: string) => {
  if (isCatppuccin.value) {
    void props.update({
      ao3ThemeCatppuccinAccent: accent as CatppuccinAccentId,
    });
  } else {
    void props.update({ ao3ThemeAccent: accent as AccentId });
  }
};
</script>

<template>
  <!-- Theme + OLED toggles -->
  <div class="border-t border-surface-800">
    <button
      role="switch"
      :aria-checked="settings?.ao3ThemeEnabled ?? false"
      :disabled="!settings"
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-900 transition-colors disabled:opacity-50"
      @click="toggleTheme"
    >
      <Moon class="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-medium">AO3 theme</span>
        <span class="block text-[11px] text-gray-500 leading-snug"
          >Injected site theme</span
        >
      </span>
      <span
        class="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
        :class="settings?.ao3ThemeEnabled ? 'bg-primary-600' : 'bg-surface-700'"
        aria-hidden="true"
      >
        <span
          class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          :class="settings?.ao3ThemeEnabled ? 'translate-x-4' : ''"
        ></span>
      </span>
    </button>

    <button
      role="switch"
      :aria-checked="settings?.ao3ThemeOled ?? false"
      :disabled="!settings || !settings.ao3ThemeEnabled || isCatppuccin"
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-900 transition-colors disabled:opacity-50"
      @click="toggleOled"
    >
      <Circle class="w-4 h-4 shrink-0 text-gray-400" fill="currentColor" aria-hidden="true" />
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-medium">OLED / high contrast</span>
        <span class="block text-[11px] text-gray-500 leading-snug">{{
          isCatppuccin ? "Classic palette only" : "True-black backgrounds"
        }}</span>
      </span>
      <span
        class="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
        :class="settings?.ao3ThemeOled ? 'bg-primary-600' : 'bg-surface-700'"
        aria-hidden="true"
      >
        <span
          class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          :class="settings?.ao3ThemeOled ? 'translate-x-4' : ''"
        ></span>
      </span>
    </button>
  </div>

  <!-- Palette family -->
  <div class="px-4 py-2.5 border-t border-surface-800">
    <span class="block text-sm font-medium mb-2">Palette</span>
    <div class="grid grid-cols-2 gap-2" role="group" aria-label="Palette">
      <button
        v-for="family in [
          { id: 'classic', label: 'Classic' },
          { id: 'catppuccin', label: 'Catppuccin' },
        ] as const"
        :key="family.id"
        class="py-1.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-40"
        :class="
          settings?.ao3ThemeFamily === family.id
            ? 'border-primary-600 bg-surface-800'
            : 'border-surface-700 hover:bg-surface-800 text-gray-400'
        "
        :disabled="!settings || !settings.ao3ThemeEnabled"
        :aria-pressed="settings?.ao3ThemeFamily === family.id"
        @click="pickFamily(family.id)"
      >
        {{ family.label }}
      </button>
    </div>
  </div>

  <!-- Catppuccin flavor -->
  <div v-if="isCatppuccin" class="px-4 py-2.5 border-t border-surface-800">
    <span class="block text-sm font-medium mb-2">Flavor</span>
    <div class="grid grid-cols-4 gap-2" role="group" aria-label="Flavor">
      <button
        v-for="flavor in catppuccinFlavors"
        :key="flavor.id"
        class="py-1.5 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-40"
        :class="
          settings?.ao3ThemeFlavor === flavor.id
            ? 'border-primary-600 bg-surface-800'
            : 'border-surface-700 hover:bg-surface-800 text-gray-400'
        "
        :disabled="!settings || !settings.ao3ThemeEnabled"
        :aria-pressed="settings?.ao3ThemeFlavor === flavor.id"
        @click="pickFlavor(flavor.id)"
      >
        {{ flavor.label }}
      </button>
    </div>
  </div>

  <!-- Accent swatches -->
  <div class="px-4 py-2.5 border-t border-surface-800">
    <span class="block text-sm font-medium mb-2">Accent color</span>
    <div class="grid grid-cols-4 gap-2" role="group" aria-label="Accent color">
      <button
        v-for="profile in activeAccents"
        :key="profile.id"
        class="flex flex-col items-center gap-1 py-1.5 rounded-md border transition-colors disabled:opacity-40"
        :class="
          selectedAccent === profile.id
            ? 'border-primary-600 bg-surface-800'
            : 'border-surface-700 hover:bg-surface-800'
        "
        :disabled="!settings || !settings.ao3ThemeEnabled"
        :aria-pressed="selectedAccent === profile.id"
        @click="pickAccent(profile.id)"
      >
        <span
          class="w-5 h-5 rounded-full border border-black/40"
          :style="{ background: profile.swatch }"
          aria-hidden="true"
        ></span>
        <span class="text-[10px] text-gray-400">{{ profile.label }}</span>
      </button>
    </div>
  </div>

  <!-- Footer -->
  <div class="p-3 border-t border-surface-800">
    <button
      class="w-full px-3 py-2 flex items-center justify-center gap-2 bg-surface-800 hover:bg-surface-700 rounded-md text-sm font-medium transition-colors"
      @click="emit('options')"
    >
      <Palette class="w-4 h-4" aria-hidden="true" />
      Full customization in Options
    </button>
  </div>
</template>
