<script setup lang="ts">
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'

export type EquityCurvePoint = {
  time: string
  equity: number
  drawdown: number
}

const props = withDefaults(
  defineProps<{
    points: EquityCurvePoint[]
    height?: number
    showDrawdown?: boolean
  }>(),
  {
    height: 280,
    showDrawdown: true,
  },
)

const containerRef = ref<HTMLDivElement | null>(null)

let chart: IChartApi | null = null
let equitySeries: ISeriesApi<'Area'> | null = null
let drawdownSeries: ISeriesApi<'Area'> | null = null

function toChartTime(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp
}

function initChart() {
  if (!containerRef.value || chart) return

  chart = createChart(containerRef.value, {
    height: props.height,
    layout: {
      background: { type: ColorType.Solid, color: '#0F1522' },
      textColor: '#9AA6BF',
    },
    grid: {
      vertLines: { color: '#1A2338' },
      horzLines: { color: '#1A2338' },
    },
    rightPriceScale: {
      borderColor: '#232F48',
    },
    timeScale: {
      borderColor: '#232F48',
    },
    crosshair: {
      vertLine: { color: '#14E0B8', labelBackgroundColor: '#151D2E' },
      horzLine: { color: '#14E0B8', labelBackgroundColor: '#151D2E' },
    },
  })

  equitySeries = chart.addSeries(AreaSeries, {
    lineColor: '#14E0B8',
    topColor: 'rgba(20, 224, 184, 0.28)',
    bottomColor: 'rgba(20, 224, 184, 0.02)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: true,
  })

  if (props.showDrawdown) {
    drawdownSeries = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(234, 57, 67, 0.4)',
      topColor: 'rgba(234, 57, 67, 0.16)',
      bottomColor: 'rgba(234, 57, 67, 0)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry || !chart) return
    chart.applyOptions({ width: entry.contentRect.width })
  })
  resizeObserver.observe(containerRef.value)
}

function applyData(points: EquityCurvePoint[]) {
  if (!equitySeries) return

  const equityData = points.map((point) => ({
    time: toChartTime(point.time) as Time,
    value: point.equity,
  }))

  equitySeries.setData(equityData)

  if (drawdownSeries && props.showDrawdown) {
    const drawdownData = points.map((point) => ({
      time: toChartTime(point.time) as Time,
      value: point.equity * (1 - point.drawdown),
    }))
    drawdownSeries.setData(drawdownData)
  }

  chart?.timeScale().fitContent()
}

watch(
  () => props.points,
  (points) => {
    if (!import.meta.client) return
    nextTick(() => {
      initChart()
      applyData(points)
    })
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  chart?.remove()
  chart = null
  equitySeries = null
  drawdownSeries = null
})
</script>

<template>
  <div
    v-if="!points.length"
    class="flex items-center justify-center text-sm text-text-muted"
    :style="{ height: `${height}px` }"
  >
    No equity data available.
  </div>
  <div
    v-else
    ref="containerRef"
    class="w-full"
    :style="{ height: `${height}px` }"
    role="img"
    aria-label="Equity curve chart"
  />
</template>
