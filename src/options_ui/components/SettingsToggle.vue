<script setup lang="ts">
import { computed } from "vue";
import ToggleSwitch from "primevue/toggleswitch";

interface Props {
  modelValue: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  dataTestId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  disabled: false,
  dataTestId: "settings-toggle",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "change", value: boolean): void;
}>();

const model = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit("update:modelValue", value);
    emit("change", value);
  },
});

const toggleId = computed(() => `toggle-${props.label.toLowerCase().replace(/\s+/g, "-")}`);
</script>

<template>
  <div class="flex justify-between items-center py-4" :data-testid="dataTestId">
    <div class="flex flex-col flex-grow pr-4">
      <label :for="toggleId" class="text-lg font-semibold text-white cursor-pointer">
        {{ label }}
      </label>
      <p v-if="description" class="text-base font-normal text-gray-400 mt-1">
        {{ description }}
      </p>
    </div>
    <ToggleSwitch
      :id="toggleId"
      v-model="model"
      :disabled="disabled"
      :aria-label="label"
      class="cursor-pointer"
    />
  </div>
</template>
