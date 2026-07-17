<script setup lang="ts">
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "@lucide/vue";
import type { Component } from "vue";
import { dismissToast, toasts, type ToastSeverity } from "./toast";

const icons: Record<ToastSeverity, Component> = {
  success: CircleCheck,
  info: Info,
  warn: TriangleAlert,
  error: CircleX,
};

const severityClasses: Record<ToastSeverity, string> = {
  success: "border-green-500/50 text-green-600 dark:text-green-400",
  info: "border-blue-500/50 text-blue-600 dark:text-blue-400",
  warn: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
  error: "border-red-500/50 text-red-600 dark:text-red-400",
};
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="region" aria-label="Notifications">
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-x-4"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          role="alert"
          class="flex items-start gap-3 rounded-lg border bg-surface-0 dark:bg-surface-900 p-3 shadow-lg"
          :class="severityClasses[toast.severity]"
        >
          <component :is="icons[toast.severity]" class="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm text-surface-700 dark:text-surface-0">
              {{ toast.summary }}
            </p>
            <p v-if="toast.detail" class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
              {{ toast.detail }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded p-0.5 text-surface-400 hover:text-surface-700 dark:hover:text-surface-0 cursor-pointer"
            aria-label="Dismiss"
            @click="dismissToast(toast.id)"
          >
            <X class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
