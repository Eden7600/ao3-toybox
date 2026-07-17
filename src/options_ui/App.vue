<script setup lang="ts">
import {
  BookOpen,
  EyeOff,
  FileInput,
  History,
  House,
  List,
  Menu,
  Palette,
  Search,
  Server,
  Tags,
} from "@lucide/vue";
import { ref, type Component } from "vue";
import { useRouter } from "vue-router";

import { serverFeaturesEnabled } from "@src/common/build-env";
import { ConfirmDialog, Toaster } from "@src/common/ui";
import { isDevBuild } from "./build-env";
import NavItem from "./components/NavItem.vue";

type NavEntry = { label: string; to: string; icon: Component };
type NavGroup = { heading: string | null; items: NavEntry[] };

// Single nav model drives both the desktop sidebar and the mobile drawer
const navGroups: NavGroup[] = [
  {
    heading: null,
    items: [{ label: "Welcome", to: "/welcome", icon: House }],
  },
  {
    heading: "Appearance",
    items: [
      { label: "Theme", to: "/theme", icon: Palette },
      { label: "Work Listings", to: "/listings", icon: List },
    ],
  },
  {
    heading: "Tags & Filters",
    items: [
      { label: "Hide Works", to: "/hide-works", icon: EyeOff },
      { label: "Highlighted Tags", to: "/common-tags", icon: Tags },
      { label: "Regex Tags", to: "/regex-tags", icon: Search },
    ],
  },
  {
    heading: "Reading",
    items: [
      { label: "Reading", to: "/reading", icon: BookOpen },
      { label: "Reading History", to: "/tracking", icon: History },
    ],
  },
  {
    heading: "Data",
    items: [
      { label: "Import / Export", to: "/export", icon: FileInput },
      // Offline-first release: the server page only exists in dev builds
      // that ship the server features
      ...(isDevBuild && serverFeaturesEnabled
        ? [{ label: "Server", to: "/server", icon: Server }]
        : []),
    ],
  },
];

const drawerOpen = ref(false);
const router = useRouter();

// Covers nav taps, redirects, and programmatic navigation alike
router.afterEach(() => {
  drawerOpen.value = false;
});
</script>

<template>
  <div class="bg-surface-0 dark:bg-surface-950 antialised min-h-screen">
    <!-- Mobile top bar (hidden at md+) -->
    <header
      class="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-surface-100 dark:bg-surface-900 shadow-md"
    >
      <button
        class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-700 dark:text-white"
        aria-label="Open navigation"
        :aria-expanded="drawerOpen"
        @click="drawerOpen = true"
      >
        <Menu class="w-5 h-5" aria-hidden="true" />
      </button>
      <h1 class="text-lg font-bold dark:text-white">AO3 Toybox</h1>
    </header>

    <!-- Drawer backdrop (mobile only) -->
    <div
      v-if="drawerOpen"
      class="md:hidden fixed inset-0 z-40 bg-black/50"
      aria-hidden="true"
      @click="drawerOpen = false"
    ></div>

    <div
      class="max-w-screen-2xl mx-auto flex w-full h-full relative md:pt-4 xl:pt-8 md:px-4"
    >
      <!-- Sidebar: persistent at md+, off-canvas drawer below -->
      <aside
        id="sidebar"
        class="fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 md:w-48 lg:w-64 transform transition-transform duration-200 md:transform-none md:block md:h-auto md:rounded-lg"
        :class="
          drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        "
        aria-label="Sidebar"
      >
        <nav
          class="overflow-y-auto pb-5 pt-2 px-3 h-full md:h-auto bg-surface-100 dark:bg-surface-900 md:rounded-lg"
        >
          <template v-for="group in navGroups" :key="group.heading ?? 'top'">
            <h5
              v-if="group.heading"
              class="text-sm font-medium uppercase text-gray-500 p-2"
            >
              {{ group.heading }}
            </h5>
            <ul class="space-y-2 mb-2">
              <NavItem
                v-for="item in group.items"
                :key="item.to"
                :label="item.label"
                :to="item.to"
              >
                <component
                  :is="item.icon"
                  class="w-5 h-5 dark:text-gray-400 transition duration-75 group-hover:text-white"
                  aria-hidden="true"
                />
              </NavItem>
            </ul>
          </template>
        </nav>
      </aside>

      <main
        class="flex-1 min-w-0 pb-4 h-full overflow-y-auto px-4 md:pl-4 md:pr-0 pt-4 md:pt-0"
      >
        <Toaster />
        <ConfirmDialog />
        <RouterView />
      </main>
    </div>
  </div>
</template>
