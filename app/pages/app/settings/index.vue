<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const store = useBrokerStore()
const { theme, setTheme } = useTheme()
const { user, clear: clearSession } = useUserSession()

const activeTab = ref<'broker' | 'account' | 'api-keys'>('broker')

const displayName = ref('')
const displayNameSaving = ref(false)
const displayNameError = ref<string | null>(null)
const displayNameSuccess = ref(false)
const signingOut = ref(false)

onMounted(async () => {
  displayName.value = user.value?.displayName ?? ''
  await Promise.all([
    store.fetchConnections(),
    store.fetchPerformance(),
    store.fetchExecutions(),
  ])
})

watch(user, (next) => {
  if (next?.displayName && !displayNameSaving.value) {
    displayName.value = next.displayName
  }
})

function handleImported() {
  store.fetchConnections()
  store.fetchPerformance(store.selectedAccountId ?? undefined)
  store.fetchExecutions(store.selectedAccountId ? { accountId: store.selectedAccountId } : {})
}

async function saveDisplayName() {
  const trimmed = displayName.value.trim()
  if (!trimmed) {
    displayNameError.value = 'Display name is required.'
    return
  }

  displayNameSaving.value = true
  displayNameError.value = null
  displayNameSuccess.value = false

  try {
    await $fetch('/api/me', {
      method: 'PATCH',
      body: { displayName: trimmed },
    })
    displayNameSuccess.value = true
    setTimeout(() => {
      displayNameSuccess.value = false
    }, 2500)
  }
  catch (err: unknown) {
    displayNameError.value = err instanceof Error ? err.message : 'Failed to update display name'
  }
  finally {
    displayNameSaving.value = false
  }
}

