<script setup lang="ts">
import type { JournalEntry } from '~/stores/journal'

const props = defineProps<{
  entry: JournalEntry
}>()

const emit = defineEmits<{
  edit: [entry: JournalEntry]
  delete: [entry: JournalEntry]
  review: [entry: JournalEntry]
  chat: [entry: JournalEntry]
}>()

const journalStore = useJournalStore()

const sideClass = computed(() => {
  if (props.entry.side === 'long') return 'text-bull bg-bull/10 border-bull/30'
  if (props.entry.side === 'short') return 'text-bear bg-bear/10 border-bear/30'
  return 'text-text-secondary bg-bg-raised border-border-strong'
})

const pnl = computed(() => {
  const { entry: entryPrice, exit, size } = props.entry.actual
  if (entryPrice == null || exit == null || size == null) return null
  const raw = (exit - entryPrice) * size * (props.entry.side === 'short' ? -1 : 1)
  return raw
})

const pnlClass = computed(() => {
  if (pnl.value == null) return 'text-text-muted'
  return pnl.value >= 0 ? 'text-bull' : 'text-bear'
})

function formatPnl(v: number) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const reviewLoading = computed(() => journalStore.reviewLoading[props.entry.id] ?? false)
</script>

<template>
  <article class="rounded-lg border border-border-hair bg-bg-surface shadow-panel transition-shadow hover:shadow-md">
    <!-- Header row -->
    <div class="flex items-start justify-between gap-3 border-b border-border-hair px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="entry.side"
          class="inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs font-semibold uppercase"
          :class="sideClass"
        >
          {{ entry.side }}
        </span>

        <span
          v-if="entry.setupTag"
          class="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
        >
          {{ entry.setupTag }}
        </span>

        <span
          v-if="entry.symbolTicker"
          class="font-mono text-sm font-medium text-text-primary"
        >
          {{ entry.symbolTicker }}
        </span>

        <span
          v-if="formatDate(entry.openedAt)"
          class="text-xs text-text-muted"
        >
          {{ formatDate(entry.openedAt) }}
        </span>
      </div>

      <!-- PnL badge -->
      <div
        v-if="pnl !== null"
        class="shrink-0 font-mono text-sm font-semibold tabular-nums"
        :class="pnlClass"
      >
        {{ formatPnl(pnl) }}
      </div>
    </div>

    <!-- Body -->
    <div class="px-4 py-3">
      <!-- Planned vs actual quick stats -->
      <div
        v-if="entry.planned?.thesis || entry.note"
        class="mb-3"
      >
        <p
          v-if="entry.planned?.thesis"
          class="text-xs text-text-secondary line-clamp-2"
        >
          <span class="font-medium text-text-muted">Thesis:</span> {{ entry.planned.thesis }}
        </p>
        <p
          v-if="entry.note"
          class="mt-1 text-xs text-text-secondary line-clamp-2"
        >
          {{ entry.note }}
        </p>
      </div>

      <!-- Planned numbers -->
      <div
        v-if="entry.planned?.entry || entry.planned?.stop || entry.planned?.target"
        class="mb-3 flex flex-wrap gap-3 text-xs"
      >
        <span
          v-if="entry.planned.entry != null"
          class="text-text-muted"
        >Entry <span class="font-mono text-text-primary">{{ entry.planned.entry }}</span></span>
        <span
          v-if="entry.planned.stop != null"
          class="text-text-muted"
        >Stop <span class="font-mono text-bear">{{ entry.planned.stop }}</span></span>
        <span
          v-if="entry.planned.target != null"
          class="text-text-muted"
        >Target <span class="font-mono text-bull">{{ entry.planned.target }}</span></span>
      </div>

      <!-- Linked broker executions -->
      <div
        v-if="entry.linkedExecutions?.length"
        class="mb-3"
      >
        <p class="mb-2 text-2xs font-semibold tracking-wide text-text-muted uppercase">
          Linked executions
        </p>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="execution in entry.linkedExecutions"
            :key="execution.id"
            class="flex flex-wrap items-center gap-2 rounded-md border border-border-hair bg-bg-raised px-2.5 py-1.5 text-xs"
          >
            <span class="font-mono font-medium text-text-primary">{{ execution.rawSymbol }}</span>
            <span
              class="rounded px-1 py-0.5 font-mono text-2xs uppercase"
              :class="execution.side === 'buy' ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'"
            >
              {{ execution.side }}
            </span>
            <span class="font-mono text-text-secondary">
              {{ execution.qty }} @ {{ execution.price }}
            </span>
            <span class="text-text-muted">
              {{ new Date(execution.executedAt).toLocaleDateString() }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Emotion + mistakes -->
      <div
        v-if="entry.emotion || entry.mistakes.length"
        class="flex flex-wrap items-center gap-2"
      >
        <span
          v-if="entry.emotion"
          class="rounded border border-border-hair bg-bg-raised px-1.5 py-0.5 text-xs text-text-secondary"
        >
          {{ entry.emotion }}
        </span>
        <span
          v-for="mistake in entry.mistakes.slice(0, 3)"
          :key="mistake"
          class="rounded border border-bear/20 bg-bear/5 px-1.5 py-0.5 text-xs text-bear/80"
        >
          {{ mistake }}
        </span>
        <span
          v-if="entry.mistakes.length > 3"
          class="text-xs text-text-muted"
        >+{{ entry.mistakes.length - 3 }} more</span>
      </div>

      <!-- Screenshots thumbnails -->
      <div
        v-if="entry.screenshots.length"
        class="mt-3 flex flex-wrap gap-2"
      >
        <img
          v-for="(url, i) in entry.screenshots.slice(0, 4)"
          :key="i"
          :src="url"
          alt="screenshot"
          class="h-14 w-20 rounded-md border border-border-hair object-cover"
        >
        <div
          v-if="entry.screenshots.length > 4"
          class="flex h-14 w-20 items-center justify-center rounded-md border border-border-hair bg-bg-raised text-xs text-text-muted"
        >
          +{{ entry.screenshots.length - 4 }}
        </div>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="flex items-center justify-between border-t border-border-hair px-4 py-2">
      <span class="text-xs text-text-muted">
        {{ formatDate(entry.createdAt) }}
      </span>

      <div class="flex items-center gap-1">
        <UiBtn
          variant="ghost"
          size="sm"
          @click="emit('chat', entry)"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2 4.5h12v7H5.5L2 14.5V4.5z" />
          </svg>
          Chat
        </UiBtn>

        <UiBtn
          variant="ghost"
          size="sm"
          :loading="reviewLoading"
          @click="emit('review', entry)"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 3v3.5m0 2h.01" />
          </svg>
          AI Review
        </UiBtn>

        <UiBtn
          variant="ghost"
          size="sm"
          @click="emit('edit', entry)"
        >
          Edit
        </UiBtn>

        <UiBtn
          variant="ghost"
          size="sm"
          @click="emit('delete', entry)"
        >
          <svg class="size-3.5 text-bear" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 1a.5.5 0 000 1h5a.5.5 0 000-1h-5zM2 4.5A.5.5 0 012.5 4h11a.5.5 0 010 1h-.5l-.777 7.777A1.5 1.5 0 0110.73 14H5.27a1.5 1.5 0 01-1.493-1.223L3 5h-.5A.5.5 0 012 4.5z" />
          </svg>
        </UiBtn>
      </div>
    </div>
  </article>
</template>
