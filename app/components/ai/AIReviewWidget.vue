<script setup lang="ts">
import type { AIReviewResult } from '#shared/types/ai'

const props = defineProps<{
  targetType: 'strategy' | 'trade' | 'risk' | 'lesson' | 'market'
  targetId: string
  reviewType?: 'strategy' | 'trade' | 'risk' | 'lesson' | 'market'
  label?: string
}>()

const aiStore = useAIStore()

const status = computed(() => aiStore.statusFor(props.targetId))
const error = computed(() => aiStore.errorFor(props.targetId))
const review = computed(() => aiStore.reviewFor(props.targetId))
const result = computed<AIReviewResult | null>(() => review.value?.result ?? null)

const isLoading = computed(() => status.value === 'loading')
const hasDone = computed(() => status.value === 'done' && result.value != null)
const hasFailed = computed(() => status.value === 'failed')

async function handleRequest() {
  await aiStore.requestReview(props.targetType, props.targetId, props.reviewType)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-medium text-text-primary">
          {{ label ?? 'AI Review' }}
        </h3>
        <p class="text-xs text-text-muted">
          Scientific critique powered by AI
        </p>
      </div>
      <UiBtn
        variant="secondary"
        size="sm"
        :loading="isLoading"
        :disabled="isLoading"
        @click="handleRequest"
      >
        <svg
          class="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          />
        </svg>
        {{ hasDone ? 'Refresh' : 'Run AI Review' }}
      </UiBtn>
    </div>

    <div
      v-if="isLoading"
      class="flex flex-col gap-2"
    >
      <UiSkeleton class="h-4 w-3/4" />
      <UiSkeleton class="h-4 w-1/2" />
      <UiSkeleton class="h-4 w-2/3" />
    </div>

    <div
      v-else-if="hasFailed"
      class="rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
    >
      {{ error ?? 'AI review failed. Please try again.' }}
    </div>

    <div
      v-else-if="hasDone && result"
      class="flex flex-col gap-3"
    >
      <div
        v-if="result.observations && result.observations.length > 0"
        class="rounded-md border border-border-hair bg-bg-raised p-3"
      >
        <p class="mb-2 text-2xs font-semibold tracking-wide text-text-muted uppercase">
          Observations
        </p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="(obs, i) in result.observations"
            :key="i"
            class="flex gap-2 text-sm text-text-secondary"
          >
            <span class="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
            {{ obs }}
          </li>
        </ul>
      </div>

      <div
        v-if="result.strengths && result.strengths.length > 0"
        class="rounded-md border border-bull/20 bg-bull/5 p-3"
      >
        <p class="mb-2 text-2xs font-semibold tracking-wide text-bull uppercase">
          Strengths
        </p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="(str, i) in result.strengths"
            :key="i"
            class="flex gap-2 text-sm text-text-secondary"
          >
            <span class="mt-1 size-1.5 shrink-0 rounded-full bg-bull" />
            {{ str }}
          </li>
        </ul>
      </div>

      <div
        v-if="result.risks && result.risks.length > 0"
        class="rounded-md border border-bear/20 bg-bear/5 p-3"
      >
        <p class="mb-2 text-2xs font-semibold tracking-wide text-bear uppercase">
          Risks
        </p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="(risk, i) in result.risks"
            :key="i"
            class="flex gap-2 text-sm text-text-secondary"
          >
            <span class="mt-1 size-1.5 shrink-0 rounded-full bg-bear" />
            {{ risk }}
          </li>
        </ul>
      </div>

      <div
        v-if="result.actions && result.actions.length > 0"
        class="rounded-md border border-accent/20 bg-accent/5 p-3"
      >
        <p class="mb-2 text-2xs font-semibold tracking-wide text-accent uppercase">
          Actions
        </p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="(action, i) in result.actions"
            :key="i"
            class="flex gap-2 text-sm text-text-secondary"
          >
            <span class="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
            {{ action }}
          </li>
        </ul>
      </div>

      <p
        v-if="review?.model"
        class="text-2xs text-text-muted"
      >
        Model: {{ review.model }}
        <template v-if="review.costUsd && Number(review.costUsd) > 0">
          · ${{ Number(review.costUsd).toFixed(4) }}
        </template>
      </p>
    </div>
  </div>
</template>
