<script setup lang="ts">
import { Check } from "@lucide/vue";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import { cn } from "./cn";

const props = withDefaults(
  defineProps<{
    size?: "sm" | "md";
    disabled?: boolean;
  }>(),
  { size: "md", disabled: false },
);

const model = defineModel<boolean>({ default: false });
</script>

<template>
  <CheckboxRoot
    v-model="model"
    :disabled="props.disabled"
    :class="
      cn(
        'shrink-0 flex items-center justify-center rounded border border-surface-400 dark:border-surface-600 bg-surface-0 dark:bg-surface-950 data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 dark:data-[state=checked]:bg-primary-400 dark:data-[state=checked]:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 disabled:opacity-50 transition-colors cursor-pointer',
        props.size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
      )
    "
  >
    <CheckboxIndicator class="text-white dark:text-surface-900">
      <Check :class="props.size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'" :stroke-width="3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
