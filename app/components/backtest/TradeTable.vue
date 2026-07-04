<script setup lang="ts">
import type { BacktestTrade } from '~/stores/backtest'

const props = defineProps<{
  trades: BacktestTrade[]
}>()

function formatTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPnl(value?: number | null) {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

function formatR(value?: number | null) {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}R`
}

function pnlClass(value?: number | null) {
  if (value == null) return 'text-text-muted'
  if (value > 0) return 'text-bull'
  if (value < 0) return 'text-bear'
  return 'text-text-secondary'
}

function sideClass(side: BacktestTrade['side']) {
  return side === 'long' ? 'text-bull' : 'text-bear'
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border-hair">
    <div class="max-h-[420px] overflow-auto">
      <table class="w-full min-w-[640px] border-collapse text-sm">
        <thead class="sticky top-0 z-10 bg-bg-raised">
          <tr class="border-b border-border-hair text-left text-2xs font-medium tracking-wide text-text-muted uppercase">
            <th class="px-3 py-2.5 font-medium">
              Entry
            </th>
            <th class="px-3 py-2.5 font-medium">
              Exit
            </th>
            <th class="px-3 py-2.5 font-medium">
              Side
            </th>
            <th class="px-3 py-2.5 text-right font-medium">
              PnL
            </th>
            <th class="px-3 py-2.5 text-right font-medium">
              R
            </th>
            <th class="px-3 py-2.5 font-medium">
              Exit reason
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="!props.trades.length"
            class="border-b border-border-hair"
          >
            <td
              colspan="6"
              class="px-3 py-8 text-center text-text-muted"
            >
              No trades recorded.
            </td>
          </tr>
          <tr
            v-for="trade in props.trades"
            :key="trade.id"
            class="border-b border-border-hair transition-colors hover:bg-bg-raised/60"
          >
            <td class="px-3 py-2 font-mono text-xs tabular-nums text-text-secondary">
              {{ formatTime(trade.entryTime) }}
            </td>
            <td class="px-3 py-2 font-mono text-xs tabular-nums text-text-secondary">
              {{ formatTime(trade.exitTime) }}
            </td>
            <td
              class="px-3 py-2 font-mono text-xs font-medium uppercase tabular-nums"
              :class="sideClass(trade.side)"
            >
              {{ trade.side }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums"
              :class="pnlClass(trade.pnl)"
            >
              {{ formatPnl(trade.pnl) }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-xs tabular-nums"
              :class="pnlClass(trade.rMultiple)"
            >
              {{ formatR(trade.rMultiple) }}
            </td>
            <td class="px-3 py-2 text-xs text-text-secondary">
              {{ trade.exitReason ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
