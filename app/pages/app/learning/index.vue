<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

type Stage = {
  number: number
  title: string
  description: string
  lessons: Lesson[]
  status: 'locked' | 'available' | 'in_progress' | 'complete'
}

type Lesson = {
  id: string
  title: string
  source: string
  duration: string
  complete: boolean
}

const stages: Stage[] = [
  {
    number: 1,
    title: 'Foundation',
    description: 'Market structure, order types, and how price is formed.',
    status: 'in_progress',
    lessons: [
      { id: 'f1', title: 'How exchanges work', source: 'Core', duration: '8 min', complete: true },
      { id: 'f2', title: 'Bid/ask spread and liquidity', source: 'Core', duration: '6 min', complete: true },
      { id: 'f3', title: 'Market vs. limit orders', source: 'Core', duration: '5 min', complete: false },
      { id: 'f4', title: 'Reading a candlestick chart', source: 'Core', duration: '10 min', complete: false },
    ],
  },
  {
    number: 2,
    title: 'Technical Analysis',
    description: 'Indicators, patterns, and reading price action.',
    status: 'available',
    lessons: [
      { id: 't1', title: 'Moving averages (SMA vs EMA)', source: 'Core', duration: '9 min', complete: false },
      { id: 't2', title: 'RSI and momentum', source: 'Core', duration: '8 min', complete: false },
      { id: 't3', title: 'Support and resistance', source: 'Core', duration: '12 min', complete: false },
      { id: 't4', title: 'Volume confirmation', source: 'Mistake cluster', duration: '7 min', complete: false },
    ],
  },
  {
    number: 3,
    title: 'Risk Management',
    description: 'Position sizing, stop-loss discipline, and drawdown control.',
    status: 'locked',
    lessons: [
      { id: 'r1', title: 'Risk-reward ratio fundamentals', source: 'Core', duration: '10 min', complete: false },
      { id: 'r2', title: 'Sizing by fixed risk %', source: 'Core', duration: '8 min', complete: false },
      { id: 'r3', title: 'Why traders skip stops', source: 'Mistake cluster', duration: '6 min', complete: false },
      { id: 'r4', title: 'Max daily loss rules', source: 'Core', duration: '7 min', complete: false },
    ],
  },
  {
    number: 4,
    title: 'Strategy Building',
    description: 'Constructing rule-based systems and avoiding curve-fitting.',
    status: 'locked',
    lessons: [
      { id: 's1', title: 'Entry signal design', source: 'Core', duration: '11 min', complete: false },
      { id: 's2', title: 'Exit rules and take-profit logic', source: 'Core', duration: '9 min', complete: false },
      { id: 's3', title: 'Over-optimising for past data', source: 'Mistake cluster', duration: '8 min', complete: false },
      { id: 's4', title: 'Walk-forward testing basics', source: 'Core', duration: '12 min', complete: false },
    ],
  },
  {
    number: 5,
    title: 'Backtesting & Validation',
    description: 'Running backtests, interpreting metrics, and stress-testing strategies.',
    status: 'locked',
    lessons: [
      { id: 'b1', title: 'Reading Sharpe and Sortino', source: 'Core', duration: '9 min', complete: false },
      { id: 'b2', title: 'Max drawdown and recovery', source: 'Core', duration: '8 min', complete: false },
      { id: 'b3', title: '"Exploratory" results (< 30 trades)', source: 'Mistake cluster', duration: '6 min', complete: false },
      { id: 'b4', title: 'Data quality warnings', source: 'Core', duration: '7 min', complete: false },
    ],
  },
  {
    number: 6,
    title: 'Live Trading',
    description: 'Bridging from backtests to live capital with guardrails.',
    status: 'locked',
    lessons: [
      { id: 'l1', title: 'Paper trading before going live', source: 'Core', duration: '8 min', complete: false },
      { id: 'l2', title: 'Slippage and execution realism', source: 'Core', duration: '7 min', complete: false },
      { id: 'l3', title: 'Emotional discipline under drawdown', source: 'Mistake cluster', duration: '10 min', complete: false },
      { id: 'l4', title: 'Scaling position size gradually', source: 'Core', duration: '9 min', complete: false },
    ],
  },
]

function completedCount(stage: Stage) {
  return stage.lessons.filter((l) => l.complete).length
}

