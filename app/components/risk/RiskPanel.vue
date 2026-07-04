<script setup lang="ts">
import type { PositionRiskSummary } from '#shared/schemas/broker'

const broker = useBrokerStore()

const risk = computed<PositionRiskSummary | null>(() => broker.performance?.positionRisk ?? null)

onMounted(() => {
  void broker.fetchPerformance(broker.selectedAccountId ?? undefined)
})

function fmtUsd(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(value: number) {
  return `${value.toFixed(1)}%`
}
</script>

<template>
  <aside
    class="flex w-full shrink-0 flex-col border-t border-border-hair bg-bg-surface lg:w-72 lg:border-t-0 lg:border-l"
    aria-label="Position risk"
    data-testid="risk-panel"
  >
    <div class="border-b border-border-hair px-4 py-3">
      <h2 class="text-xs font-semibold tracking-wide text-text-muted uppercase">
        Position Risk
      </h2>
      <p class="mt-1 text-2xs text-text-muted">
        Open exposure from broker imports
      </p>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div
        v-if="broker.performanceLoading"
        class="py-8 text-center text-sm text-text-muted"
      >
        Loading risk…
      </div>

      <div
        v-else-if="broker.performanceError"
        class="rounded-md border border-bear/30 bg-bear/5 px-3 py-2 text-xs text-bear"
      >
        {{ broker.performanceError }}
      </div>

      <template v-else-if="risk">
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-md border border-border-hair bg-bg-raised px-3 py-2">
            <p class="text-2xs text-text-muted">
              Open positions
            </p>
            <p class="mt-0.5 font-mono text-sm font-medium text-text-primary">
              {{ risk.openPositions }}
            </p>
          </div>
          <div class="rounded-md border border-border-hair bg-bg-raised px-3 py-2">
            <p class="text-2xs text-text-muted">
              Total exposure
            </p>
            <p class="mt-0.5 font-mono text-sm font-medium text-text-primary">
              {{ fmtUsd(risk.totalExposure) }}
            </p>
          </div>
        </div>

        <div
          v-if="risk.largestConcentration != null"
          class="mt-3 rounded-md border border-border-hair bg-bg-raised px-3 py-2"
        >
          <p class="text-2xs text-text-muted">
            Largest concentration
          </p>
          <p
            class="mt-0.5 font-mono text-sm font-medium"
            :class="risk.largestConcentration > 40 ? 'text-warn' : 'text-text-primary'"
          >
            {{ fmtPct(risk.largestConcentration) }}
          </p>
        </div>

        <ul
          v-if="risk.positions.length"
          class="mt-4 space-y-2"
        >
          <li
            v-for="position in risk.positions"
            :key="position.symbol"
            class="rounded-md border border-border-hair px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-sm font-medium text-text-primary">
                {{ position.symbol }}
              </span>
              <span class="font-mono text-xs text-text-muted">
                {{ position.qty }} sh
              </span>
            </div>
            <div class="mt-1 flex items-center justify-between gap-2 text-2xs text-text-muted">
              <span>{{ fmtUsd(position.notional) }}</span>
              <span>{{ fmtPct(position.pctOfExposure) }} of book</span>
            </div>
          </li>
        </ul>

        <p
          v-else
          class="mt-4 text-center text-sm text-text-muted"
        >
          No open positions from imported executions.
        </p>
      </template>
    </div>
  </aside>
</template>
