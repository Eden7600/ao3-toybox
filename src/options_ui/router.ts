import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from "vue-router";

import { serverFeaturesEnabled } from "@src/common/build-env";
import { isDevBuild } from "./build-env";

// Import your views here
import ExportSettingsView from "./views/ExportSettings.vue";
import HideWorksView from "./views/HideWorks.vue";
import ReadingView from "./views/Reading.vue";
import ServerSettingsView from "./views/ServerSettings.vue";
import CommonTagsView from "./views/tags/CommonTags.vue";
import RegexTagsView from "./views/tags/RegexTags.vue";
import ThemeView from "./views/Theme.vue";
import TrackingSettingsView from "./views/TrackingSettings.vue";
import WelcomeView from "./views/Welcome.vue";
import WorkListingsView from "./views/WorkListings.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/welcome" },
  { path: "/welcome", name: "welcome", component: WelcomeView },
  { path: "/theme", name: "theme", component: ThemeView },
  { path: "/listings", name: "listings", component: WorkListingsView },
  // The combined appearance page split into theme + listings
  { path: "/appearance", redirect: "/theme" },
  { path: "/work-preview", redirect: "/listings" },
  { path: "/hide-works", name: "hide-works", component: HideWorksView },
  { path: "/tracking", name: "tracking", component: TrackingSettingsView },
  { path: "/reading", name: "reading", component: ReadingView },
  { path: "/common-tags", name: "common-tags", component: CommonTagsView },
  { path: "/regex-tags", name: "regex-tags", component: RegexTagsView },
  { path: "/export", name: "export", component: ExportSettingsView },
  // Offline-first release: server page exists only in dev builds that ship
  // the server features; otherwise /server falls through to the catch-all
  ...(isDevBuild && serverFeaturesEnabled
    ? [{ path: "/server", name: "server", component: ServerSettingsView }]
    : []),
  { path: "/:pathMatch(.*)*", redirect: "/welcome" },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
