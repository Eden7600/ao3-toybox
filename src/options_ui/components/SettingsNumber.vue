<script setup lang="ts">
import { computed } from "vue";

import { NumberInput } from "@src/common/ui";

interface Props {
  modelValue: number;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  maxFractionDigits?: number;
  disabled?: boolean;
  dataTestId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  min: 0,
  max: 100,
  step: 1,
  maxFractionDigits: 0,
  disabled: false,
  dataTestId: "settings-number",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
  (e: "change", value: number): void;
}>();

const model = computed({
  get: () => props.modelValue,
  set: (value: number) => {
    emit("update:modelValue", value);
    emit("change", value);
  },
});

const inputId = computed(() => `number-${props.label.toLowerCase().replace(/\s+/g, "-")}`);
</script>

<template>
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4"
    :data-testid="dataTestId"
  >
    <div class="flex flex-col flex-grow">
      <label :for="inputId" class="text-lg font-semibold text-white cursor-pointer">
        {{ label }}
      </label>
      <p v-if="description" class="text-base font-normal text-gray-400 mt-1">
        {{ description }}
      </p>
    </div>
    <NumberInput
      :id="inputId"
      v-model="model"
      :min="min"
      :max="max"
      :step="step"
      :max-fraction-digits="maxFractionDigits"
      :disabled="disabled"
      :aria-label="label"
    />
  </div>
</template>
