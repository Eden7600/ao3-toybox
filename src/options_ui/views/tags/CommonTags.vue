<script setup lang="ts">
import { db } from "@src/common/db/Database";
import type { CommonTag } from "@src/common/models/CommonTag";
import { computed, onMounted, ref } from "vue";

import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Column from "primevue/column";
import ConfirmDialog from "primevue/confirmdialog";
import ContextMenu from "primevue/contextmenu";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Toast from "primevue/toast";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

const commonTags = ref<CommonTag[]>([]);
const loading = ref(true);
const globalFilterValue = ref("");
const selectedTag = ref<CommonTag | null>(null);
const cm = ref();
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

const filters = ref({
  global: { value: null, matchMode: "contains" },
  name: { value: null, matchMode: "startsWith" },
  color: { value: null, matchMode: "startsWith" },
  aliases: { value: null, matchMode: "contains" },
  hideWork: { value: null, matchMode: "equals" },
  hideTag: { value: null, matchMode: "equals" },
});

const menuModel = ref([
  {
    label: "Edit",
    icon: "pi pi-fw pi-pencil",
    command: () => openEditDialog(selectedTag.value!),
  },
  {
    label: "Delete",
    icon: "pi pi-fw pi-trash",
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
  cm.value.show(event.originalEvent);
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
    icon: "pi pi-exclamation-triangle",
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
  filters.value = {
    global: { value: null, matchMode: "contains" },
    name: { value: null, matchMode: "startsWith" },
    color: { value: null, matchMode: "startsWith" },
    aliases: { value: null, matchMode: "contains" },
    hideWork: { value: null, matchMode: "equals" },
    hideTag: { value: null, matchMode: "equals" },
  };
};
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg mb-4">
    <h1 class="text-2xl font-bold text-white">Highlighted Tags</h1>
    <p class="text-gray-400 text-lg">Manage and customize highlighted and hidden tags for the works browsing page</p>
  </div>

  <div class="card rounded-lg overflow-hidden overflow-x-auto">
    <Toast />
    <ConfirmDialog />
    <ContextMenu ref="cm" :model="menuModel" />

    <DataTable
      v-model:filters="filters"
      :value="filteredTags"
      v-model:contextMenuSelection="selectedTag"
      dataKey="id"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      :loading="loading"
      :globalFilterFields="['name', 'color', 'aliases']"
      filterDisplay="row"
      contextMenu
      @rowContextmenu="onRowContextMenu"
    >
      <template #header>
        <div class="flex flex-wrap justify-between items-center gap-2">
          <Button
            icon="pi pi-plus"
            label="New Tag"
            severity="success"
            class="mr-2"
            @click="openNewTagDialog"
          />
          <div class="flex items-center">
            <span class="mr-2">
              <InputText v-model="globalFilterValue" placeholder="Global Search" />
            </span>
            <Button icon="pi pi-filter-slash" @click="resetFilters" class="p-button-outlined" />
          </div>
        </div>
      </template>

      <Column field="name" header="Name" sortable :style="{ width: '25%' }">
        <template #body="slotProps">
          <span
            :style="{
              color: slotProps.data.color && slotProps.data.color !== 'fade' ? slotProps.data.color : 'inherit',
              opacity: slotProps.data.color === 'fade' ? 0.5 : 1,
            }"
          >
            {{ slotProps.data.name }}
          </span>
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <InputText
            v-model="filterModel.value"
            type="text"
            @input="filterCallback()"
            class="p-column-filter"
            placeholder="Search by name"
          />
        </template>
      </Column>
      <Column field="aliases" header="Aliases" sortable :style="{ width: '30%' }">
        <template #body="slotProps">
          {{ formatAliases(slotProps.data.aliases) }}
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <InputText
            v-model="filterModel.value"
            type="text"
            @input="filterCallback()"
            class="p-column-filter"
            placeholder="Search aliases"
          />
        </template>
      </Column>
      <Column field="color" header="Color" sortable :style="{ width: '20%' }">
        <template #body="slotProps">
          <div class="flex items-center">
            <div
              v-if="slotProps.data.color && slotProps.data.color !== 'fade'"
              class="w-5 h-5 mr-2 border-surface-800 border-1 rounded-full"
              :style="{ backgroundColor: slotProps.data.color }"
            ></div>
            <span :style="{ opacity: slotProps.data.color === 'fade' ? 0.5 : 1 }">
              {{
                slotProps.data.color === "fade"
                  ? "Fade"
                  : slotProps.data.color
                    ? slotProps.data.color.charAt(0).toUpperCase() + slotProps.data.color.slice(1)
                    : "No Color"
              }}
            </span>
          </div>
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <InputText
            v-model="filterModel.value"
            type="text"
            @input="filterCallback()"
            class="p-column-filter"
            placeholder="Search by color"
          />
        </template>
      </Column>
      <Column field="hideWork" header="Hide Work" dataType="boolean" sortable :style="{ width: '10%' }">
        <template #body="slotProps">
          <i
            class="pi"
            :class="{
              'pi-check-circle text-green-500': slotProps.data.hideWork,
              'pi-times-circle text-red-400': !slotProps.data.hideWork,
            }"
          ></i>
        </template>
      </Column>
      <Column field="hideTag" header="Hide Tag" dataType="boolean" sortable :style="{ width: '10%' }">
        <template #body="slotProps">
          <i
            class="pi"
            :class="{
              'pi-check-circle text-green-500': slotProps.data.hideTag,
              'pi-times-circle text-red-400': !slotProps.data.hideTag,
            }"
          ></i>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="editDialog" modal header="Edit Tag" :style="{ width: '30rem' }">
      <div class="p-fluid" v-if="editedTag">
        <div class="flex flex-col align-items-center gap-3">
          <label for="name" class="font-semibold">Name</label>
          <InputText id="name" v-model="editedTag.name" class="flex-auto" required />
        </div>
        <div class="flex flex-col align-items-center gap-3 mt-3">
          <div class="flex items-center">
            <label for="color" class="font-semibold mr-2">Color</label>
            <div
              class="w-5 h-5 border-surface-800 border-1 rounded-full"
              :style="{ backgroundColor: editedTag.color || 'transparent' }"
            ></div>
          </div>
          <div class="flex-grow w-full">
            <Select
              :pt="{ id: 'color' }"
              v-model="editedTag.color"
              :options="colors"
              class="w-full"
              optionLabel="name"
              optionValue="code"
            />
          </div>
        </div>
        <div class="flex flex-col align-items-center gap-3 mt-3">
          <label class="font-semibold">Options</label>
          <div class="flex-auto">
            <div class="flex align-items-center gap-2">
              <Checkbox :pt="{ id: 'hideWork' }" v-model="editedTag.hideWork" :binary="true" />
              <label for="hideWork">Hide Works</label>
            </div>
            <div class="flex align-items-center gap-2 mt-2">
              <Checkbox :pt="{ id: 'hideTag' }" v-model="editedTag.hideTag" :binary="true" />
              <label for="hideTag">Hide Tag</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col align-items-start gap-3 mb-3">
          <label for="aliases" class="font-semibold mt-2">Aliases</label>
          <Textarea
            id="aliases"
            v-model="aliasesText"
            autoResize
            class="flex-auto"
            placeholder="Enter aliases, one per line"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-content-end gap-2 mt-2">
          <Button label="Cancel" icon="pi pi-times" @click="editDialog = false" class="p-button-text" />
          <Button label="Save" icon="pi pi-check" @click="saveEditedTag" autofocus />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="newTagDialog" modal header="New Tag" :style="{ width: '30rem' }">
      <span class="p-text-secondary block mb-5">Create a new tag.</span>
      <div class="p-fluid">
        <div class="flex flex-col align-items-center gap-3 mb-3">
          <label for="newName" class="font-semibold">Name</label>
          <InputText id="newName" v-model="newTag.name" class="flex-auto" required />
        </div>
        <div class="flex flex-col align-items-center gap-3 mt-3">
          <div class="flex items-center">
            <label for="color" class="font-semibold mr-2">Color</label>
            <div
              class="w-5 h-5 border-surface-800 border-1 rounded-full"
              :style="{ backgroundColor: newTag.color || 'transparent' }"
            ></div>
          </div>
          <div class="flex-grow w-full">
            <Select
              v-model="newTag.color"
              :options="colors"
              class="w-full"
              optionLabel="name"
              optionValue="code"
            />
          </div>
        </div>
        <div class="flex flex-col align-items-center gap-3 mt-3">
          <label class="font-semibold">Options</label>
          <div class="flex-auto">
            <div class="flex align-items-center gap-2">
              <Checkbox :pt="{ id: 'newHideWork' }" v-model="newTag.hideWork" :binary="true" />
              <label for="newHideWork">Hide Works</label>
            </div>
            <div class="flex align-items-center gap-2 mt-2">
              <Checkbox :pt="{ id: 'newHideTag' }" v-model="newTag.hideTag" :binary="true" />
              <label for="newHideTag">Hide Tag</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col align-items-start gap-3">
          <label for="newAliases" class="font-semibold mt-2">Aliases</label>
          <Textarea
            id="newAliases"
            v-model="aliasesText"
            autoResize
            class="flex-auto"
            placeholder="Enter aliases, one per line"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-content-end gap-2">
          <Button label="Cancel" icon="pi pi-times" @click="newTagDialog = false" class="p-button-text" />
          <Button label="Save" icon="pi pi-check" @click="saveNewTag" autofocus />
        </div>
      </template>
    </Dialog>
  </div>
</template>

