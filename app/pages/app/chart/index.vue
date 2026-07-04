<script setup lang="ts">
import type { IndicatorOverlay } from '#shared/types/indicators'
import type { CompiledCondition } from '#shared/types/strategy'

definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const workspace = useWorkspaceStore()
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const

const overlays = ref<IndicatorOverlay[]>([
  {
    id: 'ema-20',
    type: 'ema',
    params: { period: 20 },
    color: '#14E0B8',
    visible: true,
  },
])

type AlertRecord = {
  id: string
  symbolId: string | null
  condition: CompiledCondition
  active: boolean
  lastFiredAt: string | null
  createdAt: string
}

const alertsOpen = ref(false)
const showAlertForm = ref(false)
const alerts = ref<AlertRecord[]>([])
const alertsLoading = ref(false)
const scanning = ref(false)
const scanMatches = ref<Array<{ alertId: string; symbolId: string; firedAt: string }>>([])

async function loadAlerts() {
  alertsLoading.value = true
  try {
    const data = await $fetch<{ alerts: AlertRecord[] }>('/api/alerts')
    alerts.value = data.alerts
  }
  catch {
    // ignore
  }
  finally {
    alertsLoading.value = false
  }
}

async function deleteAlert(id: string) {
  await $fetch(`/api/alerts/${id}`, { method: 'DELETE' })
  alerts.value = alerts.value.filter(a => a.id !== id)
}

async function toggleAlert(alert: AlertRecord) {
  const data = await $fetch<{ alert: AlertRecord }>(`/api/alerts/${alert.id}`, {
    method: 'PATCH',
    body: { active: !alert.active },
  })
  const index = alerts.value.findIndex(a => a.id === alert.id)
  if (index !== -1) alerts.value[index] = data.alert
}

async function runScan() {
  scanning.value = true
  scanMatches.value = []
  try {
    const symbolIds = workspace.activeSymbolId ? [workspace.activeSymbolId] : undefined
    const data = await $fetch<{ matches: Array<{ alertId: string; symbolId: string; firedAt: string }> }>(
      '/api/alerts/scan',
      { method: 'POST', body: { symbolIds } },
    )
    scanMatches.value = data.matches
  }
  catch {
    // ignore
  }
  finally {
    scanning.value = false
  }
}

function onAlertCreated(alert: { id: string; condition: CompiledCondition; active: boolean }) {
  alerts.value.unshift({
    ...alert,
    symbolId: workspace.activeSymbolId,
    lastFiredAt: null,
    createdAt: new Date().toISOString(),
  })
  showAlertForm.value = false
}

watch(alertsOpen, (open) => {
  if (open) loadAlerts()
})

onMounted(async () => {
  await workspace.loadWatchlists()
  await workspace.ensureWorkspace()
})