async function signOut() {
  signingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clearSession()
    await navigateTo('/login')
  }
  finally {
    signingOut.value = false
  }
}
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--spacing-command-bar))] flex-col">
    <header class="shrink-0 border-b border-border-hair px-4 py-3">
      <h1 class="text-lg font-semibold text-text-primary">
        Settings
      </h1>
      <p class="mt-0.5 text-sm text-text-secondary">
        Manage broker connections, imports, and account preferences.
      </p>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar tabs -->
      <nav
        class="w-44 shrink-0 border-r border-border-hair bg-bg-surface p-3"
        aria-label="Settings sections"
      >
        <ul class="flex flex-col gap-0.5">
          <li>
            <button
              type="button"
              class="w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              :class="activeTab === 'broker'
                ? 'bg-bg-raised text-accent'
                : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'"
              @click="activeTab = 'broker'"
            >
              Broker Data
            </button>
          </li>
          <li>
            <button
              type="button"
              class="w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              :class="activeTab === 'api-keys'
                ? 'bg-bg-raised text-accent'
                : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'"
              @click="activeTab = 'api-keys'"
            >
              API Keys
            </button>
          </li>
          <li>
            <button
              type="button"
              class="w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              :class="activeTab === 'account'
                ? 'bg-bg-raised text-accent'
                : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'"
              @click="activeTab = 'account'"
            >
              Account
            </button>
          </li>
        </ul>
      </nav>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Broker tab -->
        <div
          v-if="activeTab === 'broker'"
          class="mx-auto max-w-5xl flex flex-col gap-6"
        >
          <div class="grid gap-6 lg:grid-cols-[360px_1fr]">
            <!-- Import form -->
            <BrokerImportForm @imported="handleImported" />

            <!-- Connections list -->
            <UiPanel title="Connections">
              <template v-if="store.connectionsLoading">
                <div class="flex flex-col gap-2">
                  <UiSkeleton
                    v-for="i in 3"
                    :key="i"
                    class="h-12 w-full"
                  />
                </div>
              </template>
              <template v-else-if="!store.connections.length">
                <p class="py-8 text-center text-sm text-text-muted">
                  No broker connections yet. Import a CSV to get started.
                </p>
              </template>
              <template v-else>
                <ul class="flex flex-col gap-2">
                  <li
                    v-for="conn in store.connections"
                    :key="conn.id"
                    class="flex items-center justify-between rounded-md border border-border-hair bg-bg-raised px-3 py-2.5"
                  >
                    <div>
                      <p class="text-sm font-medium text-text-primary">
                        {{ conn.label }}
                      </p>
                      <p class="mt-0.5 text-xs text-text-muted">
                        {{ conn.broker }} &middot; {{ conn.accountCount }} account{{ conn.accountCount !== 1 ? 's' : '' }}
                        <template v-if="conn.lastSyncAt">
                          &middot; synced {{ new Date(conn.lastSyncAt).toLocaleDateString() }}
                        </template>
                      </p>
                    </div>
                    <UiBadge
                      :label="conn.status"
                      :variant="conn.status === 'connected' ? 'bull' : 'warn'"
                    />
                  </li>
                </ul>
              </template>
            </UiPanel>
          </div>

          <!-- Performance dashboard -->
          <div>
            <h2 class="mb-4 text-sm font-semibold tracking-wide text-text-primary uppercase">
              Performance
            </h2>
            <BrokerPerformanceDashboard
              :summary="store.performance"
              :loading="store.performanceLoading"
              :executions="store.executions"
              :executions-loading="store.executionsLoading"
            />
          </div>
        </div>

        <!-- API Keys tab -->
        <div
          v-else-if="activeTab === 'api-keys'"
          class="mx-auto max-w-xl"
        >
          <UiPanel title="API Keys">
            <SettingsApiKeysPanel />
          </UiPanel>
        </div>

        <!-- Account tab -->
        <div
          v-else-if="activeTab === 'account'"
          class="mx-auto max-w-xl flex flex-col gap-4"
        >
          <UiPanel title="Appearance">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-text-primary">
                  Theme
                </p>
                <p class="mt-0.5 text-xs text-text-muted">
                  Switch between dark and light mode.
                </p>
              </div>
              <div class="flex rounded-md border border-border-hair bg-bg-raised p-0.5">
                <button
                  type="button"
                  class="rounded px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="theme === 'dark'
                    ? 'bg-bg-overlay text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'"
                  @click="setTheme('dark')"
                >
                  Dark
                </button>
                <button
                  type="button"
                  class="rounded px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="theme === 'light'
                    ? 'bg-bg-overlay text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'"
                  @click="setTheme('light')"
                >
                  Light
                </button>
              </div>
            </div>
          </UiPanel>

          <UiPanel title="Profile">
            <div class="flex flex-col gap-4">
              <div>
                <label
                  for="display-name"
                  class="text-sm font-medium text-text-primary"
                >
                  Display name
                </label>
                <p class="mt-0.5 text-xs text-text-muted">
                  Shown across the app and in your session.
                </p>
                <div class="mt-2 flex gap-2">
                  <UiInput
                    id="display-name"
                    v-model="displayName"
                    placeholder="Your name"
                    class="flex-1"
                    @keydown.enter="saveDisplayName"
                  />
                  <UiBtn
                    :loading="displayNameSaving"
                    @click="saveDisplayName"
                  >
                    Save
                  </UiBtn>
                </div>
                <p
                  v-if="displayNameError"
                  class="mt-2 text-xs text-bear"
                >
                  {{ displayNameError }}
                </p>
                <p
                  v-else-if="displayNameSuccess"
                  class="mt-2 text-xs text-bull"
                >
                  Display name updated.
                </p>
              </div>

              <div class="border-t border-border-hair pt-4">
                <p class="text-sm font-medium text-text-primary">
                  Email
                </p>
                <p class="mt-1 text-sm text-text-secondary">
                  {{ user?.email }}
                </p>
              </div>
            </div>
          </UiPanel>

          <UiPanel title="Email notifications">
            <SettingsEmailNotificationsPanel />
          </UiPanel>

          <UiPanel title="Security">
            <SettingsMfaPanel />
          </UiPanel>

          <UiPanel title="Session">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-text-primary">
                  Sign out
                </p>
                <p class="mt-0.5 text-xs text-text-muted">
                  End your session on this device.
                </p>
              </div>
              <UiBtn
                variant="secondary"
                :loading="signingOut"
                @click="signOut"
              >
                Sign out
              </UiBtn>
            </div>
          </UiPanel>

          <div class="mt-4">
            <UiPanel title="Plan & Usage">
              <BillingUsageMeter />
            </UiPanel>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
