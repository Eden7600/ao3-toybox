<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";

import type { MenuItem } from "./types";

defineProps<{
  model: MenuItem[];
}>();

const visible = ref(false);
const x = ref(0);
const y = ref(0);
const menuEl = ref<HTMLElement | null>(null);

const hide = () => {
  visible.value = false;
  document.removeEventListener("pointerdown", onOutsidePointer, true);
  document.removeEventListener("keydown", onKeydown, true);
};

const onOutsidePointer = (event: PointerEvent) => {
  if (menuEl.value && !menuEl.value.contains(event.target as Node)) hide();
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") hide();
};

/** Open the menu at the pointer position, clamped to the viewport. */
const show = async (event: MouseEvent) => {
  event.preventDefault();
  x.value = event.clientX;
  y.value = event.clientY;
  visible.value = true;

  await nextTick();

  if (menuEl.value) {
    const rect = menuEl.value.getBoundingClientRect();

    x.value = Math.min(x.value, window.innerWidth - rect.width - 4);
    y.value = Math.min(y.value, window.innerHeight - rect.height - 4);
  }

  document.addEventListener("pointerdown", onOutsidePointer, true);
  document.addEventListener("keydown", onKeydown, true);
};

const run = (item: MenuItem) => {
  hide();
  item.command?.();
};

onBeforeUnmount(hide);

defineExpose({ show, hide });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuEl"
      class="fixed z-[70] min-w-40 rounded-md border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-1 shadow-lg"
      :style="{ left: `${String(x)}px`, top: `${String(y)}px` }"
      role="menu"
    >
      <button
        v-for="item in model"
        :key="item.label"
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-left text-surface-700 dark:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
        @click="run(item)"
      >
        <component :is="item.icon" v-if="item.icon" class="w-4 h-4 text-surface-400" aria-hidden="true" />
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>
