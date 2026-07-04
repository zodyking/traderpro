<script setup lang="ts">
type MetricStatus = 'bull' | 'bear' | 'neutral' | 'warn'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    delta?: string
    deltaDirection?: 'up' | 'down' | 'flat'
    status?: MetricStatus
    explanation?: string
    loading?: boolean
  }>(),
  {
    delta: undefined,
    deltaDirection: 'flat',
    status: 'neutral',
    explanation: undefined,
    loading: false,
  },
)

const statusColors: Record<MetricStatus, string> = {
  bull: 'text-bull',
  bear: 'text-bear',
  neutral: 'text-text-primary',
  warn: 'text-warn',
}

const deltaColors: Record<string, string> = {
  up: 'text-bull',
  down: 'text-bear',
  flat: 'text-text-muted',
}
</script>

<template>
  <div class="rounded-lg border border-border-hair bg-bg-surface p-4">
    <div class="mb-2 flex items-center gap-1.5">
      <span class="text-xs font-medium tracking-wide text-text-muted uppercase">
        {{ props.label }}
      </span>
      <button
        v-if="props.explanation"
        type="button"
        class="group relative text-text-muted hover:text-text-secondary"
        :aria-label="`About ${props.label}`"
      >
        <svg class="size-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.875.875 0 110 1.75A.875.875 0 018 4zm1.25 8.25H6.75V7.5h2.5v4.75z"
          />
        </svg>
        <span
          class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-md border border-border-strong bg-bg-overlay px-2.5 py-2 text-left text-xs leading-relaxed font-normal text-text-secondary normal-case opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          role="tooltip"
        >
          {{ props.explanation }}
        </span>
      </button>
    </div>

    <template v-if="props.loading">
      <UiSkeleton class="mb-2 h-7 w-24" />
      <UiSkeleton class="h-4 w-16" />
    </template>
    <template v-else>
      <div
        class="font-mono text-2xl font-semibold tabular-nums"
        :class="statusColors[props.status]"
      >
        {{ props.value }}
      </div>
      <div
        v-if="props.delta"
        class="mt-1 font-mono text-xs tabular-nums"
        :class="deltaColors[props.deltaDirection]"
      >
        {{ props.delta }}
      </div>
    </template>
  </div>
</template>
