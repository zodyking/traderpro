<script setup lang="ts">
import type { ScanProgressEvent } from '#shared/types/scanner'

definePageMeta({ layout: 'app' })

const { user } = useUserSession()
const { connect, subscribe } = useLiveChannel()

type ScanSummary = {
  id: string
  status: string
  matchCount: number
  scannedSymbols: number
  error?: string | null
  queuedAt: string
  finishedAt?: string | null
}

type ScanStatus = {
  id: string
  status: string
  result?: {
    matches: Array<{ alertId: string; symbolId: string; firedAt: string }>
    scannedAlerts: number
    scannedSymbols: number
  }
  error?: string | null
}

const scanning = ref(false)
const progress = ref<ScanProgressEvent | null>(null)
const activeScanId = ref<string | null>(null)
const scanResult = ref<ScanStatus | null>(null)
const history = ref<ScanSummary[]>([])
const error = ref<string | null>(null)

async function loadHistory() {
  try {
    history.value = await $fetch<ScanSummary[]>('/api/scans')
  }
  catch {
    // ignore
  }
}

async function startScan() {
  if (scanning.value) return
  scanning.value = true
  error.value = null
  progress.value = null
  scanResult.value = null

  try {
    const { scanId } = await $fetch<{ scanId: string }>('/api/scans', {
      method: 'POST',
      body: {},
    })
    activeScanId.value = scanId

    if (user.value?.id) {
      connect()
      subscribe(`scanner.${scanId}.results`, (payload) => {
        progress.value = payload as ScanProgressEvent
        const event = progress.value
        if (event.stage === 'done' || event.stage === 'failed') {
          void pollResult(scanId)
        }
      })
    }

    await pollResult(scanId)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Scan failed'
  }
  finally {
    scanning.value = false
    await loadHistory()
  }
}

async function pollResult(scanId: string) {
  const maxAttempts = 60
  for (let i = 0; i < maxAttempts; i++) {
    const status = await $fetch<ScanStatus>(`/api/scans/${scanId}`)
    if (status.status === 'done' || status.status === 'failed') {
      scanResult.value = status
      progress.value = { pct: 100, stage: status.status }
      return
    }
    await new Promise(r => setTimeout(r, 1000))
  }
}

onMounted(() => {
  void loadHistory()
})
</script>

<template>
  <div class="mx-auto max-w-4xl p-4 md:p-6">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-text-primary">
        Alert Scanner
      </h1>
      <p class="mt-1 text-sm text-text-muted">
        Scan your active alerts against watchlist symbols in real time.
      </p>
    </header>

    <div class="mb-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        :disabled="scanning"
        @click="startScan"
      >
        {{ scanning ? 'Scanning…' : 'Run Scan' }}
      </button>

      <NuxtLink
        to="/app/chart"
        class="rounded-md border border-border-strong px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-raised"
      >
        Manage Alerts
      </NuxtLink>
    </div>

    <div v-if="error" class="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {{ error }}
    </div>

    <div v-if="progress && scanning" class="mb-6 rounded-lg border border-border-hair bg-bg-surface p-4">
      <div class="mb-2 flex justify-between text-sm">
        <span class="text-text-secondary">{{ progress.stage }}</span>
        <span class="font-mono text-text-muted">{{ progress.pct }}%</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-bg-raised">
        <div
          class="h-full rounded-full bg-accent transition-all"
          :style="{ width: `${progress.pct}%` }"
        />
      </div>
    </div>

    <div v-if="scanResult?.result" class="mb-6 rounded-lg border border-border-hair bg-bg-surface p-4">
      <h2 class="mb-3 text-sm font-medium text-text-primary">
        Latest Results
      </h2>
      <p class="mb-3 text-sm text-text-muted">
        {{ scanResult.result.matches.length }} match(es) across
        {{ scanResult.result.scannedSymbols }} symbol(s),
        {{ scanResult.result.scannedAlerts }} alert(s) checked
      </p>
      <ul v-if="scanResult.result.matches.length" class="space-y-2">
        <li
          v-for="match in scanResult.result.matches"
          :key="`${match.alertId}-${match.firedAt}`"
          class="rounded border border-border-hair bg-bg-raised px-3 py-2 text-sm"
        >
          <span class="font-mono text-accent">{{ match.symbolId.slice(0, 8) }}…</span>
          <span class="text-text-muted"> fired at {{ new Date(match.firedAt).toLocaleString() }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-text-muted">
        No matches found.
      </p>
    </div>

    <AlertsAlertFeed v-if="user?.id" class="mb-6" />

    <section v-if="history.length">
      <h2 class="mb-3 text-sm font-medium text-text-secondary">
        Scan History
      </h2>
      <div class="overflow-hidden rounded-lg border border-border-hair">
        <table class="w-full text-sm">
          <thead class="bg-bg-raised text-left text-text-muted">
            <tr>
              <th class="px-3 py-2">
                Status
              </th>
              <th class="px-3 py-2">
                Matches
              </th>
              <th class="px-3 py-2">
                Symbols
              </th>
              <th class="px-3 py-2">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in history"
              :key="run.id"
              class="border-t border-border-hair"
            >
              <td class="px-3 py-2 capitalize">
                {{ run.status }}
              </td>
              <td class="px-3 py-2 font-mono">
                {{ run.matchCount }}
              </td>
              <td class="px-3 py-2 font-mono">
                {{ run.scannedSymbols }}
              </td>
              <td class="px-3 py-2 text-text-muted">
                {{ new Date(run.queuedAt).toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
