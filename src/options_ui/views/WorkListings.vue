<script setup lang="ts">
import SettingsDropdown from "@src/options_ui/components/SettingsDropdown.vue";
import SettingsToggle from "@src/options_ui/components/SettingsToggle.vue";
import WorkBlurbPreviewDisplay from "@src/options_ui/components/WorkBlurbPreviewDisplay.vue";
import { useOptionsSettings } from "@src/options_ui/useOptionsSettings";

const { settings } = useOptionsSettings("WorkListings");

const tagColorSummaryStyleOptions = [
  { value: "chips", label: "Count per color" },
  { value: "swatch", label: "Blended swatch" },
  { value: "both", label: "Both" },
];

const fadeSensitivityOptions = [
  { value: "conservative", label: "Conservative — only obvious commentary" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive — fade anything doubtful" },
];
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg flex items-center justify-between">
    <div class="flex flex-col">
      <h1 class="text-2xl font-bold text-white">Work Listings</h1>
      <p class="text-gray-400 text-lg">
        What each work blurb shows, and how listing pages behave
      </p>
    </div>
  </div>

  <!-- Live Preview -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-semibold text-white pt-4 pb-2">Live Preview</h2>
    <p class="text-gray-400 text-sm mb-4">
      Two sample work blurbs rendered with AO3's layout, your theme, and your
      tag &amp; date settings — they update as you change anything below.
    </p>
    <WorkBlurbPreviewDisplay :settings="settings" />
  </div>

  <!-- Dates -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-semibold text-white pt-4 pb-2">Dates</h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.enableDateBadge"
        label="Show Date Badge"
        description="Show a colored badge on works to indicate their age"
      />
      <SettingsToggle
        v-model="settings.enableDateNaturalLanguage"
        label="Show Date in Days"
        description="Show the date in days beside the regular date"
      />
      <SettingsToggle
        v-model="settings.showCompletedText"
        label="Show 'Completed' for Finished Works"
        description="Display 'Completed' instead of the update date for works that are finished"
      />
    </div>
  </div>

  <!-- Blurb Layout & Stats -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-semibold text-white pt-4 pb-2">
      Blurb Layout &amp; Stats
    </h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.enableModernBlurbs"
        label="Modern Blurb Design"
        description="Restyle work blurbs as modern cards — grid header, inset summary, separated stats footer. Follows your theme accent"
      />
      <SettingsToggle
        v-model="settings.stackBlurbStats"
        label="Stack Blurb Stats"
        description="Lay out each blurb stat as a column with its label above the value, giving the stats row more room"
      />
      <SettingsToggle
        v-model="settings.hideBlurbLanguageLine"
        label="Hide Language Line"
        description="Hide the language row from work blurb stats (language filtering still works)"
      />
      <SettingsToggle
        v-model="settings.hideBlurbCommentsCount"
        label="Hide Comments Count"
        description="Hide the comments count from work blurb stats"
      />
      <SettingsToggle
        v-model="settings.hideBlurbBookmarksCount"
        label="Hide Bookmarks Count"
        description="Hide the bookmarks count from work blurb stats"
      />
      <SettingsToggle
        v-model="settings.hideBlurbCollectionsCount"
        label="Hide Collections Count"
        description="Hide the collections count from work blurb stats"
      />
      <SettingsToggle
        v-model="settings.showKudosPerHitRatio"
        label="Show Kudos/Hits Ratio"
        description="Add a kudos-per-hit percentage to work blurbs — higher means better received"
      />
      <SettingsToggle
        v-model="settings.showWordsPerChapterRatio"
        label="Show Words/Chapter Ratio"
        description="Add an average words-per-chapter stat to work blurbs"
      />
    </div>
  </div>

  <!-- Tag Display -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-semibold text-white pt-4 pb-2">Tag Display</h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.showHiddenTagsChip"
        label="Show Hidden Tags Count"
        description="Show a '+x hidden tags' chip on blurbs where tags are hidden — click it to reveal them"
      />
      <SettingsToggle
        v-model="settings.showTagColorSummary"
        label="Show Tag Highlight Summary"
        description="Add a per-work rollup of your highlighted tag colors to blurb stats (requires tag highlighting)"
      />
      <SettingsDropdown
        v-model="settings.tagColorSummaryStyle"
        label="Highlight Summary Style"
        description="Count chips per color, a single swatch blending all highlighted colors, or both"
        :options="tagColorSummaryStyleOptions"
        :disabled="!settings.showTagColorSummary"
      />
      <SettingsToggle
        v-model="settings.replaceTagAliases"
        label="Replace Alias Tags with Canonical Name"
        description="Rename highlighted tags to the canonical name from your Highlighted Tags list (e.g. an alias becomes its real tag)"
      />
      <SettingsToggle
        v-model="settings.removeFandomDiscriminator"
        label="Remove Fandom Discriminators"
        description="Remove text in parentheses from tags (e.g., 'TommyInnit (Video Blogging RPF)' becomes 'TommyInnit')"
      />
      <SettingsToggle
        v-model="settings.removeTagSuffixes"
        label="Remove Tag Suffixes"
        description="Remove '- Freeform' and '- Fandom' suffixes from tags"
      />
      <SettingsToggle
        v-model="settings.fadeCommentaryTags"
        label="Fade Commentary Tags"
        description="Dim tags that read as author commentary ('no beta we die like men') instead of information about the work. Tags mentioning the work's characters, warnings, and fandoms are kept, and tags you highlight or match with a regex are never dimmed"
      />
      <SettingsDropdown
        v-model="settings.fadeCommentarySensitivity"
        label="Commentary Sensitivity"
        description="How strong the commentary signal must be before a tag is dimmed"
        :options="fadeSensitivityOptions"
        :disabled="!settings.fadeCommentaryTags"
      />
    </div>
  </div>

  <!-- Browsing -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-semibold text-white pt-4 pb-2">Browsing</h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.enableOpenInNewTab"
        label="Open Works in New Tab"
        description="Open links in a new tab from the work browsing page"
      />
      <SettingsToggle
        v-model="settings.enableKeyboardPagination"
        label="Enable Keyboard Pagination"
        description="Enable keyboard pagination on the work browsing page"
      />
      <SettingsToggle
        v-model="settings.redirectAlternativeDomains"
        label="Redirect Alternative Domains"
        description="Redirect AO3's alternative domains (ao3.org, archive.transformativeworks.org, ...) to archiveofourown.org so logins and extension data stay on one domain"
      />
    </div>
  </div>
</template>
