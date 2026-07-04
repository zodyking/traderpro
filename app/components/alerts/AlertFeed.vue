<script setup lang="ts">
type FiredAlert = {
  id: string
  symbolId: string | null
  conditionSummary: string
  firedAt: string
  createdAt: string
}

type WsAlertPayload = {
  alertId: string
  symbolId: string
  firedAt: string
}

const { user } = useUserSession()
const liveChannel = useLiveChannel()

const alerts = ref<FiredAlert[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await $fetch<{ alerts: FiredAlert[] }>('/api/alerts/fired')
    alerts.value = data.alerts
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load alerts'
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()

  if (user.value?.id) {
    liveChannel.subscribe(`alerts.user.${user.value.id}`, (payload) => {
      const p = payload as WsAlertPayload
      const existing = alerts.value.findIndex(a => a.id === p.alertId)
      if (existing !== -1) {
        alerts.value[existing] = {
          ...alerts.value[existing]!,
          firedAt: p.firedAt,
        }
        const updated = alerts.value.splice(existing, 1)[0]!
        alerts.value.unshift(updated)
      }
      else {
        alerts.value.unshift({
          id: p.alertId,
          symbolId: p.symbolId ?? null,
          conditionSummary: 'Alert fired',
          firedAt: p.firedAt,
          createdAt: p.firedAt,
        })
      }
    })
  }
})

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch {
    return iso
  }
}
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="flex flex-col gap-2 py-4"
    >
      <UiSkeleton
        v-for="i in 3"
        :key="i"
        class="h-10 w-full"
      />
    </div>

    <p
      v-else-if="error"
      class="py-4 text-sm text-bear"
    >
      {{ error }}
    </p>

    <p
      v-else-if="!alerts.length"
      class="py-4 text-center text-sm text-text-muted"
    >
      No alerts have fired yet.
    </p>

    <ul
      v-else
      class="flex flex-col divide-y divide-border-hair"
    >
      <li
        v-for="alert in alerts"
        :key="alert.id"
        class="flex items-start justify-between gap-3 py-2.5"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-text-primary">
            {{ alert.conditionSummary }}
          </p>
          <p class="mt-0.5 text-2xs text-text-muted">
            <span v-if="alert.symbolId">{{ alert.symbolId.slice(0, 8) }}… &middot; </span>
            {{ formatTime(alert.firedAt) }}
          </p>
        </div>
        <span class="shrink-0 rounded-full bg-bull/15 px-2 py-0.5 text-2xs font-medium text-bull">
          Fired
        </span>
      </li>
    </ul>
  </div>
</template>
