<script setup lang="ts">
import { db } from "@src/common/db/Database";
import type { CommonTag } from "@src/common/models/CommonTag";
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
  Textarea,
  useConfirm,
  useToast,
  type DataTableColumn,
  type MenuItem,
} from "@src/common/ui";

const commonTags = ref<CommonTag[]>([]);
const loading = ref(true);
const globalFilterValue = ref("");
const selectedTag = ref<CommonTag | null>(null);
const cm = ref<InstanceType<typeof ContextMenu>>();
const table = ref<InstanceType<typeof DataTable>>();
const editDialog = ref(false);
const newTagDialog = ref(false);
const editedTag = ref<CommonTag | null>(null);
const newTag = ref<CommonTag>({
  id: 0,
  name: "",
  color: "",
  aliases: [],
  hideWork: false,
  hideTag: false,
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
const aliasesText = ref("");

const columns: DataTableColumn[] = [
  { field: "name", header: "Name", sortable: true, filter: true, filterPlaceholder: "Search by name", width: "25%" },
  { field: "aliases", header: "Aliases", sortable: true, filter: true, filterPlaceholder: "Search aliases", width: "30%" },
  { field: "color", header: "Color", sortable: true, filter: true, filterPlaceholder: "Search by color", width: "20%" },
  { field: "hideWork", header: "Hide Work", sortable: true, width: "10%" },
  { field: "hideTag", header: "Hide Tag", sortable: true, width: "10%" },
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
    commonTags.value = await db.commonTags.toArray();
  } catch (error) {
    console.error("Failed to fetch common tags:", error);
    toast.add({ severity: "error", summary: "Error", detail: "Failed to load common tags", life: 3000 });
  } finally {
    loading.value = false;
  }
});

const filteredTags = computed(() => {
  if (globalFilterValue.value) {
    return commonTags.value.filter(
      (tag) =>
        tag.name.toLowerCase().includes(globalFilterValue.value.toLowerCase()) ||
        (tag.aliases &&
          tag.aliases.some((alias) => alias.toLowerCase().includes(globalFilterValue.value.toLowerCase()))),
    );
  }
  return commonTags.value;
});

const onRowContextMenu = (event: { originalEvent: MouseEvent; data: CommonTag }) => {
  selectedTag.value = event.data;
  cm.value?.show(event.originalEvent);
};

const openEditDialog = (tag: CommonTag) => {
  editedTag.value = { ...tag };
  aliasesText.value = editedTag.value.aliases ? editedTag.value.aliases.join("\n") : "";
  editDialog.value = true;
};

const openNewTagDialog = () => {
  newTag.value = {
    id: 0,
    name: "",
    color: "",
    aliases: [],
    hideWork: false,
    hideTag: false,
  };
  aliasesText.value = "";
  newTagDialog.value = true;
};

const confirmDeleteTag = (tag: CommonTag) => {
  confirm.require({
    message: `Are you sure you want to delete the tag "${tag.name}"?`,
    header: "Confirm Deletion",
    acceptLabel: "Delete",
    accept: () => deleteTag(tag),
    reject: () => {
      toast.add({ severity: "info", summary: "Cancelled", detail: "Tag deletion cancelled", life: 3000 });
    },
  });
};

const deleteTag = async (tag: CommonTag) => {
  try {
    await db.commonTags.delete(tag.id);
    commonTags.value = commonTags.value.filter((t) => t.id !== tag.id);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: `Tag "${tag.name}" deleted successfully`,
      life: 3000,
    });
  } catch (error) {
    console.error("Failed to delete tag:", error);
    toast.add({ severity: "error", summary: "Error", detail: "Failed to delete tag", life: 3000 });
  } finally {
    selectedTag.value = null;
  }
};

