<script setup lang="ts">
import type { ApiKeyCreated, ApiKeyRow } from '#shared/schemas/api-keys'

const keys = ref<ApiKeyRow[]>([])
const loading = ref(true)
const creating = ref(false)
const revokingId = ref<string | null>(null)
const error = ref<string | null>(null)
const newKeyName = ref('')
const createdKey = ref<ApiKeyCreated | null>(null)

async function loadKeys() {
  loading.value = true
  error.value = null
  try {
    const data = await $fetch<{ keys: ApiKeyRow[] }>('/api/api-keys')
    keys.value = data.keys
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load API keys'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadKeys()
})

async function createKey() {
  const name = newKeyName.value.trim()
  if (!name) return

  creating.value = true
  error.value = null
  try {
    const created = await $fetch<ApiKeyCreated>('/api/api-keys', {
      method: 'POST',
      body: { name },
    })
    createdKey.value = created
    newKeyName.value = ''
    keys.value = [created, ...keys.value]
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to create API key'
  }
  finally {
    creating.value = false
  }
}

async function revokeKey(id: string) {
  revokingId.value = id
  error.value = null
  try {
    await $fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    keys.value = keys.value.filter(key => key.id !== id)
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to revoke API key'
  }
  finally {
    revokingId.value = null
  }
}

function dismissCreatedKey() {
  createdKey.value = null
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-text-secondary">
      Create API keys for programmatic access. Keys are shown once at creation — store them securely.
    </p>

    <div
      v-if="error"
      class="rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
    >
      {{ error }}
    </div>

    <div
      v-if="createdKey"
      class="rounded-md border border-accent/30 bg-accent/5 px-4 py-3"
    >
      <p class="text-sm font-medium text-text-primary">
        API key created
      </p>
      <p class="mt-1 text-xs text-text-muted">
        Copy this key now. You won't be able to see it again.
      </p>
      <code class="mt-3 block break-all rounded-md border border-border-hair bg-bg-raised px-3 py-2 font-mono text-xs text-text-primary">
        {{ createdKey.key }}
      </code>
      <UiBtn
        class="mt-3"
        variant="secondary"
        size="sm"
        @click="dismissCreatedKey"
      >
        I've saved it
      </UiBtn>
    </div>

    <form
      class="flex flex-wrap items-end gap-3"
      @submit.prevent="createKey"
    >
      <UiInput
        v-model="newKeyName"
        label="Key name"
        placeholder="e.g. CI automation"
        class="min-w-[220px] flex-1"
      />
      <UiBtn
        type="submit"
        :loading="creating"
        :disabled="!newKeyName.trim()"
      >
        Create key
      </UiBtn>
    </form>

    <div
      v-if="loading"
      class="flex flex-col gap-2"
    >
      <UiSkeleton
        v-for="i in 2"
        :key="i"
        class="h-14 w-full"
      />
    </div>

    <div
      v-else-if="!keys.length"
      class="rounded-md border border-dashed border-border-hair px-4 py-8 text-center text-sm text-text-muted"
    >
      No active API keys yet.
    </div>

    <ul
      v-else
      class="flex flex-col gap-2"
    >
      <li
        v-for="key in keys"
        :key="key.id"
        class="flex items-center justify-between gap-3 rounded-md border border-border-hair bg-bg-raised px-3 py-2.5"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-text-primary">
            {{ key.name }}
          </p>
          <p class="mt-0.5 text-xs text-text-muted">
            Created {{ formatDate(key.createdAt) }}
            <span class="mx-1">&middot;</span>
            Last used {{ formatDate(key.lastUsedAt) }}
          </p>
        </div>
        <UiBtn
          variant="ghost"
          size="sm"
          :loading="revokingId === key.id"
          @click="revokeKey(key.id)"
        >
          Revoke
        </UiBtn>
      </li>
    </ul>
  </div>
</template>
