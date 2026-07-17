<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { computed } from "vue";
import Button from "./Button.vue";
import Dialog from "./Dialog.vue";
import { pendingConfirm } from "./confirm";

const open = computed({
  get: () => pendingConfirm.value !== null,
  set: (value: boolean) => {
    if (!value) dismiss();
  },
});

// Closing by any means other than Accept counts as a rejection, matching
// the PrimeVue service this replaced.
const dismiss = () => {
  const confirm = pendingConfirm.value;

  pendingConfirm.value = null;
  confirm?.reject?.();
};

const accept = () => {
  const confirm = pendingConfirm.value;

  pendingConfirm.value = null;
  confirm?.accept?.();
};
</script>

<template>
  <Dialog v-model:open="open" :title="pendingConfirm?.header ?? 'Confirm'">
    <div v-if="pendingConfirm" class="flex items-center gap-3">
      <TriangleAlert class="w-6 h-6 shrink-0 text-yellow-500" aria-hidden="true" />
      <p>{{ pendingConfirm.message }}</p>
    </div>
    <template #footer>
      <Button variant="ghost" @click="dismiss">
        {{ pendingConfirm?.rejectLabel ?? "Cancel" }}
      </Button>
      <Button variant="danger" autofocus @click="accept">
        {{ pendingConfirm?.acceptLabel ?? "Confirm" }}
      </Button>
    </template>
  </Dialog>
</template>
