<script setup lang="ts">
import { Checkbox } from "@src/common/ui";

defineProps({
  modelValue: Boolean,
  label: String,
  description: String,
  id: String,
});

const model = defineModel<boolean>();
</script>

<template>
  <div class="flex items-center py-2.5 px-2">
    <Checkbox :id="id" v-model="model" size="sm" />
    <label :for="id" class="ml-2 text-sm text-gray-300 cursor-pointer">
      {{ label }}
    </label>
  </div>
</template>
