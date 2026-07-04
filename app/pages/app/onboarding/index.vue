<script setup lang="ts">
import { STRATEGY_TEMPLATES } from '#shared/templates/index'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const TOTAL_STEPS = 6

const step = ref(1)
const loading = ref(false)
const error = ref('')

// Step 1: Asset classes
const ASSET_CLASS_OPTIONS = [
  { id: 'stock', label: 'Stocks', icon: '📈', description: 'Equities & ETFs' },
  { id: 'crypto', label: 'Crypto', icon: '₿', description: 'Bitcoin, Ethereum & more' },
  { id: 'forex', label: 'Forex', icon: '💱', description: 'Currency pairs' },
  { id: 'futures', label: 'Futures', icon: '⚡', description: 'ES, NQ, CL & more' },
  { id: 'options', label: 'Options', icon: '📊', description: 'Calls, puts & spreads' },
]
const selectedAssets = ref<string[]>(['stock'])

function toggleAsset(id: string) {
  const idx = selectedAssets.value.indexOf(id)
  if (idx === -1) {
    selectedAssets.value = [...selectedAssets.value, id]
  }
  else if (selectedAssets.value.length > 1) {
    selectedAssets.value = selectedAssets.value.filter((a) => a !== id)
  }
}

// Step 2: Experience + timeframe
const EXPERIENCE_OPTIONS = [
  { id: 'novice', label: 'New to trading', description: 'Learning the basics and building a foundation.' },
  { id: 'developing', label: 'Some experience', description: 'I have traded before and understand charts.' },
  { id: 'advanced', label: 'Experienced', description: 'I use systematic methods and quantitative rules.' },
]
const TIMEFRAME_OPTIONS = [
  { id: '1m', label: '1m', description: 'Scalping' },
  { id: '5m', label: '5m', description: 'Day trade' },
  { id: '15m', label: '15m', description: 'Intraday' },
  { id: '1h', label: '1h', description: 'Swing' },
  { id: '4h', label: '4h', description: 'Position' },
  { id: '1d', label: '1D', description: 'Long-term' },
]
const selectedExperience = ref<'novice' | 'developing' | 'advanced'>('novice')
const selectedTimeframe = ref('1h')

// Step 3: Workspace creation
const workspaceCreated = ref(false)
const watchlistCreated = ref(false)

// Step 4: Template recommendation
const DEMO_SYMBOLS = ['AAPL', 'MSFT', 'SPY']
const recommendedTemplateId = computed(() => {
  if (selectedExperience.value === 'advanced') return 'momentum-continuation'
  if (selectedExperience.value === 'developing') {
    if (['5m', '15m'].includes(selectedTimeframe.value)) return 'vwap-reclaim'
    return 'breakout-retest'
  }
  return 'trend-pullback'
})

const selectedTemplateId = ref<string>('trend-pullback')

watch(
  recommendedTemplateId,
  (val) => {
    selectedTemplateId.value = val
  },
  { immediate: true },
)

const selectedTemplate = computed(
  () => STRATEGY_TEMPLATES.find((t) => t.id === selectedTemplateId.value),
)

// Step 5: Demo backtest info
const demoSymbol = 'AAPL'

// Computed progress
const progressPct = computed(() => Math.round((step.value / TOTAL_STEPS) * 100))

