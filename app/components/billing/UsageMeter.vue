<script setup lang="ts">
type UsageMetric = {
  used: number
  limit: number
}

type UsageData = {
  plan: { id: string; label: string }
  usage: {
    backtestsPerMonth: UsageMetric
    aiCredits: UsageMetric
    scannerSymbols: UsageMetric
  }
}

const data = ref<UsageData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const upgrading = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await $fetch<UsageData>('/api/me/usage')
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load usage'
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const metrics = computed(() => {
  if (!data.value) return []
  return [
    {
      key: 'backtestsPerMonth',
      label: 'Backtests / month',
      ...data.value.usage.backtestsPerMonth,
    },
    {
      key: 'aiCredits',
      label: 'AI credits',
      ...data.value.usage.aiCredits,
    },
    {
      key: 'scannerSymbols',
      label: 'Scanner symbols',
      ...data.value.usage.scannerSymbols,
    },
  ]
})

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function barColor(used: number, limit: number): string {
  const p = pct(used, limit)
  if (p >= 90) return 'bg-bear'
  if (p >= 70) return 'bg-warn'
  return 'bg-accent'
}

async function upgrade() {
  upgrading.value = true
  error.value = null
  try {
    const session = await $fetch<{ url: string }>('/api/billing/checkout', {
      method: 'POST',
      body: { planId: 'starter' },
    })
    if (session.url) {
      window.location.href = session.url
    }
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to start checkout'
  }
  finally {
    upgrading.value = false
  }
}
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="flex flex-col gap-3"
    >
      <UiSkeleton
        v-for="i in 3"
        :key="i"
        class="h-10 w-full"
      />
    </div>

    <p
      v-else-if="error"
      class="text-sm text-bear"
    >
      {{ error }}
    </p>

    <template v-else-if="data">
      <div class="mb-4 flex items-center justify-between gap-3">
        <p class="text-sm text-text-secondary">
          Plan: <span class="font-medium text-text-primary">{{ data.plan.label }}</span>
        </p>
        <UiBtn
          v-if="data.plan.id === 'free'"
          variant="secondary"
          size="sm"
          :loading="upgrading"
          @click="upgrade"
        >
          Upgrade
        </UiBtn>
      </div>

      <ul class="flex flex-col gap-4">
        <li
          v-for="m in metrics"
          :key="m.key"
        >
          <div class="mb-1 flex items-center justify-between text-xs">
            <span class="text-text-secondary">{{ m.label }}</span>
            <span class="font-mono text-text-primary">{{ m.used }} / {{ m.limit }}</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
            <div
              class="h-full rounded-full transition-all"
              :class="barColor(m.used, m.limit)"
              :style="{ width: `${pct(m.used, m.limit)}%` }"
            />
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
