<script setup lang="ts">
import { db } from "@src/common/db/Database";
import type { RegexTag } from "@src/common/models/RegexTag";
import { computed, onMounted, ref } from "vue";

import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Column from "primevue/column";
import ContextMenu from "primevue/contextmenu";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import InputText from "primevue/inputtext";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

const regexTags = ref<RegexTag[]>([]);
const loading = ref(true);
const globalFilterValue = ref("");
const selectedTag = ref<RegexTag | null>(null);
const contextMenu = ref();
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

const filters = ref({
  global: { value: null, matchMode: "contains" },
  name: { value: null, matchMode: "startsWith" },
  regex: { value: null, matchMode: "contains" },
  color: { value: null, matchMode: "startsWith" },
  hideWork: { value: null, matchMode: "equals" },
  hideTag: { value: null, matchMode: "equals" },
  caseInsensitive: { value: null, matchMode: "equals" },
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
  contextMenu.value.show(event.originalEvent);
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
    icon: "pi pi-exclamation-triangle",
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
      v-model:filters="filters"
      :value="filteredTags"
      v-model:contextMenuSelection="selectedTag"
      dataKey="id"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      :loading="loading"
      :globalFilterFields="['name', 'regex', 'color']"
      filterDisplay="row"
      contextMenu
      @rowContextmenu="onRowContextMenu"
    >
      <template #header>
        <div class="flex flex-wrap justify-between items-center gap-2">
          <Button
            icon="pi pi-plus"
            label="New Regex Tag"
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

      <Column field="name" header="Name" sortable :style="{ width: '20%' }">
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
      <Column field="regex" header="Regex" sortable :style="{ width: '30%' }">
        <template #filter="{ filterModel, filterCallback }">
          <InputText
            v-model="filterModel.value"
            type="text"
            @input="filterCallback()"
            class="p-column-filter"
            placeholder="Search regex"
          />
        </template>
      </Column>
      <Column field="color" header="Color" sortable :style="{ width: '15%' }">
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
      <Column field="caseInsensitive" header="Case Insensitive" dataType="boolean" sortable :style="{ width: '15%' }">
        <template #body="slotProps">
          <i
            class="pi"
            :class="{
              'pi-check-circle text-green-500': slotProps.data.caseInsensitive,
              'pi-times-circle text-red-400': !slotProps.data.caseInsensitive,
            }"
          ></i>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="editDialog" modal header="Edit Regex Tag" :style="{ width: '30rem' }">
      <div class="p-fluid" v-if="editedTag">
        <div class="flex flex-col align-items-center gap-3">
          <label for="name" class="font-semibold">Name</label>
          <InputText id="name" v-model="editedTag.name" class="flex-auto" required />
        </div>
        <div class="flex flex-col align-items-center gap-3 mt-3">
          <label for="regex" class="font-semibold">Regex</label>
          <InputText id="regex" v-model="editedTag.regex" class="flex-auto" required />
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
            <div class="flex align-items-center gap-2 mb-2">
              <Checkbox :pt="{ id: 'hideWork' }" v-model="editedTag.hideWork" :binary="true" />
              <label for="hideWork">Hide Works</label>
            </div>
            <div class="flex align-items-center gap-2 mb-2">
              <Checkbox :pt="{ id: 'hideTag' }" v-model="editedTag.hideTag" :binary="true" />
              <label for="hideTag">Hide Tag</label>
            </div>
            <div class="flex align-items-center gap-2">
              <Checkbox :pt="{ id: 'caseInsensitive' }" v-model="editedTag.caseInsensitive" :binary="true" />
              <label for="caseInsensitive">Case Insensitive</label>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-content-end gap-2 mt-2">
          <Button label="Cancel" icon="pi pi-times" @click="editDialog = false" class="p-button-text" />
          <Button label="Save" icon="pi pi-check" @click="saveEditedTag" autofocus />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="newTagDialog" modal header="New Regex Tag" :style="{ width: '30rem' }">
      <span class="p-text-secondary block mb-5">Create a new regex tag.</span>
      <div class="p-fluid">
        <div class="flex flex-col align-items-center gap-3 mb-3">
          <label for="newName" class="font-semibold">Name</label>
          <InputText id="newName" v-model="newTag.name" class="flex-auto" required />
        </div>
        <div class="flex flex-col align-items-center gap-3 mt-3">
          <label for="newRegex" class="font-semibold">Regex</label>
          <InputText id="newRegex" v-model="newTag.regex" class="flex-auto" required />
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
              :pt="{ id: 'color' }"
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
            <div class="flex align-items-center gap-2 mb-2">
              <Checkbox :pt="{ id: 'newHideWork' }" v-model="newTag.hideWork" :binary="true" />
              <label for="newHideWork">Hide Works</label>
            </div>
            <div class="flex align-items-center gap-2">
              <Checkbox :pt="{ id: 'newCaseInsensitive' }" v-model="newTag.caseInsensitive" :binary="true" />
              <label for="newCaseInsensitive">Case Insensitive</label>
            </div>
            <div class="flex align-items-center gap-2 mt-2">
              <Checkbox :pt="{ id: 'newHideTag' }" v-model="newTag.hideTag" :binary="true" />
              <label for="newHideTag">Hide Tag</label>
            </div>
          </div>
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
@src/common/db/Database@src/common/models/RegexTag
