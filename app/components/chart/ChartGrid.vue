<script setup lang="ts">
import type { IndicatorOverlay } from '#shared/types/indicators'

const props = withDefaults(
  defineProps<{
    paneCount?: 1 | 2
    primarySymbolId: string | null
    secondarySymbolId?: string | null
    interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'
    height?: number
    overlays?: IndicatorOverlay[]
  }>(),
  {
    paneCount: 1,
    interval: '1h',
    height: 480,
    overlays: () => [],
    secondarySymbolId: null,
  },
)

const isDualPane = computed(() => props.paneCount === 2)
</script>

<template>
  <div
    class="min-h-0 flex-1"
    data-testid="chart-grid"
  >
    <ChartChartPanel
      v-if="!isDualPane"
      :symbol-id="primarySymbolId"
      :interval="interval"
      :height="height"
      :overlays="overlays"
    />

    <WorkspaceSplitPane
      v-else
      direction="horizontal"
      :initial="50"
    >
      <template #first>
        <ChartChartPanel
          :symbol-id="primarySymbolId"
          :interval="interval"
          :height="height"
          :overlays="overlays"
        />
      </template>
      <template #second>
        <ChartChartPanel
          v-if="secondarySymbolId"
          :symbol-id="secondarySymbolId"
          :interval="interval"
          :height="height"
          :overlays="overlays"
        />
        <UiPanel
          v-else
          class="flex h-full items-center justify-center"
        >
          <p class="text-sm text-text-muted">
            Add another symbol to the watchlist for the second pane.
          </p>
        </UiPanel>
      </template>
    </WorkspaceSplitPane>
  </div>
</template>
