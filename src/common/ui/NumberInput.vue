<script setup lang="ts">
import { Minus, Plus } from "@lucide/vue";
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    min?: number;
    max?: number;
    step?: number;
    maxFractionDigits?: number;
    disabled?: boolean;
  }>(),
  {
    min: undefined,
    max: undefined,
    step: 1,
    maxFractionDigits: 0,
    disabled: false,
  },
);

const model = defineModel<number>({ default: 0 });

const formatOptions = computed<Intl.NumberFormatOptions>(() => ({
  maximumFractionDigits: props.maxFractionDigits,
  useGrouping: false,
}));

const stepperClass =
  "flex w-9 items-center justify-center bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors cursor-pointer";
</script>

<template>
  <NumberFieldRoot
    v-model="model"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :format-options="formatOptions"
    :disabled="props.disabled"
    class="inline-flex h-10 items-stretch overflow-hidden rounded-md border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 focus-within:ring-2 focus-within:ring-primary-500/50"
  >
    <NumberFieldDecrement :class="stepperClass" aria-label="Decrease">
      <Minus class="w-4 h-4" aria-hidden="true" />
    </NumberFieldDecrement>
    <NumberFieldInput
      class="w-20 bg-transparent text-center text-sm text-surface-700 dark:text-surface-0 focus:outline-none disabled:opacity-50"
    />
    <NumberFieldIncrement :class="stepperClass" aria-label="Increase">
      <Plus class="w-4 h-4" aria-hidden="true" />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
