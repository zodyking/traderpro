<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { BacktestTrade } from '~/stores/backtest'

const props = defineProps<{
  trades: BacktestTrade[]
}>()

const scrollRef = ref<HTMLElement | null>(null)
const useVirtual = computed(() => props.trades.length > 50)
const ROW_HEIGHT = 41

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.trades.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })),
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())

const paddingTop = computed(() => {
  if (!useVirtual.value || virtualRows.value.length === 0) return 0
  return virtualRows.value[0]!.start
})

const paddingBottom = computed(() => {
  if (!useVirtual.value || virtualRows.value.length === 0) return 0
  const last = virtualRows.value[virtualRows.value.length - 1]!
  return virtualizer.value.getTotalSize() - (last.start + last.size)
})

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
    <div
      ref="scrollRef"
      class="max-h-[420px] overflow-auto"
    >
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

          <template v-else-if="useVirtual">
            <tr
              v-if="paddingTop"
              aria-hidden="true"
            >
              <td
                colspan="6"
                :style="{ height: `${paddingTop}px`, padding: 0, border: 'none' }"
              />
            </tr>
            <tr
              v-for="virtualRow in virtualRows"
              :key="props.trades[virtualRow.index]!.id"
              class="border-b border-border-hair transition-colors hover:bg-bg-raised/60"
            >
              <td class="px-3 py-2 font-mono text-xs tabular-nums text-text-secondary">
                {{ formatTime(props.trades[virtualRow.index]!.entryTime) }}
              </td>
              <td class="px-3 py-2 font-mono text-xs tabular-nums text-text-secondary">
                {{ formatTime(props.trades[virtualRow.index]!.exitTime) }}
              </td>
              <td
                class="px-3 py-2 font-mono text-xs font-medium uppercase tabular-nums"
                :class="sideClass(props.trades[virtualRow.index]!.side)"
              >
                {{ props.trades[virtualRow.index]!.side }}
              </td>
              <td
                class="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums"
                :class="pnlClass(props.trades[virtualRow.index]!.pnl)"
              >
                {{ formatPnl(props.trades[virtualRow.index]!.pnl) }}
              </td>
              <td
                class="px-3 py-2 text-right font-mono text-xs tabular-nums"
                :class="pnlClass(props.trades[virtualRow.index]!.rMultiple)"
              >
                {{ formatR(props.trades[virtualRow.index]!.rMultiple) }}
              </td>
              <td class="px-3 py-2 text-xs text-text-secondary">
                {{ props.trades[virtualRow.index]!.exitReason ?? '—' }}
              </td>
            </tr>
            <tr
              v-if="paddingBottom"
              aria-hidden="true"
            >
              <td
                colspan="6"
                :style="{ height: `${paddingBottom}px`, padding: 0, border: 'none' }"
              />
            </tr>
          </template>

          <tr
            v-for="trade in props.trades"
            v-else
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
