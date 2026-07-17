<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    autoResize?: boolean;
    rows?: number;
  }>(),
  { autoResize: false, rows: 3 },
);

const model = defineModel<string>({ default: "" });
const el = ref<HTMLTextAreaElement | null>(null);

const resize = () => {
  if (!props.autoResize || !el.value) return;
  el.value.style.height = "auto";
  el.value.style.height = `${String(el.value.scrollHeight)}px`;
};

onMounted(resize);
watch(model, () => void nextTick(resize));
</script>

<template>
  <textarea
    ref="el"
    v-model="model"
    :rows="rows"
    class="rounded-md border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 px-3 py-2 text-sm text-surface-700 dark:text-surface-0 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 transition-colors"
    :style="autoResize ? { overflow: 'hidden', resize: 'none' } : undefined"
  ></textarea>
</template>
