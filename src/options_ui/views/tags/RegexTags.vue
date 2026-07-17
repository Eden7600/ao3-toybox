<script setup lang="ts">
import { db } from "@src/common/db/Database";
import type { RegexTag } from "@src/common/models/RegexTag";
import { computed, onMounted, ref } from "vue";

import { Check, CircleCheck, CircleX, FilterX, Pencil, Plus, Trash2, X } from "@lucide/vue";

import {
  Button,
  Checkbox,
  ContextMenu,
  DataTable,
  Dialog,
  Input,
  Select,
  useConfirm,
  useToast,
  type DataTableColumn,
  type MenuItem,
} from "@src/common/ui";

const regexTags = ref<RegexTag[]>([]);
const loading = ref(true);
const globalFilterValue = ref("");
const selectedTag = ref<RegexTag | null>(null);
const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const table = ref<InstanceType<typeof DataTable>>();
const editDialog = ref(false);
const newTagDialog = ref(false);
const editedTag = ref<RegexTag | null>(null);
const newTag = ref<RegexTag>({
  name: "",
  regex: "",
  color: null,
  hideWork: false,
  hideTag: false,
  caseInsensitive: false,
});
const colors = ref([
  { name: "Red", code: "red" },
  { name: "Orange", code: "orange" },
  { name: "Yellow", code: "yellow" },
  { name: "Lime", code: "lime" },
  { name: "Green", code: "green" },
  { name: "Blue", code: "blue" },
  { name: "Purple", code: "purple" },
  { name: "Fade", code: "fade" },
]);
const toast = useToast();
const confirm = useConfirm();

const columns: DataTableColumn[] = [
  { field: "name", header: "Name", sortable: true, filter: true, filterPlaceholder: "Search by name", width: "20%" },
  { field: "regex", header: "Regex", sortable: true, filter: true, filterPlaceholder: "Search regex", width: "30%" },
  { field: "color", header: "Color", sortable: true, filter: true, filterPlaceholder: "Search by color", width: "15%" },
  { field: "hideWork", header: "Hide Work", sortable: true, width: "10%" },
  { field: "hideTag", header: "Hide Tag", sortable: true, width: "10%" },
  { field: "caseInsensitive", header: "Case Insensitive", sortable: true, width: "15%" },
];

const menuModel = ref<MenuItem[]>([
  {
    label: "Edit",
    icon: Pencil,
    command: () => openEditDialog(selectedTag.value!),
  },
  {
    label: "Delete",
    icon: Trash2,
    command: () => confirmDeleteTag(selectedTag.value!),
  },
]);

onMounted(async () => {
  try {
    regexTags.value = await db.regexTags.toArray();
  } catch (error) {
    console.error("Failed to fetch regex tags:", error);
    toast.add({ severity: "error", summary: "Error", detail: "Failed to load regex tags", life: 3000 });
  } finally {
    loading.value = false;
  }
});

const filteredTags = computed(() => {
  if (globalFilterValue.value) {
    return regexTags.value.filter(
      (tag) =>
        tag.name.toLowerCase().includes(globalFilterValue.value.toLowerCase()) ||
        tag.regex.toLowerCase().includes(globalFilterValue.value.toLowerCase()),
    );
  }
  return regexTags.value;
});

const onRowContextMenu = (event: { originalEvent: MouseEvent; data: RegexTag }) => {
  selectedTag.value = event.data;
  contextMenu.value?.show(event.originalEvent);
};

const openEditDialog = (tag: RegexTag) => {
  editedTag.value = { ...tag };
  editDialog.value = true;
};

const openNewTagDialog = () => {
  newTag.value = {
    id: 0,
    name: "",
    regex: "",
    color: "",
    hideWork: false,
    hideTag: false,
    caseInsensitive: false,
  };
  newTagDialog.value = true;
};

const confirmDeleteTag = (tag: RegexTag) => {
  confirm.require({
    message: `Are you sure you want to delete the regex tag "${tag.name}"?`,
    header: "Confirm Deletion",
    acceptLabel: "Delete",
    accept: () => deleteTag(tag),
    reject: () => {
      toast.add({ severity: "info", summary: "Cancelled", detail: "Tag deletion cancelled", life: 3000 });
    },
  });
};

const deleteTag = async (tag: RegexTag) => {
  try {
    await db.regexTags.delete(tag.id!);
    regexTags.value = regexTags.value.filter((t) => t.id !== tag.id);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: `Regex tag "${tag.name}" deleted successfully`,
      life: 3000,
    });
  } catch (error) {
    console.error("Failed to delete regex tag:", error);
    toast.add({ severity: "error", summary: "Error", detail: "Failed to delete regex tag", life: 3000 });
  } finally {
    selectedTag.value = null;
  }
};

