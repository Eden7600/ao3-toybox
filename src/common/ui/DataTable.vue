<script setup lang="ts" generic="T">
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import Input from "./Input.vue";

import type { DataTableColumn } from "./types";

const props = withDefaults(
  defineProps<{
    value: T[];
    columns: DataTableColumn[];
    paginator?: boolean;
    rows?: number;
    rowsPerPageOptions?: number[];
    loading?: boolean;
  }>(),
  {
    paginator: false,
    rows: 10,
    rowsPerPageOptions: () => [5, 10, 20, 50],
    loading: false,
  },
);

const emit = defineEmits<{
  (e: "rowContextmenu", payload: { originalEvent: MouseEvent; data: T }): void;
}>();

const sortField = ref<string | null>(null);
const sortOrder = ref<1 | -1>(1);
const columnFilters = ref<Record<string, string>>({});
const page = ref(0);
const pageSize = ref(props.rows);

const hasFilterRow = computed(() => props.columns.some((col) => col.filter));

const cellValue = (row: T, field: string): unknown => (row as Record<string, unknown>)[field];

const cellText = (row: T, field: string): string => {
  const value = cellValue(row, field);

  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");

  return String(value);
};

const filtered = computed(() => {
  const active = Object.entries(columnFilters.value).filter(([, query]) => query.trim() !== "");

  if (active.length === 0) return props.value;

  return props.value.filter((row) =>
    active.every(([field, query]) =>
      cellText(row, field).toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );
});

const sorted = computed(() => {
  const field = sortField.value;

  if (!field) return filtered.value;

  return [...filtered.value].sort((a, b) => {
    const va = cellValue(a, field);
    const vb = cellValue(b, field);

    let result: number;

    if (typeof va === "number" && typeof vb === "number") {
      result = va - vb;
    } else if (typeof va === "boolean" && typeof vb === "boolean") {
      result = Number(va) - Number(vb);
    } else {
      result = cellText(a, field).localeCompare(cellText(b, field), undefined, {
        sensitivity: "base",
      });
    }

    return result * sortOrder.value;
  });
});

const pageCount = computed(() =>
  props.paginator ? Math.max(1, Math.ceil(sorted.value.length / pageSize.value)) : 1,
);

const paged = computed(() => {
  if (!props.paginator) return sorted.value;

  const start = page.value * pageSize.value;

  return sorted.value.slice(start, start + pageSize.value);
});

// Filtering or shrinking the data can strand the page index past the end
watch([filtered, pageSize], () => {
  page.value = Math.min(page.value, pageCount.value - 1);
});

const toggleSort = (col: DataTableColumn) => {
  if (!col.sortable) return;

  if (sortField.value === col.field) {
    sortOrder.value = sortOrder.value === 1 ? -1 : 1;
  } else {
    sortField.value = col.field;
    sortOrder.value = 1;
  }
};

/** Clear all per-column filter inputs (the global filter lives with the caller). */
const clearFilters = () => {
  columnFilters.value = {};
};

defineExpose({ clearFilters });

const rangeLabel = computed(() => {
  if (sorted.value.length === 0) return "0 of 0";

  const start = page.value * pageSize.value + 1;
  const end = Math.min((page.value + 1) * pageSize.value, sorted.value.length);

  return `${String(start)}–${String(end)} of ${String(sorted.value.length)}`;
});
</script>

<template>
  <div class="bg-surface-0 dark:bg-surface-900 text-surface-700 dark:text-surface-0">
    <div v-if="$slots.header" class="p-3 border-b border-surface-200 dark:border-surface-800">
      <slot name="header" />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-surface-200 dark:border-surface-800">
            <th
              v-for="col in columns"
              :key="col.field"
              scope="col"
              class="px-3 py-3 text-left font-semibold whitespace-nowrap"
              :style="col.width ? { width: col.width } : undefined"
              :aria-sort="
                sortField === col.field ? (sortOrder === 1 ? 'ascending' : 'descending') : undefined
              "
            >
              <button
                v-if="col.sortable"
                type="button"
                class="inline-flex items-center gap-1.5 cursor-pointer hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                @click="toggleSort(col)"
              >
                {{ col.header }}
                <ChevronUp v-if="sortField === col.field && sortOrder === 1" class="w-3.5 h-3.5" aria-hidden="true" />
                <ChevronDown v-else-if="sortField === col.field" class="w-3.5 h-3.5" aria-hidden="true" />
                <ChevronsUpDown v-else class="w-3.5 h-3.5 text-surface-400" aria-hidden="true" />
              </button>
              <template v-else>{{ col.header }}</template>
            </th>
          </tr>
          <tr v-if="hasFilterRow" class="border-b border-surface-200 dark:border-surface-800">
            <th v-for="col in columns" :key="col.field" class="px-3 py-2 font-normal">
              <Input
                v-if="col.filter"
                v-model="columnFilters[col.field]"
                type="text"
                class="w-full"
                :placeholder="col.filterPlaceholder ?? 'Search'"
                :aria-label="`Filter by ${col.header}`"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td :colspan="columns.length" class="px-3 py-8 text-center text-surface-400">
              <LoaderCircle class="w-5 h-5 animate-spin inline-block mr-2" aria-hidden="true" />
              Loading…
            </td>
          </tr>
          <tr v-else-if="paged.length === 0">
            <td :colspan="columns.length" class="px-3 py-8 text-center text-surface-400">
              No entries found.
            </td>
          </tr>
          <tr
            v-for="(row, index) in loading ? [] : paged"
            :key="index"
            class="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            @contextmenu="emit('rowContextmenu', { originalEvent: $event, data: row })"
          >
            <td v-for="col in columns" :key="col.field" class="px-3 py-3 align-middle">
              <slot :name="`cell-${col.field}`" :data="row">
                {{ cellText(row, col.field) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="paginator"
      class="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-surface-200 dark:border-surface-800 text-sm"
    >
      <span class="text-surface-500 dark:text-surface-400">{{ rangeLabel }}</span>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-2 text-surface-500 dark:text-surface-400">
          Rows
          <select
            v-model.number="pageSize"
            class="rounded border border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 px-2 py-1 text-surface-700 dark:text-surface-0 cursor-pointer"
          >
            <option v-for="option in rowsPerPageOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          :disabled="page === 0"
          aria-label="Previous page"
          @click="page--"
        >
          <ChevronLeft class="w-4 h-4" aria-hidden="true" />
        </button>
        <span class="text-surface-500 dark:text-surface-400">
          Page {{ page + 1 }} of {{ pageCount }}
        </span>
        <button
          type="button"
          class="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          :disabled="page >= pageCount - 1"
          aria-label="Next page"
          @click="page++"
        >
          <ChevronRight class="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
