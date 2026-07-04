<script setup lang="ts">
import type { CalendarPnlData } from '~/stores/broker'

defineProps<{
  data: CalendarPnlData | null
  loading?: boolean
}>()

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

function buildCalendarGrid(year: number, month: number, days: Array<{ date: string, pnl: number, trades: number }>) {
  const dayMap = new Map(days.map(d => [d.date, d]))
  const total = daysInMonth(year, month)
  const startDow = firstDayOfWeek(year, month)
  const cells: Array<{ day: number | null, date: string | null, pnl: number | null, trades: number }> = []

  for (let i = 0; i < startDow; i++) {
    cells.push({ day: null, date: null, pnl: null, trades: 0 })
  }

  for (let d = 1; d <= total; d++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const entry = dayMap.get(dateKey)
    cells.push({ day: d, date: dateKey, pnl: entry?.pnl ?? null, trades: entry?.trades ?? 0 })
  }

  // Pad to complete last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, date: null, pnl: null, trades: 0 })
  }

  return cells
}

function pnlColor(pnl: number | null, trades: number): string {
  if (pnl === null || trades === 0) return 'bg-bg-raised text-text-muted'
  if (pnl > 500) return 'bg-bull/40 text-bull'
  if (pnl > 200) return 'bg-bull/28 text-bull'
  if (pnl > 50) return 'bg-bull/18 text-bull'
  if (pnl > 0) return 'bg-bull/10 text-bull'
  if (pnl < -500) return 'bg-bear/40 text-bear'
  if (pnl < -200) return 'bg-bear/28 text-bear'
  if (pnl < -50) return 'bg-bear/18 text-bear'
  if (pnl < 0) return 'bg-bear/10 text-bear'
  return 'bg-bg-raised text-text-muted'
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

const activeTooltip = ref<string | null>(null)

function toggleTooltip(date: string | null) {
  activeTooltip.value = activeTooltip.value === date ? null : date
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <template v-if="loading">
      <div
        v-for="i in 3"
        :key="i"
        class="flex flex-col gap-3"
      >
        <UiSkeleton class="h-5 w-32" />
        <UiSkeleton class="h-[160px] w-full" />
      </div>
    </template>

    <template v-else-if="!data?.months.length">
      <p class="py-12 text-center text-sm text-text-muted">
        No trade data to display. Import broker data to see your calendar P&amp;L.
      </p>
    </template>

    <template v-else>
      <div
        v-for="m in data.months"
        :key="`${m.year}-${m.month}`"
        class="rounded-lg border border-border-hair bg-bg-surface p-4"
      >
        <!-- Month header -->
        <div class="mb-3 flex items-baseline justify-between">
          <h3 class="text-sm font-semibold text-text-primary">
            {{ MONTH_NAMES[m.month] }} {{ m.year }}
          </h3>
          <span
            class="font-mono text-sm font-semibold tabular-nums"
            :class="m.totalPnl >= 0 ? 'text-bull' : 'text-bear'"
          >
            {{ m.totalPnl >= 0 ? '+' : '' }}${{ Math.abs(m.totalPnl).toFixed(2) }}
          </span>
        </div>

        <!-- Day-of-week header -->
        <div class="mb-1 grid grid-cols-7 gap-1">
          <div
            v-for="label in DAY_LABELS"
            :key="label"
            class="text-center text-[10px] font-medium text-text-muted uppercase"
          >
            {{ label }}
          </div>
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="(cell, idx) in buildCalendarGrid(m.year, m.month, m.days)"
            :key="idx"
            class="relative aspect-square"
          >
            <template v-if="cell.day !== null">
              <button
                type="button"
                class="relative h-full w-full rounded transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                :class="pnlColor(cell.pnl, cell.trades)"
                :title="cell.trades > 0 ? `${cell.date}: ${fmt(cell.pnl!)} (${cell.trades} trade${cell.trades !== 1 ? 's' : ''})` : String(cell.day)"
                @click="toggleTooltip(cell.date)"
              >
                <span class="absolute top-0.5 left-1 text-[9px] font-mono leading-none opacity-60">
                  {{ cell.day }}
                </span>
                <span
                  v-if="cell.trades > 0"
                  class="flex h-full items-center justify-center text-[10px] font-semibold tabular-nums"
                >
                  {{ fmt(cell.pnl!) }}
                </span>

                <!-- Tooltip -->
                <div
                  v-if="activeTooltip === cell.date && cell.trades > 0"
                  class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 min-w-[120px] -translate-x-1/2 rounded-md border border-border-strong bg-bg-overlay px-2.5 py-2 text-left text-xs shadow-lg"
                  role="tooltip"
                >
                  <p class="font-medium text-text-primary">
                    {{ cell.date }}
                  </p>
                  <p class="mt-0.5 font-mono" :class="cell.pnl! >= 0 ? 'text-bull' : 'text-bear'">
                    P&amp;L: {{ fmt(cell.pnl!) }}
                  </p>
                  <p class="mt-0.5 text-text-muted">
                    {{ cell.trades }} trade{{ cell.trades !== 1 ? 's' : '' }}
                  </p>
                </div>
              </button>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
