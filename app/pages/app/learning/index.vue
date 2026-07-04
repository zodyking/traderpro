<script setup lang="ts">
import { LESSON_CATALOG, type LessonCatalogEntry } from '#shared/lessons'

definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

type Lesson = LessonCatalogEntry

type Stage = {
  number: number
  title: string
  description: string
  lessons: Lesson[]
}

const STAGES: Stage[] = [
  {
    number: 1,
    title: 'Foundation',
    description: 'Market structure, order types, and how price is formed.',
    lessons: LESSON_CATALOG.filter(lesson => lesson.stage === 'Foundation'),
  },
  {
    number: 2,
    title: 'Technical Analysis',
    description: 'Indicators, patterns, and reading price action.',
    lessons: LESSON_CATALOG.filter(lesson => lesson.stage === 'Technical Analysis'),
  },
  {
    number: 3,
    title: 'Risk Management',
    description: 'Position sizing, stop-loss discipline, and drawdown control.',
    lessons: LESSON_CATALOG.filter(lesson => lesson.stage === 'Risk Management'),
  },
  {
    number: 4,
    title: 'Strategy Building',
    description: 'Constructing rule-based systems and avoiding curve-fitting.',
    lessons: LESSON_CATALOG.filter(lesson => lesson.stage === 'Strategy Building'),
  },
  {
    number: 5,
    title: 'Backtesting & Validation',
    description: 'Running backtests, interpreting metrics, and stress-testing strategies.',
    lessons: LESSON_CATALOG.filter(lesson => lesson.stage === 'Backtesting & Validation'),
  },
  {
    number: 6,
    title: 'Live Trading',
    description: 'Bridging from backtests to live capital with guardrails.',
    lessons: LESSON_CATALOG.filter(lesson => lesson.stage === 'Live Trading'),
  },
]

type StageStatus = 'locked' | 'available' | 'in_progress' | 'complete'

const completedLessons = ref<Set<string>>(new Set())
const loading = ref(true)
const saving = ref<string | null>(null)
const coachLoading = ref<string | null>(null)
const coachError = ref<string | null>(null)
const coachReviewId = ref<string | null>(null)
const expandedStage = ref<number | null>(1)

const aiStore = useAIStore()

onMounted(async () => {
  try {
    const data = await $fetch<{ completedLessons: string[] }>('/api/learning/progress')
    completedLessons.value = new Set(data.completedLessons)
  }
  catch {
    completedLessons.value = new Set()
  }
  finally {
    loading.value = false
  }
})

function isLessonComplete(lessonId: string): boolean {
  return completedLessons.value.has(lessonId)
}

function completedCount(stage: Stage): number {
  return stage.lessons.filter(l => isLessonComplete(l.id)).length
}

function progressPct(stage: Stage): number {
  return Math.round((completedCount(stage) / stage.lessons.length) * 100)
}

function stageStatus(stage: Stage): StageStatus {
  const prev = STAGES.find(s => s.number === stage.number - 1)
  if (prev && stageStatus(prev) !== 'complete') {
    return 'locked'
  }

  const done = completedCount(stage)
  if (done === stage.lessons.length) return 'complete'
  if (done > 0) return 'in_progress'
  if (stage.number === 1) return 'in_progress'
  return 'available'
}

const stages = computed(() =>
  STAGES.map(stage => ({
    ...stage,
    status: stageStatus(stage),
    lessons: stage.lessons.map(lesson => ({
      ...lesson,
      complete: isLessonComplete(lesson.id),
    })),
  })),
)

async function toggleLesson(lessonId: string, complete: boolean) {
  saving.value = lessonId
  const next = new Set(completedLessons.value)
  if (complete) {
    next.add(lessonId)
  }
  else {
    next.delete(lessonId)
  }
  completedLessons.value = next

  try {
    const data = await $fetch<{ completedLessons: string[] }>('/api/learning/progress', {
      method: 'PATCH',
      body: { lessonId, complete },
    })
    completedLessons.value = new Set(data.completedLessons)
  }
  catch {
    const rollback = new Set(completedLessons.value)
    if (complete) {
      rollback.delete(lessonId)
    }
    else {
      rollback.add(lessonId)
    }
    completedLessons.value = rollback
  }
  finally {
    saving.value = null
  }
}

const stageStatusClass: Record<StageStatus, string> = {
  locked: 'border-border-hair bg-bg-surface text-text-muted',
  available: 'border-accent/40 bg-accent/5 text-text-primary',
  in_progress: 'border-accent bg-accent/10 text-text-primary',
  complete: 'border-bull/40 bg-bull/10 text-text-primary',
}

const stageNumberClass: Record<StageStatus, string> = {
  locked: 'bg-bg-raised text-text-muted',
  available: 'bg-accent/20 text-accent',
  in_progress: 'bg-accent text-white',
  complete: 'bg-bull text-white',
}

function toggle(num: number) {
  expandedStage.value = expandedStage.value === num ? null : num
}

async function askCoach(lessonId: string) {
  coachLoading.value = lessonId
  coachError.value = null
  coachReviewId.value = lessonId

  try {
    await aiStore.requestReview('lesson', lessonId, 'lesson')
  }
  catch (err: unknown) {
    coachError.value = err instanceof Error ? err.message : 'Coach request failed'
  }
  finally {
    coachLoading.value = null
  }
}

const activeCoachReview = computed(() =>
  coachReviewId.value ? aiStore.reviewFor(coachReviewId.value) : null,
)
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

    <div
      v-if="loading"
      class="flex flex-col gap-3"
    >
      <UiSkeleton
        v-for="i in 4"
        :key="i"
        class="h-24 w-full"
      />
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
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
              <button
                type="button"
                class="flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs transition-colors"
                :class="lesson.complete
                  ? 'border-bull bg-bull/10 text-bull'
                  : 'border-border-strong bg-transparent text-text-muted hover:border-accent hover:text-accent'"
                :disabled="saving === lesson.id"
                :aria-label="lesson.complete ? 'Mark incomplete' : 'Mark complete'"
                @click="toggleLesson(lesson.id, !lesson.complete)"
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
              </button>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm"
                  :class="lesson.complete ? 'text-text-muted line-through' : 'text-text-primary'"
                >
                  {{ lesson.title }}
                </span>
                <span class="text-2xs text-text-muted">{{ lesson.source }} · {{ lesson.duration }}</span>
              </span>
              <UiBtn
                variant="secondary"
                size="sm"
                :loading="coachLoading === lesson.id"
                @click="askCoach(lesson.id)"
              >
                Ask Coach
              </UiBtn>
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

    <UiPanel
      v-if="coachReviewId && (activeCoachReview || coachError)"
      title="Coach Feedback"
    >
      <p
        v-if="coachError"
        class="rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
      >
        {{ coachError }}
      </p>
      <AiAIReviewWidget
        v-else-if="activeCoachReview"
        target-type="lesson"
        review-type="lesson"
        :target-id="coachReviewId"
        label="Learning Coach"
      />
    </UiPanel>
  </div>
</template>
