import { ref } from "vue";

export type ToastSeverity = "success" | "info" | "warn" | "error";

export type ToastOptions = {
  severity: ToastSeverity;
  summary: string;
  detail?: string;
  /** Milliseconds before the toast auto-dismisses. Sticky when omitted. */
  life?: number;
};

export type ToastMessage = ToastOptions & {
  id: number;
};

let nextId = 0;

/**
 * Module-level store: any component (or composable) can add toasts, the
 * single <Toaster /> mounted in App.vue renders them. Same shape as the
 * PrimeVue toast service this replaced.
 */
export const toasts = ref<ToastMessage[]>([]);

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function useToast(): { add: (options: ToastOptions) => void } {
  return {
    add(options: ToastOptions) {
      const message: ToastMessage = { ...options, id: nextId++ };

      toasts.value = [...toasts.value, message];

      if (options.life) {
        setTimeout(() => {
          dismissToast(message.id);
        }, options.life);
      }
    },
  };
}
