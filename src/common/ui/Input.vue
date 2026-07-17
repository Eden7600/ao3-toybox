<script setup lang="ts">
import { cn } from "./cn";

const props = withDefaults(
  defineProps<{
    invalid?: boolean;
  }>(),
  { invalid: false },
);

const [model, modifiers] = defineModel<string>({ default: "" });

// Components don't get native v-model.lazy handling, so honor the
// modifier ourselves: update on change instead of input.
const onInput = (event: Event) => {
  if (modifiers.lazy) return;
  model.value = (event.target as HTMLInputElement).value;
};

const onChange = (event: Event) => {
  if (!modifiers.lazy) return;
  model.value = (event.target as HTMLInputElement).value;
};
</script>

<template>
  <input
    :value="model"
    :class="
      cn(
        'rounded-md border bg-surface-0 dark:bg-surface-950 px-3 py-2 text-sm text-surface-700 dark:text-surface-0 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 transition-colors',
        props.invalid
          ? 'border-red-500 dark:border-red-400'
          : 'border-surface-300 dark:border-surface-700',
      )
    "
    @input="onInput"
    @change="onChange"
  />
</template>