async function handleStep3() {
  loading.value = true
  error.value = ''
  try {
    const wsData = await $fetch<{ workspace: { id: string } }>('/api/workspaces', {
      method: 'POST',
      body: { name: 'Main Workspace', isDefault: true },
    })
    workspaceCreated.value = !!wsData.workspace

    const wlData = await $fetch<{ watchlist: { id: string } }>('/api/watchlists', {
      method: 'POST',
      body: { name: 'My Watchlist' },
    })

    const symbolsData = await $fetch<{ results: Array<{ id: string, ticker: string }> }>('/api/symbols/search', {
      params: { q: 'AAPL' },
    }).catch(() => ({ results: [] }))

    // Also search for MSFT and SPY
    const msftData = await $fetch<{ results: Array<{ id: string, ticker: string }> }>('/api/symbols/search', {
      params: { q: 'MSFT' },
    }).catch(() => ({ results: [] }))
    const spyData = await $fetch<{ results: Array<{ id: string, ticker: string }> }>('/api/symbols/search', {
      params: { q: 'SPY' },
    }).catch(() => ({ results: [] }))

    const allResults = [
      ...(symbolsData.results ?? []),
      ...(msftData.results ?? []),
      ...(spyData.results ?? []),
    ]
    const symbolIds = allResults
      .filter((s) => DEMO_SYMBOLS.includes(s.ticker))
      .map((s) => s.id)
      .filter((id, i, arr) => arr.indexOf(id) === i)

    if (symbolIds.length && wlData.watchlist?.id) {
      await $fetch(`/api/watchlists/${wlData.watchlist.id}/symbols`, {
        method: 'PUT',
        body: { symbolIds },
      }).catch(() => null)
    }

    watchlistCreated.value = !!wlData.watchlist
    step.value = 4
  }
  catch {
    step.value = 4
  }
  finally {
    loading.value = false
  }
}

async function handleFinish() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/me', {
      method: 'PATCH',
      body: {
        experience: selectedExperience.value,
        uiMode: selectedExperience.value === 'advanced' ? 'pro' : 'novice',
      },
    })

    if (import.meta.client) {
      localStorage.setItem('ae_onboarded', '1')
      localStorage.setItem('ae_asset_preferences', JSON.stringify(selectedAssets.value))
      localStorage.setItem('ae_preferred_timeframe', selectedTimeframe.value)
    }

    await navigateTo('/app/strategy')
  }
  catch {
    error.value = 'Something went wrong. Please try again.'
  }
  finally {
    loading.value = false
  }
}

function skipOnboarding() {
  if (import.meta.client) {
    localStorage.setItem('ae_onboarded', '1')
  }
  navigateTo('/app')
}

function nextStep() {
  if (step.value === 3) {
    handleStep3()
  }
  else if (step.value < TOTAL_STEPS) {
    step.value++
  }
}

