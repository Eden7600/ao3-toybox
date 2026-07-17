<script setup lang="ts">
import { Check, ChevronDown } from "@lucide/vue";
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";

import type { SelectOption } from "./types";

const props = withDefaults(
  defineProps<{
    options: SelectOption[];
    optionLabel?: string;
    optionValue?: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    optionLabel: "label",
    optionValue: "value",
    placeholder: "Select an option",
    disabled: false,
  },
);

// Nullable so callers can bind fields that start out unset
const model = defineModel<string | null>({ default: null });

const labelOf = (option: SelectOption) => String(option[props.optionLabel]);
const valueOf = (option: SelectOption) => String(option[props.optionValue]);
</script>

<template>
  <SelectRoot v-model="model" :disabled="props.disabled">
    <SelectTrigger
      class="inline-flex w-full items-center justify-between gap-2 rounded-md border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 px-3 py-2 text-sm text-surface-700 dark:text-surface-0 data-[placeholder]:text-surface-400 dark:data-[placeholder]:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 transition-colors cursor-pointer"
    >
      <SelectValue :placeholder="props.placeholder" class="truncate" />
      <ChevronDown class="w-4 h-4 shrink-0 text-surface-400" aria-hidden="true" />
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="z-50 min-w-[var(--reka-select-trigger-width)] max-h-72 overflow-hidden rounded-md border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 text-surface-700 dark:text-surface-0 shadow-lg"
      >
        <SelectViewport class="p-1">
          <SelectItem
            v-for="option in props.options"
            :key="valueOf(option)"
            :value="valueOf(option)"
            class="relative flex items-center justify-between gap-2 rounded px-3 py-2 text-sm select-none outline-none cursor-pointer data-[highlighted]:bg-surface-100 dark:data-[highlighted]:bg-surface-800 data-[state=checked]:text-primary-500 dark:data-[state=checked]:text-primary-400"
          >
            <SelectItemText>{{ labelOf(option) }}</SelectItemText>
            <SelectItemIndicator>
              <Check class="w-4 h-4" aria-hidden="true" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
