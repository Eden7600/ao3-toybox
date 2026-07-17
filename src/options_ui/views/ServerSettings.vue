<script setup lang="ts">
import { normalizeServerUrl } from "@src/common/server-url";
import { authService } from "@src/common/services/auth-service";
import SettingsToggle from "@src/options_ui/components/SettingsToggle.vue";
import { useOptionsSettings } from "@src/options_ui/useOptionsSettings";
import { Eye, EyeOff, Zap } from "@lucide/vue";
import { computed, ref } from "vue";

import { Button, Input, useToast } from "@src/common/ui";

const { settings: localSettings } = useOptionsSettings("ServerSettings");
const toast = useToast();

const showToken = ref(false);
const testing = ref(false);

const serverUrlInvalid = computed(
  () =>
    localSettings.value.serverUrl.trim() !== "" &&
    normalizeServerUrl(localSettings.value.serverUrl) === null,
);

const serverConfigured = computed(
  () => normalizeServerUrl(localSettings.value.serverUrl) !== null,
);

const tokenPreview = computed(() => {
  const t = localSettings.value.apiToken;
  if (!t) return "";
  if (t.length <= 4) return "•".repeat(t.length);
  return `…${t.slice(-4)}`;
});

const onTestConnection = async () => {
  testing.value = true;
  try {
    const result = await authService.testConnection();
    if (result.ok) {
      toast.add({
        severity: "success",
        summary: "Connection successful",
        detail: `Server responded with status ${String(result.status)}`,
        life: 3000,
      });
    } else {
      toast.add({
        severity: "error",
        summary: "Connection failed",
        detail: result.error ?? `Server responded with status ${String(result.status)}`,
        life: 5000,
      });
    }
  } finally {
    testing.value = false;
  }
};
</script>

<template>
  <div class="p-4 bg-surface-900 rounded-lg flex items-center justify-between">
    <div class="flex flex-col">
      <h1 class="text-2xl font-bold text-white">Server Connection</h1>
      <p class="text-gray-400 text-lg">Configure server connection and authentication</p>
    </div>
  </div>

  <div class="px-4 pb-4 bg-surface-900 rounded-lg mt-3">
    <div class="divide-y divide-surface-800 text-white">
      <SettingsToggle
        v-model="localSettings.connectToServer"
        label="Connect to Server"
        description="Sync reading history through your server instead of this browser's local storage. While connected, local reading history is not used or updated"
      />

      <div class="py-4">
        <label class="block text-white font-medium mb-1" for="serverUrlInput">Server URL</label>
        <p class="text-gray-400 text-sm mb-2">
          Base URL of a compatible sync server (e.g.
          <code class="text-gray-300">https://example.com</code>). The
          extension ships without one — anyone can host their own. Nothing is
          contacted until a URL is set.
        </p>
        <Input
          id="serverUrlInput"
          v-model.lazy="localSettings.serverUrl"
          type="url"
          class="w-full"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://your-server.example"
          :invalid="serverUrlInvalid"
        />
        <p v-if="serverUrlInvalid" class="text-red-400 text-xs mt-2">
          Enter a full http(s) URL, e.g. https://example.com — server features
          stay off until this is valid.
        </p>
      </div>

      <div class="py-4">
        <label class="block text-white font-medium mb-1" for="apiTokenInput">API Token</label>
        <p class="text-gray-400 text-sm mb-2">
          Paste your personal API token. See the
          <a href="#" class="text-blue-400 hover:underline">setup guide</a>
          for how to obtain one. The token is stored locally in this browser only.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <Input
            id="apiTokenInput"
            v-model="localSettings.apiToken"
            :type="showToken ? 'text' : 'password'"
            class="flex-1"
            autocomplete="off"
            spellcheck="false"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            placeholder="Paste token here"
          />
          <Button
            variant="secondary"
            size="icon"
            :aria-label="showToken ? 'Hide token' : 'Show token'"
            @click="showToken = !showToken"
          >
            <EyeOff v-if="showToken" class="w-4 h-4" aria-hidden="true" />
            <Eye v-else class="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            :loading="testing"
            :disabled="!localSettings.apiToken || !serverConfigured"
            @click="onTestConnection"
          >
            <Zap class="w-4 h-4" aria-hidden="true" />
            Test connection
          </Button>
        </div>
        <p v-if="tokenPreview" class="text-gray-500 text-xs mt-2">
          Current: {{ tokenPreview }}
        </p>
      </div>
    </div>
  </div>
</template>
