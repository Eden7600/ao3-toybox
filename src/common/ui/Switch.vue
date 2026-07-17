<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const model = defineModel<boolean>({ default: false });
</script>

<template>
  <SwitchRoot
    v-model="model"
    :disabled="props.disabled"
    class="relative inline-flex w-10 h-6 shrink-0 items-center rounded-full border border-transparent bg-surface-300 dark:bg-surface-700 data-[state=checked]:bg-primary-500 dark:data-[state=checked]:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 disabled:opacity-50 transition-colors cursor-pointer"
  >
    <SwitchThumb
      class="block w-4 h-4 rounded-full bg-surface-0 shadow translate-x-1 data-[state=checked]:translate-x-5 transition-transform"
    />
  </SwitchRoot>
</template>
