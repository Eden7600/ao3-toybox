<script setup lang="ts">
import { computed } from "vue";

import { MultiSelect } from "@src/common/ui";

interface Option {
  value: string;
  label: string;
}

interface Props {
  modelValue: Array<{ text: string; value: string }>;
  label: string;
  description?: string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  dataTestId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  placeholder: "Select options",
  disabled: false,
  dataTestId: "settings-multiselect",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: Array<{ text: string; value: string }>): void;
  (e: "change", value: Array<{ text: string; value: string }>): void;
}>();

const selectedValues = computed({
  get: () => props.modelValue.map((item) => item.value),
  set: (values: string[]) => {
    const selected = values.map((value) => {
      const option = props.options.find((opt) => opt.value === value);

      return {
        value,
        text: option?.label ?? value,
      };
    });
    emit("update:modelValue", selected);
    emit("change", selected);
  },
});

const multiSelectId = computed(() => `multiselect-${props.label.toLowerCase().replace(/\s+/g, "-")}`);
</script>

<template>
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4"
    :data-testid="dataTestId"
  >
    <div class="flex flex-col flex-grow">
      <label :for="multiSelectId" class="text-lg font-semibold text-white cursor-pointer">
        {{ label }}
      </label>
      <p v-if="description" class="text-base font-normal text-gray-400 mt-1">
        {{ description }}
      </p>
    </div>
    <div class="w-full sm:w-[20rem]">
      <MultiSelect
        :id="multiSelectId"
        v-model="selectedValues"
        :options="options"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="label"
        filter
      />
    </div>
  </div>
</template>
