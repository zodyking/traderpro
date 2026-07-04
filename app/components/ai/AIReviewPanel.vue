<script setup lang="ts">
import type { AIReview, JournalCoachingMode } from '~/stores/journal'

const props = defineProps<{
  entryId: string
  reviews: AIReview[]
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  requestReview: [mode: JournalCoachingMode]
}>()

const coachingMode = ref<JournalCoachingMode>('trade')

const coachingModes: { value: JournalCoachingMode; label: string; description: string }[] = [
  { value: 'trade', label: 'Trade Review', description: 'Systematic critique of setup and execution' },
  { value: 'risk', label: 'Risk Referee', description: 'Capital preservation and position sizing' },
  { value: 'assistant', label: 'Journal Assistant', description: 'Conversational coaching from your notes' },
]

const activeMode = computed(() => coachingModes.find(m => m.value === coachingMode.value)!)

const statusLabel: Record<string, string> = {
  queued: 'Queued',
  running: 'Running…',
  done: 'Done',
  failed: 'Failed',
}

const statusClass: Record<string, string> = {
  queued: 'text-text-muted',
  running: 'text-warn',
  done: 'text-bull',
  failed: 'text-bear',
}

const reviewTypeLabel: Record<string, string> = {
  trade: 'Trade Review',
  risk: 'Risk Referee',
  assistant: 'Journal Assistant',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function reviewLabel(review: AIReview) {
  return reviewTypeLabel[review.reviewType ?? 'trade'] ?? 'AI Review'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Panel header -->
    <div class="border-b border-border-hair px-4 py-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-text-primary">
          AI Coaching
        </h3>
        <div class="flex items-center gap-2">
          <UiBtn
            size="sm"
            :loading="props.loading"
            @click="emit('requestReview', coachingMode)"
          >
            <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 8A5 5 0 113 8a5 5 0 0110 0zM8 5v3.5m0 2h.01" />
            </svg>
            Request review
          </UiBtn>
          <button
            type="button"
            class="rounded p-1 text-text-muted hover:bg-bg-raised hover:text-text-primary"
            @click="emit('close')"
          >
            <svg class="size-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.53 4.47L9.06 8l2.47 2.53-1.06 1.06L8 9.06l-2.53 2.53-1.06-1.06L6.94 8 4.41 5.47l1.06-1.06L8 6.94l2.53-2.53 1 1.06z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Coaching mode selector -->
      <div class="mt-3">
        <p class="mb-1.5 text-2xs font-medium tracking-wide text-text-muted uppercase">
          Coaching mode
        </p>
        <div
          class="flex rounded-md border border-border-hair bg-bg-raised p-0.5"
          role="radiogroup"
          aria-label="Coaching mode"
        >
          <button
            v-for="mode in coachingModes"
            :key="mode.value"
            type="button"
            role="radio"
            :aria-checked="coachingMode === mode.value"
            class="flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors"
            :class="coachingMode === mode.value
              ? 'bg-bg-overlay text-text-primary'
              : 'text-text-muted hover:text-text-secondary'"
            @click="coachingMode = mode.value"
          >
            {{ mode.label }}
          </button>
        </div>
        <p class="mt-1.5 text-xs text-text-muted">
          {{ activeMode.description }}
        </p>
      </div>
    </div>

    <!-- Review list -->
    <div class="flex-1 overflow-y-auto p-4">
      <div
        v-if="!reviews.length && !props.loading"
        class="flex flex-col items-center justify-center gap-3 py-12 text-center"
      >
        <svg class="size-10 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p class="text-sm text-text-secondary">
          No reviews yet. Choose a coaching mode and request feedback on this trade.
        </p>
      </div>

      <div
        v-else-if="props.loading && !reviews.length"
        class="flex flex-col gap-3"
      >
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
      </div>

      <div
        v-else
        class="flex flex-col gap-4"
      >
        <div
          v-for="review in reviews"
          :key="review.id"
          class="rounded-lg border border-border-hair bg-bg-raised p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="rounded bg-accent/10 px-1.5 py-0.5 text-2xs font-medium text-accent">
                {{ reviewLabel(review) }}
              </span>
              <span
                class="text-xs font-medium"
                :class="statusClass[review.status] ?? 'text-text-muted'"
              >
                {{ statusLabel[review.status] ?? review.status }}
              </span>
            </div>
            <span class="text-xs text-text-muted">{{ formatDate(review.createdAt) }}</span>
          </div>

          <template v-if="review.result">
            <div
              v-if="review.result.observations?.length"
              class="mb-3"
            >
              <p class="mb-1.5 text-xs font-medium tracking-wide text-text-muted uppercase">
                Observations
              </p>
              <ul class="flex flex-col gap-1">
                <li
                  v-for="obs in review.result.observations"
                  :key="obs"
                  class="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {{ obs }}
                </li>
              </ul>
            </div>

            <div
              v-if="review.result.strengths?.length"
              class="mb-3"
            >
              <p class="mb-1.5 text-xs font-medium tracking-wide text-bull uppercase">
                Strengths
              </p>
              <ul class="flex flex-col gap-1">
                <li
                  v-for="s in review.result.strengths"
                  :key="s"
                  class="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-bull" />
                  {{ s }}
                </li>
              </ul>
            </div>

            <div
              v-if="review.result.risks?.length"
              class="mb-3"
            >
              <p class="mb-1.5 text-xs font-medium tracking-wide text-bear uppercase">
                Risks
              </p>
              <ul class="flex flex-col gap-1">
                <li
                  v-for="r in review.result.risks"
                  :key="r"
                  class="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-bear" />
                  {{ r }}
                </li>
              </ul>
            </div>

            <div v-if="review.result.actions?.length">
              <p class="mb-1.5 text-xs font-medium tracking-wide text-text-muted uppercase">
                Action items
              </p>
              <ul class="flex flex-col gap-1">
                <li
                  v-for="a in review.result.actions"
                  :key="a"
                  class="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-text-muted" />
                  {{ a }}
                </li>
              </ul>
            </div>
          </template>

          <p
            v-else-if="review.status === 'queued' || review.status === 'running'"
            class="text-sm text-text-muted"
          >
            Review is being processed…
          </p>

          <p
            v-else-if="review.status === 'failed'"
            class="text-sm text-bear"
          >
            Review failed. Please try again.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