function setIntervalValue(value: typeof intervals[number]) {
  workspace.chartInterval = value
  workspace.saveWorkspace()
}
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--spacing-command-bar))] flex-col lg:flex-row">
    <WorkspaceWatchlistRail />

    <div class="flex min-w-0 flex-1 flex-col gap-4 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-text-primary">
            Chart Workspace
          </h1>
          <p class="mt-1 text-sm text-text-secondary">
            Historical candles with live updates over WebSocket.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex flex-wrap gap-1">
            <button
              v-for="value in intervals"
              :key="value"
              type="button"
              class="rounded-md border px-2.5 py-1 font-mono text-xs transition-colors"
              :class="
                workspace.chartInterval === value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border-hair text-text-muted hover:bg-bg-raised hover:text-text-secondary'
              "
              @click="setIntervalValue(value)"
            >
              {{ value }}
            </button>
          </div>

          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
            :class="
              alertsOpen
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border-hair text-text-muted hover:bg-bg-raised hover:text-text-secondary'
            "
            @click="alertsOpen = !alertsOpen"
          >
            <svg
              class="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Alerts
            <span
              v-if="alerts.length"
              class="rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-2xs text-accent"
            >
              {{ alerts.length }}
            </span>
          </button>
        </div>
      </div>

      <ChartIndicatorControls
        :overlays="overlays"
        @update:overlays="overlays = $event"
      />

      <ClientOnly>
        <ChartChartPanel
          :symbol-id="workspace.activeSymbolId"
          :interval="workspace.chartInterval ?? '1h'"
          :overlays="overlays"
        />
      </ClientOnly>

        <div
          v-if="alertsOpen"
          class="rounded-lg border border-border-strong bg-bg-surface"
        >
          <div class="flex items-center justify-between border-b border-border-hair px-4 py-3">
            <h2 class="text-sm font-semibold text-text-primary">
              Alerts
            </h2>
            <div class="flex items-center gap-2">
              <UiBtn
                variant="ghost"
                size="sm"
                :loading="scanning"
                @click="runScan"
              >
                Scan Now
              </UiBtn>
              <UiBtn
                variant="secondary"
                size="sm"
                @click="showAlertForm = !showAlertForm"
              >
                + New Alert
              </UiBtn>
            </div>
          </div>

          <div
            v-if="scanMatches.length"
            class="border-b border-border-hair bg-bull/5 px-4 py-2"
          >
            <p class="text-xs font-medium text-bull">
              {{ scanMatches.length }} alert{{ scanMatches.length === 1 ? '' : 's' }} fired
            </p>
            <ul class="mt-1 space-y-0.5">
              <li
                v-for="match in scanMatches"
                :key="`${match.alertId}-${match.symbolId}`"
                class="font-mono text-2xs text-text-secondary"
              >
                Alert {{ match.alertId.slice(0, 8) }} fired on {{ match.symbolId.slice(0, 8) }}
              </li>
            </ul>
          </div>

          <div
            v-if="showAlertForm"
            class="p-4"
          >
            <AlertsAlertForm
              :symbol-id="workspace.activeSymbolId ?? undefined"
              @created="onAlertCreated"
              @cancel="showAlertForm = false"
            />
          </div>

          <div
            v-if="alertsLoading"
            class="px-4 py-8 text-center text-sm text-text-muted"
          >
            Loading alerts…
          </div>

          <ul
            v-else-if="alerts.length"
            class="divide-y divide-border-hair"
          >
            <li
              v-for="alert in alerts"
              :key="alert.id"
              class="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-mono text-xs text-text-primary">
                  {{ alert.condition.hash.slice(0, 8) }}…
                </p>
                <p class="mt-0.5 text-2xs text-text-muted">
                  {{ alert.symbolId ? `Symbol: ${alert.symbolId.slice(0, 8)}…` : 'All symbols' }}
                  <span
                    v-if="alert.lastFiredAt"
                    class="ml-2"
                  >Fired: {{ new Date(alert.lastFiredAt).toLocaleDateString() }}</span>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  class="rounded border px-2 py-0.5 text-2xs transition-colors"
                  :class="
                    alert.active
                      ? 'border-bull/30 bg-bull/10 text-bull hover:bg-bull/20'
                      : 'border-border-hair text-text-muted hover:border-border-strong'
                  "
                  @click="toggleAlert(alert)"
                >
                  {{ alert.active ? 'Active' : 'Paused' }}
                </button>
                <button
                  type="button"
                  class="rounded border border-bear/30 px-2 py-0.5 text-2xs text-bear transition-colors hover:bg-bear/10"
                  @click="deleteAlert(alert.id)"
                >
                  Delete
                </button>
              </div>
            </li>
          </ul>

          <div
            v-else-if="!showAlertForm"
            class="px-4 py-8 text-center text-sm text-text-muted"
          >
            No alerts yet. Click <strong>+ New Alert</strong> to create one.
          </div>

          <!-- Fired alert feed -->
          <div class="border-t border-border-hair px-4 py-3">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Fired History
            </h3>
            <AlertsAlertFeed />
          </div>
        </div>
    </div>
  </div>
</template>