const saveEditedTag = async () => {
  if (editedTag.value && editedTag.value.name.trim() && editedTag.value.regex.trim()) {
    try {
      const sanitizedTag = {
        id: editedTag.value.id,
        name: editedTag.value.name.trim(),
        regex: editedTag.value.regex.trim(),
        color: editedTag.value.color,
        hideWork: editedTag.value.hideWork,
        hideTag: editedTag.value.hideTag,
        caseInsensitive: editedTag.value.caseInsensitive ?? false,
        updated_at: new Date(),
      };
      await db.regexTags.update(sanitizedTag.id!, sanitizedTag);
      const index = regexTags.value.findIndex((tag) => tag.id === sanitizedTag.id);
      if (index !== -1) {
        regexTags.value[index] = { ...sanitizedTag };
      }
      editDialog.value = false;
      toast.add({
        severity: "success",
        summary: "Success",
        detail: "Regex tag updated successfully",
        life: 3000,
      });
    } catch (error) {
      console.error("Failed to update regex tag:", error);
      toast.add({ severity: "error", summary: "Error", detail: "Failed to update regex tag", life: 3000 });
    }
  } else {
    toast.add({ severity: "error", summary: "Error", detail: "Tag name and regex are required", life: 3000 });
  }
};

const saveNewTag = async () => {
  if (newTag.value.name.trim() && newTag.value.regex.trim()) {
    try {
      const sanitizedTag = {
        name: newTag.value.name.trim(),
        regex: newTag.value.regex.trim(),
        color: newTag.value.color,
        hideWork: newTag.value.hideWork,
        hideTag: newTag.value.hideTag,
        caseInsensitive: newTag.value.caseInsensitive ?? false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const id = await db.regexTags.add(sanitizedTag);
      regexTags.value.push({ ...sanitizedTag, id });
      newTagDialog.value = false;
      toast.add({
        severity: "success",
        summary: "Success",
        detail: "New regex tag added successfully",
        life: 3000,
      });
    } catch (error) {
      console.error("Failed to add new regex tag:", error);
      toast.add({ severity: "error", summary: "Error", detail: "Failed to add new regex tag", life: 3000 });
    }
  } else {
    toast.add({ severity: "error", summary: "Error", detail: "Tag name and regex are required", life: 3000 });
  }
};

const resetFilters = () => {
  globalFilterValue.value = "";
  table.value?.clearFilters();
};
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg mb-4">
    <h1 class="text-2xl font-bold text-white">Regex Tags</h1>
    <p class="text-gray-400 text-lg">
      Manage and customize regex tags for the works browsing page. Regex tags may be used when AO3 supported
      common tags are not available, and can be used to hide works based on their content, or to highlight
      Tags.
    </p>
  </div>

  <div class="card rounded-lg overflow-hidden overflow-x-auto">
    <ContextMenu ref="contextMenu" :model="menuModel" />

    <DataTable
      ref="table"
      :value="filteredTags"
      :columns="columns"
      paginator
      :rows="10"
      :rows-per-page-options="[5, 10, 20, 50]"
      :loading="loading"
      @row-contextmenu="onRowContextMenu"
    >
      <template #header>
        <div class="flex flex-wrap justify-between items-center gap-2">
          <Button variant="success" class="mr-2" @click="openNewTagDialog">
            <Plus class="w-4 h-4" aria-hidden="true" />
            New Regex Tag
          </Button>
          <div class="flex items-center gap-2">
            <Input v-model="globalFilterValue" placeholder="Global Search" />
            <Button variant="outline" size="icon" aria-label="Reset filters" @click="resetFilters">
              <FilterX class="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </template>

      <template #cell-name="{ data }">
        <span
          :style="{
            color: data.color && data.color !== 'fade' ? data.color : 'inherit',
            opacity: data.color === 'fade' ? 0.5 : 1,
          }"
        >
          {{ data.name }}
        </span>
      </template>

      <template #cell-color="{ data }">
        <div class="flex items-center">
          <div
            v-if="data.color && data.color !== 'fade'"
            class="w-5 h-5 mr-2 border-surface-800 border rounded-full"
            :style="{ backgroundColor: data.color }"
          ></div>
          <span :style="{ opacity: data.color === 'fade' ? 0.5 : 1 }">
            {{
              data.color === "fade"
                ? "Fade"
                : data.color
                  ? data.color.charAt(0).toUpperCase() + data.color.slice(1)
                  : "No Color"
            }}
          </span>
        </div>
      </template>

      <template #cell-hideWork="{ data }">
        <CircleCheck v-if="data.hideWork" class="w-5 h-5 text-green-500" aria-label="Yes" />
        <CircleX v-else class="w-5 h-5 text-red-400" aria-label="No" />
      </template>

      <template #cell-hideTag="{ data }">
        <CircleCheck v-if="data.hideTag" class="w-5 h-5 text-green-500" aria-label="Yes" />
        <CircleX v-else class="w-5 h-5 text-red-400" aria-label="No" />
      </template>

      <template #cell-caseInsensitive="{ data }">
        <CircleCheck v-if="data.caseInsensitive" class="w-5 h-5 text-green-500" aria-label="Yes" />
        <CircleX v-else class="w-5 h-5 text-red-400" aria-label="No" />
      </template>
    </DataTable>

    <Dialog v-model:open="editDialog" title="Edit Regex Tag">
      <div v-if="editedTag">
        <div class="flex flex-col gap-3">
          <label for="name" class="font-semibold">Name</label>
          <Input id="name" v-model="editedTag.name" class="w-full" required />
        </div>
        <div class="flex flex-col gap-3 mt-3">
          <label for="regex" class="font-semibold">Regex</label>
          <Input id="regex" v-model="editedTag.regex" class="w-full" required />
        </div>
        <div class="flex flex-col gap-3 mt-3">
          <div class="flex items-center">
            <label for="color" class="font-semibold mr-2">Color</label>
            <div
              class="w-5 h-5 border-surface-800 border rounded-full"
              :style="{ backgroundColor: editedTag.color || 'transparent' }"
            ></div>
          </div>
          <div class="flex-grow w-full">
            <Select
              id="color"
              v-model="editedTag.color"
              :options="colors"
              option-label="name"
              option-value="code"
            />
          </div>
        </div>
        <div class="flex flex-col gap-3 mt-3">
          <label class="font-semibold">Options</label>
          <div class="flex-auto">
            <div class="flex items-center gap-2 mb-2">
              <Checkbox id="hideWork" v-model="editedTag.hideWork" />
              <label for="hideWork">Hide Works</label>
            </div>
            <div class="flex items-center gap-2 mb-2">
              <Checkbox id="hideTag" v-model="editedTag.hideTag" />
              <label for="hideTag">Hide Tag</label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="caseInsensitive" v-model="editedTag.caseInsensitive" />
              <label for="caseInsensitive">Case Insensitive</label>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button variant="ghost" @click="editDialog = false">
          <X class="w-4 h-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button autofocus @click="saveEditedTag">
          <Check class="w-4 h-4" aria-hidden="true" />
          Save
        </Button>
      </template>
    </Dialog>

    <Dialog v-model:open="newTagDialog" title="New Regex Tag" description="Create a new regex tag.">
      <div>
        <div class="flex flex-col gap-3 mb-3">
          <label for="newName" class="font-semibold">Name</label>
          <Input id="newName" v-model="newTag.name" class="w-full" required />
        </div>
        <div class="flex flex-col gap-3 mt-3">
          <label for="newRegex" class="font-semibold">Regex</label>
          <Input id="newRegex" v-model="newTag.regex" class="w-full" required />
        </div>
        <div class="flex flex-col gap-3 mt-3">
          <div class="flex items-center">
            <label for="newColor" class="font-semibold mr-2">Color</label>
            <div
              class="w-5 h-5 border-surface-800 border rounded-full"
              :style="{ backgroundColor: newTag.color || 'transparent' }"
            ></div>
          </div>
          <div class="flex-grow w-full">
            <Select
              id="newColor"
              v-model="newTag.color"
              :options="colors"
              option-label="name"
              option-value="code"
            />
          </div>
        </div>
        <div class="flex flex-col gap-3 mt-3">
          <label class="font-semibold">Options</label>
          <div class="flex-auto">
            <div class="flex items-center gap-2 mb-2">
              <Checkbox id="newHideWork" v-model="newTag.hideWork" />
              <label for="newHideWork">Hide Works</label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="newCaseInsensitive" v-model="newTag.caseInsensitive" />
              <label for="newCaseInsensitive">Case Insensitive</label>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <Checkbox id="newHideTag" v-model="newTag.hideTag" />
              <label for="newHideTag">Hide Tag</label>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button variant="ghost" @click="newTagDialog = false">
          <X class="w-4 h-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button autofocus @click="saveNewTag">
          <Check class="w-4 h-4" aria-hidden="true" />
          Save
        </Button>
      </template>
    </Dialog>
  </div>
</template>
