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

type UpgradePlanId = 'starter' | 'pro'

const route = useRoute()
const router = useRouter()

const data = ref<UsageData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const upgrading = ref<UpgradePlanId | null>(null)
const checkoutNotice = ref<string | null>(null)

const upgradePlans: { id: UpgradePlanId; label: string }[] = [
  { id: 'starter', label: 'Starter' },
  { id: 'pro', label: 'Pro' },
]

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

function handleCheckoutQuery() {
  const checkout = route.query.checkout
  if (checkout === 'success') {
    checkoutNotice.value = 'Payment received. Your plan will update once checkout is confirmed.'
    void load()
    void router.replace({ query: { ...route.query, checkout: undefined, session_id: undefined } })
  }
  else if (checkout === 'cancelled') {
    checkoutNotice.value = 'Checkout was cancelled.'
    void router.replace({ query: { ...route.query, checkout: undefined } })
  }
}

onMounted(async () => {
  handleCheckoutQuery()
  await load()
})

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

async function upgrade(planId: UpgradePlanId) {
  upgrading.value = planId
  error.value = null
  checkoutNotice.value = null
  try {
    const session = await $fetch<{ url: string }>('/api/billing/checkout', {
      method: 'POST',
      body: { planId },
    })
    if (session.url) {
      window.location.href = session.url
    }
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to start checkout'
  }
  finally {
    upgrading.value = null
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
      <p
        v-if="checkoutNotice"
        class="mb-3 text-sm text-accent"
      >
        {{ checkoutNotice }}
      </p>

      <div class="mb-4 flex items-center justify-between gap-3">
        <p class="text-sm text-text-secondary">
          Plan: <span class="font-medium text-text-primary">{{ data.plan.label }}</span>
        </p>
        <div
          v-if="data.plan.id === 'free'"
          class="flex items-center gap-2"
        >
          <UiBtn
            v-for="plan in upgradePlans"
            :key="plan.id"
            variant="secondary"
            size="sm"
            :loading="upgrading === plan.id"
            :disabled="upgrading !== null && upgrading !== plan.id"
            @click="upgrade(plan.id)"
          >
            Upgrade to {{ plan.label }}
          </UiBtn>
        </div>
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
