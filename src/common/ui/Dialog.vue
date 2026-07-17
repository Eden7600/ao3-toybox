<script setup lang="ts">
import { X } from "@lucide/vue";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    /** Extra classes for the dialog panel, e.g. a width override. */
    contentClass?: string;
  }>(),
  { title: "", description: "", contentClass: "" },
);

const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/60" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[30rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-6 text-surface-700 dark:text-surface-0 shadow-xl focus:outline-none"
        :class="props.contentClass"
      >
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <DialogTitle class="text-lg font-semibold">
              <slot name="title">{{ props.title }}</slot>
            </DialogTitle>
            <DialogDescription
              v-if="props.description"
              class="text-sm text-surface-500 dark:text-surface-400 mt-1"
            >
              {{ props.description }}
            </DialogDescription>
          </div>
          <DialogClose
            class="rounded p-1 text-surface-400 hover:text-surface-700 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X class="w-4 h-4" aria-hidden="true" />
          </DialogClose>
        </div>

        <slot />

        <div v-if="$slots.footer" class="flex justify-end gap-2 mt-6">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
