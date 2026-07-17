<script setup lang="ts">
import { ChevronDown, X } from "@lucide/vue";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { computed, ref } from "vue";
import Checkbox from "./Checkbox.vue";

import type { MultiSelectOption } from "./types";

const props = withDefaults(
  defineProps<{
    options: MultiSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    filter?: boolean;
  }>(),
  {
    placeholder: "Select options",
    disabled: false,
    filter: false,
  },
);

const model = defineModel<string[]>({ default: () => [] });

const search = ref("");

const visibleOptions = computed(() => {
  const query = search.value.trim().toLowerCase();

  if (!query) return props.options;

  return props.options.filter((option) => option.label.toLowerCase().includes(query));
});

const selectedOptions = computed(() =>
  props.options.filter((option) => model.value.includes(option.value)),
);

const isSelected = (value: string) => model.value.includes(value);

const toggle = (value: string) => {
  model.value = isSelected(value)
    ? model.value.filter((v) => v !== value)
    : [...model.value, value];
};

const remove = (value: string) => {
  model.value = model.value.filter((v) => v !== value);
};
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger
      :disabled="props.disabled"
      class="inline-flex w-full min-h-[2.4rem] items-center justify-between gap-2 rounded-md border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 px-2 py-1.5 text-sm text-surface-700 dark:text-surface-0 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 transition-colors cursor-pointer"
    >
      <span v-if="selectedOptions.length === 0" class="px-1 text-surface-400 dark:text-surface-500">
        {{ props.placeholder }}
      </span>
      <span v-else class="flex flex-wrap gap-1">
        <span
          v-for="option in selectedOptions"
          :key="option.value"
          class="inline-flex items-center gap-1 rounded bg-surface-200 dark:bg-surface-800 px-2 py-0.5 text-xs"
        >
          {{ option.label }}
          <span
            role="button"
            tabindex="-1"
            class="hover:text-red-400 cursor-pointer"
            :aria-label="`Remove ${option.label}`"
            @click.stop="remove(option.value)"
          >
            <X class="w-3 h-3" aria-hidden="true" />
          </span>
        </span>
      </span>
      <ChevronDown class="w-4 h-4 shrink-0 text-surface-400" aria-hidden="true" />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        :side-offset="4"
        align="start"
        class="z-50 w-[var(--reka-popover-trigger-width)] rounded-md border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 text-surface-700 dark:text-surface-0 shadow-lg"
      >
        <div v-if="props.filter" class="p-2 border-b border-surface-200 dark:border-surface-700">
          <input
            v-model="search"
            type="text"
            placeholder="Search"
            class="w-full rounded border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
          />
        </div>
        <ul class="max-h-60 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
          <li v-for="option in visibleOptions" :key="option.value">
            <button
              type="button"
              role="option"
              :aria-selected="isSelected(option.value)"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
              @click="toggle(option.value)"
            >
              <Checkbox :model-value="isSelected(option.value)" size="sm" class="pointer-events-none" />
              {{ option.label }}
            </button>
          </li>
          <li
            v-if="visibleOptions.length === 0"
            class="px-2 py-1.5 text-sm text-surface-400 dark:text-surface-500"
          >
            No results
          </li>
        </ul>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
