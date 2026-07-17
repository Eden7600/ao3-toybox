<script setup lang="ts">
import { computed } from "vue";

import { Select } from "@src/common/ui";

interface Option {
  value: string;
  label: string;
}

interface Props {
  modelValue: string;
  label: string;
  description?: string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  dataTestId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  description: "",
  placeholder: "Select an option",
  disabled: false,
  dataTestId: "settings-dropdown",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string, option: Option | undefined): void;
}>();

const selectedOption = computed({
  get: () => props.modelValue,
  set: (value: string) => {
    emit("update:modelValue", value);
    const selectedOption = props.options.find((option) => option.value === value);
    emit("change", value, selectedOption);
  },
});

const dropdownId = computed(() => `dropdown-${props.label.toLowerCase().replace(/\s+/g, "-")}`);
</script>

<template>
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4"
    :data-testid="dataTestId"
  >
    <div class="flex flex-col flex-grow">
      <label :for="dropdownId" class="text-lg font-semibold text-white cursor-pointer">
        {{ label }}
      </label>
      <p v-if="description" class="text-base font-normal text-gray-400 mt-1">
        {{ description }}
      </p>
    </div>
    <div class="w-full sm:w-[16rem]">
      <Select
        :id="dropdownId"
        v-model="selectedOption"
        :options="options"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="label"
      />
    </div>
  </div>
</template>
