<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "success" | "danger" | "outline" | "ghost";
type Size = "sm" | "md" | "icon";

withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: "primary",
    size: "md",
    loading: false,
    disabled: false,
  },
);

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 dark:bg-primary-400 dark:text-surface-900 dark:hover:bg-primary-300",
  secondary:
    "bg-surface-200 text-surface-700 hover:bg-surface-300 dark:bg-surface-800 dark:text-surface-100 dark:hover:bg-surface-700",
  success:
    "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:text-surface-950 dark:hover:bg-green-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-surface-950 dark:hover:bg-red-400",
  outline:
    "border border-primary-500 text-primary-500 hover:bg-primary-500/10 dark:border-primary-400 dark:text-primary-400",
  ghost:
    "text-primary-500 hover:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-400/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm gap-1.5",
  md: "px-3 py-2 text-sm gap-2",
  icon: "w-9 h-9 justify-center",
};
</script>

<template>
  <button
    type="button"
    :disabled="disabled || loading"
    :class="
      cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variantClasses[variant],
        sizeClasses[size],
      )
    "
  >
    <LoaderCircle v-if="loading" class="w-4 h-4 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
