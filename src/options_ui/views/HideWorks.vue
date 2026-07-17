<script setup lang="ts">
import { Info } from "@lucide/vue";
import { hideSourceLabels } from "@src/common/hide-modes";
import SettingsDropdown from "@src/options_ui/components/SettingsDropdown.vue";
import SettingsMultiSelect from "@src/options_ui/components/SettingsMultiSelect.vue";
import SettingsNumber from "@src/options_ui/components/SettingsNumber.vue";
import SettingsToggle from "@src/options_ui/components/SettingsToggle.vue";
import { useOptionsSettings } from "@src/options_ui/useOptionsSettings";
import { computed } from "vue";

import languageDefinitions from "@assets/languages.json";

const { settings, loadError: error } = useOptionsSettings("HideWorks");

const languages = computed(() =>
  languageDefinitions.map((lang) => ({ label: lang.text, value: lang.text })),
);

const hideModeOptions = [
  { label: "Don't hide", value: "none" },
  { label: "Collapse to banner", value: "collapse" },
  { label: "Remove entirely", value: "remove" },
];

// Every filter's mode dropdown greys out with the master switch
const modesDisabled = computed(() => !settings.value.hideWorks);
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg flex items-center justify-between">
    <div class="flex flex-col">
      <h1 class="text-2xl font-bold text-white">Hide Works</h1>
      <p class="text-gray-400 text-lg">
        Customize the conditions and settings for hiding works
      </p>
    </div>
  </div>

  <div v-if="error" class="px-4 py-2 bg-red-600 text-white mt-3 rounded-lg">
    {{ error }}
  </div>

  <!-- General Settings -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">General Settings</h2>
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="settings.hideWorks"
        label="Enable Work Hiding"
        description="Master switch for the whole hiding system. Turn off to show everything temporarily — your per-filter behaviors below are preserved"
      />
      <SettingsToggle
        v-model="settings.neverHideSubscribedWorks"
        label="Never Hide Subscribed Works"
        description="Works you're subscribed to bypass every filter below — neither collapsed nor removed. Explicitly ignored works still hide"
      />
      <SettingsToggle
        v-model="settings.showHideReason"
        label="Show Hide Reasons"
        description="Display a clickable banner explaining why works were hidden, allowing you to reveal them"
      />
      <SettingsNumber
        v-model="settings.maxHideReasonsToShow"
        :disabled="!settings.showHideReason"
        label="Maximum Reasons to Show"
        description="When a work is hidden for multiple reasons, show at most this many in the banner (remaining count is summarized)"
        :min="1"
        :max="20"
        :step="1"
      />
    </div>
  </div>

  <!-- Content Filters -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">Content Filters</h2>
    <p class="text-gray-400 pb-2">
      Each filter has its own behavior — leave works alone ("Don't hide"),
      collapse them to an expandable banner, or remove them from listings
      entirely — with its specific options directly beneath it. When a work is
      hidden by several filters, "remove" wins over "collapse".
    </p>
    <div class="divide-y divide-surface-800 text-white">
      <div>
        <SettingsDropdown
          v-model="settings.hideModes['excluded-tags']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['excluded-tags']"
          description="Works that contain a tag you've marked to hide works — pick the tags in the Tag Management section"
          :options="hideModeOptions"
        />
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes.podfic"
          :disabled="modesDisabled"
          :label="hideSourceLabels.podfic"
          description="Works with 'podfic' in the title or summary, or with 0 words (non-text works)"
          :options="hideModeOptions"
        />
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes.language"
          :disabled="modesDisabled"
          :label="hideSourceLabels.language"
          description="Works not in your allowed languages"
          :options="hideModeOptions"
        />
        <div class="pl-6">
          <SettingsMultiSelect
            v-model="settings.hideLanguagesAllowlist"
            :disabled="settings.hideModes.language === 'none'"
            label="Allowed Languages"
            description="Select the languages you want to see; works in any other language are hidden by this filter"
            :options="languages"
            placeholder="Select languages to allow"
          />
        </div>
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes.fandom"
          :disabled="modesDisabled"
          :label="hideSourceLabels.fandom"
          description="Works tagged with more fandoms than your maximum"
          :options="hideModeOptions"
        />
        <div class="pl-6">
          <SettingsNumber
            v-model="settings.hideExcessiveFandomsThreshold"
            :disabled="settings.hideModes.fandom === 'none'"
            label="Maximum Fandoms"
            description="Works with more than this many fandoms are hidden by this filter"
            :min="1"
            :max="20"
            :step="1"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Stat Filters -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">Stat Filters</h2>
    <p class="text-gray-400 pb-2">
      Filters on stats read from each blurb. Works missing an underlying stat
      (e.g. no kudos yet, no readable word count) are never hidden by these
      filters.
    </p>
    <div class="divide-y divide-surface-800 text-white">
      <div>
        <SettingsDropdown
          v-model="settings.hideModes['kudos-hits']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['kudos-hits']"
          description="Works with fewer kudos per hit than your minimum (higher means better received)"
          :options="hideModeOptions"
        />
        <div class="pl-6">
          <SettingsNumber
            v-model="settings.hideKudosPerHitThreshold"
            :disabled="settings.hideModes['kudos-hits'] === 'none'"
            label="Minimum Kudos per Hit (%)"
            description="Works with a lower kudos-to-hits percentage than this are hidden by this filter"
            :min="0.1"
            :max="100"
            :step="0.1"
            :maxFractionDigits="1"
          />
        </div>
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes['words-chapter']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['words-chapter']"
          description="Works whose average words per published chapter falls outside your bounds"
          :options="hideModeOptions"
        />
        <div class="pl-6">
          <SettingsNumber
            v-model="settings.hideWordsPerChapterMin"
            :disabled="settings.hideModes['words-chapter'] === 'none'"
            label="Minimum Words per Chapter"
            description="Works averaging fewer words per chapter than this are hidden (0 = no minimum)"
            :min="0"
            :max="500000"
            :step="100"
          />
          <SettingsNumber
            v-model="settings.hideWordsPerChapterMax"
            :disabled="settings.hideModes['words-chapter'] === 'none'"
            label="Maximum Words per Chapter"
            description="Works averaging more words per chapter than this are hidden (0 = no maximum)"
            :min="0"
            :max="500000"
            :step="100"
          />
        </div>
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes['word-count']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['word-count']"
          description="Works whose total word count falls outside your bounds. The popup offers quick presets (over 1k/5k/10k, under 10k) that write these same bounds"
          :options="hideModeOptions"
        />
        <div class="pl-6">
          <SettingsNumber
            v-model="settings.hideWordCountMin"
            :disabled="settings.hideModes['word-count'] === 'none'"
            label="Minimum Word Count"
            description="Works with fewer total words than this are hidden (0 = no minimum)"
            :min="0"
            :max="10000000"
            :step="500"
          />
          <SettingsNumber
            v-model="settings.hideWordCountMax"
            :disabled="settings.hideModes['word-count'] === 'none'"
            label="Maximum Word Count"
            description="Works with more total words than this are hidden (0 = no maximum)"
            :min="0"
            :max="10000000"
            :step="500"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Reading History Filters -->
  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <h2 class="text-xl font-bold text-white pt-4 pb-2">
      Reading History Filters
    </h2>
    <p class="text-gray-400 pb-2">
      Filters on your own reading history. The reading-progress filters
      compare the chapters you've reached against the blurb's chapter count,
      so they only apply to works you've read with a visible chapter stat.
    </p>
    <div class="divide-y divide-surface-800 text-white">
      <div>
        <SettingsDropdown
          v-model="settings.hideModes.ignored"
          :disabled="modesDisabled"
          :label="hideSourceLabels.ignored"
          description="Works you've ignored with the ignore button"
          :options="hideModeOptions"
        />
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes.visited"
          :disabled="modesDisabled"
          :label="hideSourceLabels.visited"
          description="Works you've already visited"
          :options="hideModeOptions"
        />
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes.subscribed"
          :disabled="modesDisabled || settings.neverHideSubscribedWorks"
          :label="hideSourceLabels.subscribed"
          description="Works you're subscribed to"
          :options="hideModeOptions"
        />
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes['read-finished']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['read-finished']"
          description="Complete works you've read to the final chapter — done forever"
          :options="hideModeOptions"
        />
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes['read-caught-up']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['read-caught-up']"
          description="Works in progress where you've read every published chapter — nothing to read until they update"
          :options="hideModeOptions"
        />
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes['read-behind']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['read-behind']"
          description="Works where too many unread chapters have piled up since you last read"
          :options="hideModeOptions"
        />
        <div class="pl-6">
          <SettingsNumber
            v-model="settings.hideFarBehindThreshold"
            :disabled="settings.hideModes['read-behind'] === 'none'"
            label="Unread Chapters Threshold"
            description="A work counts as fallen behind once at least this many published chapters are unread"
            :min="1"
            :max="500"
            :step="1"
          />
        </div>
      </div>

      <div>
        <SettingsDropdown
          v-model="settings.hideModes['read-barely-started']"
          :disabled="modesDisabled"
          :label="hideSourceLabels['read-barely-started']"
          description="Works you sampled and dropped — stopped within the first chapters with more left unread"
          :options="hideModeOptions"
        />
        <div class="pl-6">
          <SettingsNumber
            v-model="settings.hideBarelyStartedThreshold"
            :disabled="
              settings.hideModes['read-barely-started'] === 'none'
            "
            label="Barely-Started Threshold"
            description="A work counts as barely started while you've read at most this many chapters (and unread chapters remain)"
            :min="1"
            :max="50"
            :step="1"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Information Panel -->
  <div class="px-4 py-4 bg-surface-800 rounded-lg mt-3">
    <div class="flex items-start gap-3">
      <Info class="w-6 h-6 text-blue-400 mt-1 shrink-0" aria-hidden="true" />
      <div class="text-white">
        <h3 class="font-semibold text-lg mb-2">How Work Hiding Works</h3>
        <ul class="list-disc list-inside space-y-1 text-gray-300">
          <li>
            Hidden works are replaced with a compact banner when "Show Hide
            Reasons" is enabled
          </li>
          <li>
            Click the "Show" button on the banner to temporarily reveal a hidden
            work
          </li>
          <li>
            Multiple hide reasons are shown as a list (up to the maximum you
            set); extra reasons are summarized
          </li>
          <li>
            Tag exclusion settings can be configured in the Tag Management
            section
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
