<script setup lang="ts">
import { Check, Timer } from "@lucide/vue";
import { wpmFromTest } from "@src/common/reading-time";
import { computed, ref } from "vue";

// Public domain (Alice's Adventures in Wonderland, ch. 1)
const PASSAGE = `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice, "without pictures or conversations?" So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her. There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, "Oh dear! Oh dear! I shall be too late!" But when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket or a watch to take out of it, and burning with curiosity, she ran across the field after it.`;

const PASSAGE_WORDS = PASSAGE.trim().split(/\s+/).length;

const props = defineProps<{
  currentWpm: number;
}>();

const emit = defineEmits<{
  (e: "adopt", wpm: number): void;
}>();

type Phase = "idle" | "reading" | "done";

const phase = ref<Phase>("idle");
const result = ref<number | null>(null);
let startedAt = 0;

const start = () => {
  result.value = null;
  startedAt = performance.now();
  phase.value = "reading";
};

const finish = () => {
  result.value = wpmFromTest(PASSAGE_WORDS, performance.now() - startedAt);
  phase.value = "done";
};

const comparison = computed(() => {
  if (result.value === null) return "";

  const delta = result.value - props.currentWpm;

  if (Math.abs(delta) < 10) return "right at your current setting";

  return delta > 0
    ? `${String(delta)} WPM faster than your current setting`
    : `${String(-delta)} WPM slower than your current setting`;
});
</script>

<template>
  <div class="py-4">
    <div class="flex flex-col gap-1 mb-3">
      <span class="text-lg font-semibold text-white">Reading Speed Test</span>
      <p class="text-base font-normal text-gray-400">
        Read the passage at your normal pace ({{ PASSAGE_WORDS }} words), then
        hit Done — just for fun, or to calibrate the setting above
      </p>
    </div>

    <div v-if="phase === 'idle'">
      <button
        class="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-md text-sm font-medium text-white transition-colors"
        @click="start"
      >
        <Timer class="w-4 h-4 inline-block mr-1 align-text-bottom" aria-hidden="true" />
        Start reading
      </button>
    </div>

    <div v-else-if="phase === 'reading'">
      <blockquote
        class="p-4 mb-3 bg-surface-800 rounded-lg text-gray-200 leading-relaxed"
      >
        {{ PASSAGE }}
      </blockquote>
      <button
        class="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-md text-sm font-medium text-white transition-colors"
        @click="finish"
      >
        <Check class="w-4 h-4 inline-block mr-1 align-text-bottom" aria-hidden="true" />
        Done reading
      </button>
    </div>

    <div v-else class="flex flex-col gap-3">
      <p v-if="result !== null" class="text-white text-lg">
        <span class="font-bold">{{ result }} WPM</span>
        <span class="text-gray-400 text-base"> — {{ comparison }}</span>
      </p>
      <p v-else class="text-gray-400">
        That was too quick to measure — try again.
      </p>
      <div class="flex gap-2">
        <button
          v-if="result !== null"
          class="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-md text-sm font-medium text-white transition-colors"
          @click="emit('adopt', result)"
        >
          Use as my speed
        </button>
        <button
          class="px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-md text-sm font-medium text-white transition-colors"
          @click="start"
        >
          Retake
        </button>
      </div>
    </div>
  </div>
</template>