function progressPct(stage: Stage) {
  return Math.round((completedCount(stage) / stage.lessons.length) * 100)
}

const stageStatusClass: Record<Stage['status'], string> = {
  locked: 'border-border-hair bg-bg-surface text-text-muted',
  available: 'border-accent/40 bg-accent/5 text-text-primary',
  in_progress: 'border-accent bg-accent/10 text-text-primary',
  complete: 'border-bull/40 bg-bull/10 text-text-primary',
}

const stageNumberClass: Record<Stage['status'], string> = {
  locked: 'bg-bg-raised text-text-muted',
  available: 'bg-accent/20 text-accent',
  in_progress: 'bg-accent text-white',
  complete: 'bg-bull text-white',
}

const expandedStage = ref<number | null>(1)

function toggle(num: number) {
  expandedStage.value = expandedStage.value === num ? null : num
}
</script>

<template>
  <div class="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl">
    <header>
      <h1 class="text-lg font-semibold text-text-primary">
        Learning Path
      </h1>
      <p class="mt-1 text-sm text-text-secondary">
        Six-stage skill ladder from market foundations to live execution.
      </p>
    </header>

    <div class="flex flex-col gap-3">
      <div
        v-for="stage in stages"
        :key="stage.number"
        class="rounded-xl border transition-colors"
        :class="stageStatusClass[stage.status]"
      >
        <button
          type="button"
          class="flex w-full items-center gap-4 px-4 py-4 text-left"
          :disabled="stage.status === 'locked'"
          @click="toggle(stage.number)"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            :class="stageNumberClass[stage.status]"
          >
            <svg
              v-if="stage.status === 'locked'"
              class="size-4"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11 7V5a3 3 0 10-6 0v2H4v7h8V7h-1zm-4-2a1 1 0 112 0v2H7V5z" />
            </svg>
            <span v-else>{{ stage.number }}</span>
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ stage.title }}</span>
              <span
                v-if="stage.status === 'in_progress'"
                class="rounded-full bg-accent/20 px-2 py-0.5 text-2xs font-medium text-accent"
              >
                In Progress
              </span>
              <span
                v-else-if="stage.status === 'complete'"
                class="rounded-full bg-bull/20 px-2 py-0.5 text-2xs font-medium text-bull"
              >
                Complete
              </span>
            </div>
            <p class="mt-0.5 text-xs text-text-muted">
              {{ stage.description }}
            </p>
            <div
              v-if="stage.status !== 'locked'"
              class="mt-2 flex items-center gap-2"
            >
              <div class="h-1 flex-1 overflow-hidden rounded-full bg-bg-raised">
                <div
                  class="h-full rounded-full bg-accent transition-all"
                  :style="{ width: `${progressPct(stage)}%` }"
                />
              </div>
              <span class="text-2xs text-text-muted whitespace-nowrap">
                {{ completedCount(stage) }}/{{ stage.lessons.length }}
              </span>
            </div>
          </div>

          <svg
            v-if="stage.status !== 'locked'"
            class="size-4 shrink-0 text-text-muted transition-transform"
            :class="expandedStage === stage.number ? 'rotate-180' : ''"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div
          v-if="expandedStage === stage.number && stage.status !== 'locked'"
          class="border-t border-border-hair px-4 pb-4"
        >
          <ul class="mt-3 flex flex-col gap-2">
            <li
              v-for="lesson in stage.lessons"
              :key="lesson.id"
              class="flex items-center gap-3 rounded-lg border border-border-hair bg-bg-base px-3 py-2.5"
            >
              <span
                class="flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs"
                :class="lesson.complete
                  ? 'border-bull bg-bull/10 text-bull'
                  : 'border-border-strong bg-transparent text-text-muted'"
              >
                <svg
                  v-if="lesson.complete"
                  class="size-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M2 6l3 3 5-5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm"
                  :class="lesson.complete ? 'text-text-muted line-through' : 'text-text-primary'"
                >
                  {{ lesson.title }}
                </span>
                <span class="text-2xs text-text-muted">{{ lesson.source }} · {{ lesson.duration }}</span>
              </span>
              <span
                v-if="lesson.source === 'Mistake cluster'"
                class="shrink-0 rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-2xs text-warn"
              >
                Mistake
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