const saveEditedTag = async () => {
  if (editedTag.value && editedTag.value.name.trim()) {
    try {
      // Create a new object with only the properties we want to store
      const tagToUpdate = {
        id: editedTag.value.id,
        name: editedTag.value.name,
        color: editedTag.value.color,
        aliases: aliasesText.value
          .split("\n")
          .map((alias) => alias.trim())
          .filter((alias) => alias !== ""),
        hideWork: editedTag.value.hideWork,
        hideTag: editedTag.value.hideTag,
      };

      await db.commonTags.update(tagToUpdate.id, tagToUpdate);

      const index = commonTags.value.findIndex((tag) => tag.id === tagToUpdate.id);
      if (index !== -1) {
        commonTags.value[index] = { ...tagToUpdate };
      }
      editDialog.value = false;
      toast.add({ severity: "success", summary: "Success", detail: "Tag updated successfully", life: 3000 });
    } catch (error) {
      console.error("Failed to update tag:", error);
      toast.add({ severity: "error", summary: "Error", detail: "Failed to update tag", life: 3000 });
    }
  } else {
    toast.add({ severity: "error", summary: "Error", detail: "Tag name is required", life: 3000 });
  }
};

const saveNewTag = async () => {
  if (newTag.value.name.trim()) {
    try {
      newTag.value.aliases = aliasesText.value
        .split("\n")
        .map((alias) => alias.trim())
        .filter((alias) => alias !== "");

      const savedTag = {
        ...newTag.value,
        hideWork: newTag.value.hideWork,
        hideTag: newTag.value.hideTag,
      };
      const id = await db.commonTags.add(savedTag);
      savedTag.id = id;
      commonTags.value.push({ ...savedTag });
      newTagDialog.value = false;
      toast.add({
        severity: "success",
        summary: "Success",
        detail: "New tag added successfully",
        life: 3000,
      });
    } catch (error) {
      console.error("Failed to add new tag:", error);
      toast.add({ severity: "error", summary: "Error", detail: "Failed to add new tag", life: 3000 });
    }
  } else {
    toast.add({ severity: "error", summary: "Error", detail: "Tag name is required", life: 3000 });
  }
};

const formatAliases = (aliases: string[] | undefined) => {
  if (!aliases || aliases.length === 0) return "No aliases";
  if (aliases.length <= 3) return aliases.join(", ");
  return `${aliases.slice(0, 3).join(", ")} (${aliases.length - 3} more)`;
};

const resetFilters = () => {
  globalFilterValue.value = "";
  table.value?.clearFilters();
};
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg mb-4">
    <h1 class="text-2xl font-bold text-white">Highlighted Tags</h1>
    <p class="text-gray-400 text-lg">Manage and customize highlighted and hidden tags for the works browsing page</p>
  </div>

  <div class="card rounded-lg overflow-hidden overflow-x-auto">
    <ContextMenu ref="cm" :model="menuModel" />

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
            New Tag
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

      <template #cell-aliases="{ data }">
        {{ formatAliases(data.aliases) }}
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
    </DataTable>

    <Dialog v-model:open="editDialog" title="Edit Tag">
      <div v-if="editedTag">
        <div class="flex flex-col gap-3">
          <label for="name" class="font-semibold">Name</label>
          <Input id="name" v-model="editedTag.name" class="w-full" required />
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
            <div class="flex items-center gap-2">
              <Checkbox id="hideWork" v-model="editedTag.hideWork" />
              <label for="hideWork">Hide Works</label>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <Checkbox id="hideTag" v-model="editedTag.hideTag" />
              <label for="hideTag">Hide Tag</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-start gap-3 mb-3">
          <label for="aliases" class="font-semibold mt-2">Aliases</label>
          <Textarea
            id="aliases"
            v-model="aliasesText"
            auto-resize
            class="w-full"
            placeholder="Enter aliases, one per line"
          />
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

    <Dialog v-model:open="newTagDialog" title="New Tag" description="Create a new tag.">
      <div>
        <div class="flex flex-col gap-3 mb-3">
          <label for="newName" class="font-semibold">Name</label>
          <Input id="newName" v-model="newTag.name" class="w-full" required />
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
            <div class="flex items-center gap-2">
              <Checkbox id="newHideWork" v-model="newTag.hideWork" />
              <label for="newHideWork">Hide Works</label>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <Checkbox id="newHideTag" v-model="newTag.hideTag" />
              <label for="newHideTag">Hide Tag</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-start gap-3">
          <label for="newAliases" class="font-semibold mt-2">Aliases</label>
          <Textarea
            id="newAliases"
            v-model="aliasesText"
            auto-resize
            class="w-full"
            placeholder="Enter aliases, one per line"
          />
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
