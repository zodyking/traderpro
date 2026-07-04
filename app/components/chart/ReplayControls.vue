<script setup lang="ts">
import type { ReplayEngine } from '~/composables/useReplayEngine'

const props = defineProps<{
  engine: ReplayEngine
}>()

const progressPct = computed(() => {
  if (props.engine.totalBars.value === 0) return 0
  return Math.round(((props.engine.cursorIndex.value + 1) / props.engine.totalBars.value) * 100)
})
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2 rounded-lg border border-border-hair bg-bg-surface px-3 py-2"
    data-testid="replay-controls"
    role="group"
    aria-label="Chart replay controls"
  >
    <span class="text-xs font-medium tracking-wide text-text-muted uppercase">
      Replay
    </span>

    <button
      type="button"
      class="rounded border border-border-hair px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-raised disabled:opacity-40"
      :disabled="engine.atStart.value"
      aria-label="Step back one bar"
      @click="engine.stepBack()"
    >
      ◀
    </button>

    <button
      v-if="!engine.isPlaying.value"
      type="button"
      class="rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
      :disabled="engine.atEnd.value"
      aria-label="Play replay"
      @click="engine.play()"
    >
      Play
    </button>
    <button
      v-else
      type="button"
      class="rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
      aria-label="Pause replay"
      @click="engine.pause()"
    >
      Pause
    </button>

    <button
      type="button"
      class="rounded border border-border-hair px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-raised disabled:opacity-40"
      :disabled="engine.atEnd.value"
      aria-label="Step forward one bar"
      @click="engine.stepForward()"
    >
      ▶
    </button>

    <button
      type="button"
      class="rounded border border-border-hair px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-raised"
      aria-label="Reset replay cursor"
      @click="engine.resetCursor()"
    >
      Reset
    </button>

    <span class="ml-auto font-mono text-2xs text-text-muted">
      Bar {{ engine.cursorIndex.value + 1 }} / {{ engine.totalBars.value }}
      <span class="text-text-muted/70">({{ progressPct }}%)</span>
    </span>
  </div>
</template>
