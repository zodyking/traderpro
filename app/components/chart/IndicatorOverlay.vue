<script setup lang="ts">
import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { IndicatorOverlay } from '#shared/types/indicators'
import {
  computeOverlaySeries,
  paletteColor,
  type IndicatorCandle,
} from '~/utils/indicators'

const props = defineProps<{
  chart: IChartApi | null
  candles: IndicatorCandle[]
  overlays: IndicatorOverlay[]
}>()

type ManagedSeries = {
  overlayId: string
  series: ISeriesApi<'Line'>
  priceScaleId: string
}

const managedSeries = new Map<string, ManagedSeries>()

function toChartTime(time: string): UTCTimestamp {
  return Math.floor(new Date(time).getTime() / 1000) as UTCTimestamp
}

function priceScaleForType(type: IndicatorOverlay['type']): string {
  if (type === 'rsi') return 'rsi'
  if (type === 'atr') return 'atr'
  return 'right'
}

function ensurePriceScales(chart: IChartApi) {
  chart.priceScale('rsi').applyOptions({
    scaleMargins: { top: 0.75, bottom: 0 },
    borderColor: '#232F48',
  })
  chart.priceScale('atr').applyOptions({
    scaleMargins: { top: 0.85, bottom: 0 },
    borderColor: '#232F48',
  })
}

function overlayColor(overlay: IndicatorOverlay, index: number): string {
  return overlay.color ?? paletteColor(index)
}

function syncOverlaySeries() {
  const chart = props.chart
  if (!chart) return

  ensurePriceScales(chart)

  const activeIds = new Set(props.overlays.map((overlay) => overlay.id))

  for (const [id, managed] of managedSeries) {
    if (!activeIds.has(id)) {
      chart.removeSeries(managed.series)
      managedSeries.delete(id)
    }
  }

  props.overlays.forEach((overlay, index) => {
    const priceScaleId = priceScaleForType(overlay.type)
    let managed = managedSeries.get(overlay.id)

    if (!managed) {
      const series = chart.addSeries(LineSeries, {
        color: overlayColor(overlay, index),
        lineWidth: 2,
        priceScaleId,
        visible: overlay.visible,
        title: overlay.type.toUpperCase(),
        crosshairMarkerVisible: false,
        lastValueVisible: true,
        priceLineVisible: false,
      })
      managed = { overlayId: overlay.id, series, priceScaleId }
      managedSeries.set(overlay.id, managed)
    }
    else {
      managed.series.applyOptions({
        color: overlayColor(overlay, index),
        visible: overlay.visible,
        priceScaleId,
      })
    }

    if (!overlay.visible || !props.candles.length) {
      managed.series.setData([])
      return
    }

    const points = computeOverlaySeries(props.candles, overlay)
    const lineData: LineData<UTCTimestamp>[] = points.map((point) => ({
      time: toChartTime(point.time),
      value: point.value,
    }))

    managed.series.setData(lineData)
  })
}

watch(
  () => [props.chart, props.candles, props.overlays] as const,
  () => {
    syncOverlaySeries()
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  const chart = props.chart
  if (!chart) {
    managedSeries.clear()
    return
  }

  for (const managed of managedSeries.values()) {
    chart.removeSeries(managed.series)
  }
  managedSeries.clear()
})
</script>

<template>
  <span class="sr-only" aria-hidden="true">Indicator overlays</span>
</template>
