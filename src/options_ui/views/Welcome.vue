<script setup lang="ts">
import {
  ArrowRight,
  BookOpen,
  Download,
  EyeOff,
  History,
  List,
  Lock,
  Palette,
  Search,
  Sparkles,
  Zap,
} from "@lucide/vue";
import { onMounted, ref, type Component } from "vue";
import { RouterLink } from "vue-router";

const version = ref("");

onMounted(() => {
  try {
    const api =
      typeof chrome !== "undefined" && chrome.runtime ? chrome : browser;
    version.value = api.runtime.getManifest().version ?? "";
  } catch {
    version.value = "";
  }
});

type FeatureCard = {
  icon: Component;
  title: string;
  body: string;
  to: string | null;
  linkLabel: string | null;
};

const features: FeatureCard[] = [
  {
    icon: Palette,
    title: "Tag Highlighting",
    body: "Give any tag a color so it jumps out in listings — or fade and hide the ones you're tired of seeing. Hover a tag anywhere on AO3 and click the dot (or just right-click the tag) to set it up on the spot; synonyms are matched automatically.",
    to: "/common-tags",
    linkLabel: "Manage highlighted tags",
  },
  {
    icon: Search,
    title: "Regex Tags",
    body: "Match whole families of tags with one pattern — highlight or hide every variant without chasing each spelling individually.",
    to: "/regex-tags",
    linkLabel: "Manage regex tags",
  },
  {
    icon: EyeOff,
    title: "Work Hiding",
    body: "Collapse or remove works by excluded tags, language, or crossover count. Each filter can be set to don't hide, collapse to a banner, or remove entirely — and one master switch shows everything again without losing your setup.",
    to: "/hide-works",
    linkLabel: "Configure hiding",
  },
  {
    icon: Sparkles,
    title: "Theme",
    body: "A full dark theme for AO3 with accent colors and an OLED mode — shown in a live preview as you tweak it.",
    to: "/theme",
    linkLabel: "Open theme settings",
  },
  {
    icon: List,
    title: "Work Listings",
    body: "Shape what every work blurb shows: colored date badges, 'Completed' labels, extra stats like kudos-per-hit, and tag cleanup — with the same live preview.",
    to: "/listings",
    linkLabel: "Open listing settings",
  },
  {
    icon: History,
    title: "Reading History",
    body: "Remembers which works you've visited and how far you got — chapter progress on work pages, visited/subscribed badges and fresh-chapter alerts in listings, an ignore button, and a 'pick up where you left off' prompt that returns you to the exact paragraph.",
    to: "/tracking",
    linkLabel: "Reading history settings",
  },
  {
    icon: BookOpen,
    title: "Reading Settings",
    body: "A reader panel on every work page: font, size, width, line height, paragraph spacing, and a 'standardize line breaks' option that tidies works with stray empty lines between paragraphs. Look for the round button in the corner while reading.",
    to: null,
    linkLabel: null,
  },
  {
    icon: Zap,
    title: "Quick Toggles",
    body: "The toolbar button opens quick switches for the big features — perfect for turning all hiding off for a browse and back on afterwards, without touching your settings.",
    to: null,
    linkLabel: null,
  },
];
</script>

<template>
  <!-- Hero -->
  <div class="p-5 md:p-8 bg-surface-900 rounded-lg">
    <div class="flex items-center gap-3">
      <h1 class="text-4xl font-bold text-white">AO3 Toybox</h1>
      <span v-if="version" class="text-sm text-gray-500 mt-2"
        >v{{ version }}</span
      >
    </div>
    <p class="text-gray-400 text-lg mt-2">
      A toolbox of tweaks for reading on the Archive of Our Own — tag
      highlighting, work filtering, theming, and a better reading view.
    </p>
    <p class="text-gray-500 mt-3 flex items-center gap-2">
      <Lock class="w-4 h-4" aria-hidden="true" />
      Everything runs locally in your browser. Your tags, filters, and settings
      never leave your machine.
    </p>
  </div>

  <!-- Quick start -->
  <div class="px-5 md:px-8 py-6 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-2xl font-semibold text-white mb-4">Quick start</h2>
    <ol class="space-y-3 text-gray-300">
      <li class="flex gap-3">
        <span
          class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center"
          >1</span
        >
        <span>
          Pick your look in
          <RouterLink to="/theme" class="text-blue-400 hover:underline"
            >Theme</RouterLink
          >
          — the preview shows changes instantly.
        </span>
      </li>
      <li class="flex gap-3">
        <span
          class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center"
          >2</span
        >
        <span>
          Browse AO3 and right-click any tag (or hover it and click the dot) to
          highlight it or hide its works.
        </span>
      </li>
      <li class="flex gap-3">
        <span
          class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center"
          >3</span
        >
        <span>
          Tune what disappears in
          <RouterLink to="/hide-works" class="text-blue-400 hover:underline"
            >Hide Works</RouterLink
          >
          — collapse to a banner or remove entirely, per filter.
        </span>
      </li>
      <li class="flex gap-3">
        <span
          class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center"
          >4</span
        >
        <span>
          Open a work and click the round button in the corner to shape the
          reading view to your taste.
        </span>
      </li>
    </ol>
    <p class="text-gray-500 text-sm mt-4">
      Settings apply the next time a page loads — the toolbar popup has a
      one-click "Reload tab" for that.
    </p>
  </div>

  <!-- Features -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
    <div
      v-for="feature in features"
      :key="feature.title"
      class="p-6 bg-surface-900 rounded-lg flex flex-col"
    >
      <div class="flex items-center gap-3 mb-2">
        <component :is="feature.icon" class="w-6 h-6 text-primary-400" aria-hidden="true" />
        <h3 class="text-lg font-semibold text-white">{{ feature.title }}</h3>
      </div>
      <p class="text-gray-400 flex-1">{{ feature.body }}</p>
      <RouterLink
        v-if="feature.to"
        :to="feature.to"
        class="text-blue-400 hover:underline text-sm mt-3 inline-flex items-center gap-1"
      >
        {{ feature.linkLabel }} <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
      </RouterLink>
    </div>
  </div>

  <!-- Backup -->
  <div class="px-5 md:px-8 py-6 bg-surface-900 rounded-lg mt-3">
    <div class="flex items-start gap-3">
      <Download class="w-6 h-6 text-blue-400 mt-1 shrink-0" aria-hidden="true" />
      <div>
        <h3 class="text-lg font-semibold text-white mb-1">
          Your data, portable
        </h3>
        <p class="text-gray-400">
          Since everything lives in your browser, use
          <RouterLink to="/export" class="text-blue-400 hover:underline"
            >Import / Export</RouterLink
          >
          to back up your tags and settings, or to move them to another browser.
        </p>
      </div>
    </div>
  </div>
</template>