function prevStep() {
  if (step.value > 1) step.value--
}
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-start px-4 py-12">
    <div class="w-full max-w-2xl">
      <!-- Header -->
      <div class="mb-8 text-center">
        <p class="mb-2 font-mono text-xs tracking-[0.2em] text-accent uppercase">
          AxiomEdge
        </p>
        <h1 class="text-2xl font-semibold text-text-primary">
          Welcome — let's set you up
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          A quick setup so AxiomEdge works the way you trade.
        </p>
      </div>

      <!-- Progress bar -->
      <div class="mb-8">
        <div class="mb-2 flex items-center justify-between text-xs text-text-muted">
          <span>Step {{ step }} of {{ TOTAL_STEPS }}</span>
          <button
            class="text-text-muted hover:text-text-secondary transition-colors"
            @click="skipOnboarding"
          >
            Skip setup
          </button>
        </div>
        <div class="h-1 w-full overflow-hidden rounded-full bg-bg-raised">
          <div
            class="h-full rounded-full bg-accent transition-all duration-300"
            :style="{ width: `${progressPct}%` }"
          />
        </div>
      </div>

      <!-- Step panels -->
      <UiPanel>
        <!-- Step 1: Asset classes -->
        <div v-if="step === 1" class="flex flex-col gap-5">
          <div>
            <h2 class="text-base font-semibold text-text-primary">
              What do you trade?
            </h2>
            <p class="mt-1 text-sm text-text-secondary">
              Select all asset classes you're interested in. You can change this later.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              v-for="asset in ASSET_CLASS_OPTIONS"
              :key="asset.id"
              class="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors"
              :class="
                selectedAssets.includes(asset.id)
                  ? 'border-accent bg-accent/5 text-text-primary'
                  : 'border-border-hair bg-bg-raised text-text-secondary hover:border-border-strong hover:text-text-primary'
              "
              @click="toggleAsset(asset.id)"
            >
              <span class="text-lg leading-none">{{ asset.icon }}</span>
              <span class="text-sm font-medium">{{ asset.label }}</span>
              <span class="text-xs text-text-muted">{{ asset.description }}</span>
            </button>
          </div>
        </div>

        <!-- Step 2: Experience + Timeframe -->
        <div v-else-if="step === 2" class="flex flex-col gap-5">
          <div>
            <h2 class="text-base font-semibold text-text-primary">
              Your experience level
            </h2>
            <p class="mt-1 text-sm text-text-secondary">
              We'll tailor the interface and templates to match where you are.
            </p>
          </div>
          <div class="flex flex-col gap-2">
            <button
              v-for="exp in EXPERIENCE_OPTIONS"
              :key="exp.id"
              class="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
              :class="
                selectedExperience === exp.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border-hair bg-bg-raised hover:border-border-strong'
              "
              @click="selectedExperience = exp.id as typeof selectedExperience"
            >
              <span
                class="mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors"
                :class="
                  selectedExperience === exp.id
                    ? 'border-accent bg-accent'
                    : 'border-border-strong'
                "
              />
              <div>
                <p class="text-sm font-medium text-text-primary">
                  {{ exp.label }}
                </p>
                <p class="mt-0.5 text-xs text-text-muted">
                  {{ exp.description }}
                </p>
              </div>
            </button>
          </div>

          <div>
            <p class="mb-2 text-sm font-medium text-text-secondary">
              Preferred timeframe
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tf in TIMEFRAME_OPTIONS"
                :key="tf.id"
                class="flex flex-col items-center rounded-md border px-3 py-2 text-center transition-colors"
                :class="
                  selectedTimeframe === tf.id
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border-hair bg-bg-raised text-text-secondary hover:border-border-strong hover:text-text-primary'
                "
                @click="selectedTimeframe = tf.id"
              >
                <span class="text-sm font-semibold">{{ tf.label }}</span>
                <span class="text-2xs text-text-muted">{{ tf.description }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Step 3: Workspace + Watchlist -->
        <div v-else-if="step === 3" class="flex flex-col gap-5">
          <div>
            <h2 class="text-base font-semibold text-text-primary">
              Creating your workspace
            </h2>
            <p class="mt-1 text-sm text-text-secondary">
              We'll create a default workspace and seed it with popular symbols to get you started.
            </p>
          </div>

          <div class="flex flex-col gap-3 rounded-lg border border-border-hair bg-bg-raised p-4">
            <div class="flex items-center gap-3">
              <span class="flex size-8 items-center justify-center rounded-full bg-accent/10 text-accent text-sm">
                W
              </span>
              <div>
                <p class="text-sm font-medium text-text-primary">
                  Main Workspace
                </p>
                <p class="text-xs text-text-muted">
                  Default chart layout with your preferred settings
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex size-8 items-center justify-center rounded-full bg-accent/10 text-accent text-sm">
                ★
              </span>
              <div>
                <p class="text-sm font-medium text-text-primary">
                  My Watchlist
                </p>
                <p class="text-xs text-text-muted">
                  Pre-loaded with AAPL, MSFT, SPY
                </p>
              </div>
            </div>
          </div>

          <p class="text-xs text-text-muted">
            You can rename, reorder, or add more symbols at any time from the app.
          </p>
        </div>

        <!-- Step 4: Strategy template recommendation -->
        <div v-else-if="step === 4" class="flex flex-col gap-5">
          <div>
            <h2 class="text-base font-semibold text-text-primary">
              Start with a proven template
            </h2>
            <p class="mt-1 text-sm text-text-secondary">
              Based on your experience and timeframe, here's a recommended starting point.
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <button
              v-for="tpl in STRATEGY_TEMPLATES"
              :key="tpl.id"
              class="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
              :class="
                selectedTemplateId === tpl.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border-hair bg-bg-raised hover:border-border-strong'
              "
              @click="selectedTemplateId = tpl.id"
            >
              <span
                class="mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors"
                :class="
                  selectedTemplateId === tpl.id
                    ? 'border-accent bg-accent'
                    : 'border-border-strong'
                "
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium text-text-primary">
                    {{ tpl.name }}
                  </p>
                  <span
                    v-if="tpl.id === recommendedTemplateId"
                    class="rounded bg-accent/10 px-1.5 py-0.5 text-2xs font-medium text-accent"
                  >
                    Recommended
                  </span>
                  <span
                    class="rounded px-1.5 py-0.5 text-2xs font-medium capitalize"
                    :class="{
                      'bg-bull/10 text-bull': tpl.difficulty === 'beginner',
                      'bg-accent/10 text-accent': tpl.difficulty === 'intermediate',
                      'bg-warn/10 text-warn': tpl.difficulty === 'advanced',
                    }"
                  >
                    {{ tpl.difficulty }}
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-text-muted">
                  {{ tpl.description }}
                </p>
              </div>
            </button>
          </div>
        </div>

        <!-- Step 5: Sample backtest -->
        <div v-else-if="step === 5" class="flex flex-col gap-5">
          <div>
            <h2 class="text-base font-semibold text-text-primary">
              Run a sample backtest
            </h2>
            <p class="mt-1 text-sm text-text-secondary">
              Once you're in the app, you can validate your strategy against historical data before risking capital.
            </p>
          </div>

          <div class="rounded-lg border border-border-hair bg-bg-raised p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-text-primary">
                  {{ selectedTemplate?.name ?? 'Selected template' }} on {{ demoSymbol }}
                </p>
                <p class="mt-0.5 text-xs text-text-muted">
                  Historical simulation on 1-year daily data
                </p>
              </div>
              <UiBadge label="Demo" variant="info" />
            </div>
            <p class="text-xs text-text-muted leading-relaxed">
              After finishing setup, head to <strong class="text-text-secondary">Strategy Lab → Save version → Run backtest</strong>.
              Backtests run in the background worker and typically complete in under a minute.
            </p>
            <NuxtLink
              to="/app/strategy"
              class="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Go to Strategy Lab after setup →
            </NuxtLink>
          </div>

          <div class="rounded-lg border border-border-hair bg-bg-raised p-4">
            <p class="text-xs font-medium text-text-secondary mb-1">
              How backtests work
            </p>
            <ul class="space-y-1.5 text-xs text-text-muted">
              <li>• Build your rules in Strategy Lab</li>
              <li>• Save a version, then click Run backtest</li>
              <li>• Review equity curve, win rate, and drawdown</li>
              <li>• Iterate rules until metrics align with your edge</li>
            </ul>
          </div>
        </div>

        <!-- Step 6: Broker connection deferred -->
        <div v-else-if="step === 6" class="flex flex-col gap-5">
          <div>
            <h2 class="text-base font-semibold text-text-primary">
              Connect a broker — optional
            </h2>
            <p class="mt-1 text-sm text-text-secondary">
              You can connect a broker account to sync live trades and positions. Skip this for now and do it later in Settings.
            </p>
          </div>

          <div class="rounded-lg border border-border-hair bg-bg-raised p-4 flex items-start gap-3">
            <span class="mt-0.5 text-xl">🔗</span>
            <div>
              <p class="text-sm font-medium text-text-primary">
                Broker connections
              </p>
              <p class="mt-0.5 text-xs text-text-muted leading-relaxed">
                AxiomEdge supports Alpaca, Interactive Brokers, and more. Connect at any time from
                <strong class="text-text-secondary">Settings → Broker</strong>.
              </p>
            </div>
          </div>

          <div
            v-if="error"
            class="rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
          >
            {{ error }}
          </div>
        </div>
      </UiPanel>

      <!-- Navigation -->
      <div class="mt-6 flex items-center justify-between">
        <UiBtn
          v-if="step > 1"
          variant="ghost"
          @click="prevStep"
        >
          Back
        </UiBtn>
        <div v-else />

        <div class="flex items-center gap-3">
          <UiBtn
            v-if="step < TOTAL_STEPS"
            variant="primary"
            :loading="loading"
            :disabled="step === 1 && selectedAssets.length === 0"
            @click="nextStep"
          >
            Continue
          </UiBtn>
          <UiBtn
            v-else
            variant="primary"
            :loading="loading"
            @click="handleFinish"
          >
            Enter AxiomEdge
          </UiBtn>
        </div>
      </div>
    </div>
  </div>
</template>
