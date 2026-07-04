<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

const props = withDefaults(
  defineProps<{
    symbolId: string | null
    interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'
    height?: number
  }>(),
  {
    interval: '1h',
    height: 480,
  },
)

const containerRef = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

let chart: IChartApi | null = null
let series: ISeriesApi<'Candlestick'> | null = null
let unsubscribe: (() => void) | null = null

const { subscribe, connect } = useLiveChannel()

function toChartTime(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp
}

async function loadCandles(symbolId: string) {
  loading.value = true
  error.value = null

  try {
    const to = new Date().toISOString()
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const data = await $fetch<{
      candles: Array<{
        time: string
        open: number
        high: number
        low: number
        close: number
      }>
    }>(`/api/symbols/${symbolId}/candles`, {
      query: { interval: props.interval, from, to },
    })

    const candles = data.candles.map((candle) => ({
      time: toChartTime(candle.time),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }))

    series?.setData(candles)

    unsubscribe?.()
    connect()
    unsubscribe = subscribe(
      `market.candle.${symbolId}.${props.interval}`,
      (payload) => {
        const event = payload as {
          candle?: { time: string, open: number, high: number, low: number, close: number }
        }
        if (!event.candle || !series) return
        series.update({
          time: toChartTime(event.candle.time),
          open: event.candle.open,
          high: event.candle.high,
          low: event.candle.low,
          close: event.candle.close,
        })
      },
    )
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load candles'
  }
  finally {
    loading.value = false
  }
}

function initChart() {
  if (!containerRef.value || chart) return

  chart = createChart(containerRef.value, {
    height: props.height,
    layout: {
      background: { type: ColorType.Solid, color: '#0A0E17' },
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

  series = chart.addSeries(CandlestickSeries, {
    upColor: '#16C784',
    downColor: '#EA3943',
    borderVisible: false,
    wickUpColor: '#16C784',
    wickDownColor: '#EA3943',
  })

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry || !chart) return
    chart.applyOptions({ width: entry.contentRect.width })
  })
  resizeObserver.observe(containerRef.value)
}

watch(
  () => [props.symbolId, props.interval] as const,
  async ([symbolId]) => {
    if (!import.meta.client || !symbolId) return
    await nextTick()
    initChart()
    await loadCandles(symbolId)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unsubscribe?.()
  chart?.remove()
  chart = null
  series = null
})
</script>

<template>
  <UiPanel class="overflow-hidden p-0">
    <div class="flex items-center justify-between border-b border-border-hair px-4 py-2">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium tracking-wide text-text-muted uppercase">Chart</span>
        <span class="font-mono text-sm text-text-primary">{{ interval }}</span>
      </div>
      <UiBadge
        v-if="loading"
        label="Loading"
        variant="info"
      />
      <UiBadge
        v-else-if="error"
        :label="error"
        variant="bear"
      />
    </div>

    <div
      v-if="!symbolId"
      class="flex items-center justify-center text-sm text-text-muted"
      :style="{ height: `${height}px` }"
    >
      Select a symbol to load the chart.
    </div>
    <div
      v-else
      ref="containerRef"
      class="w-full"
      :style="{ height: `${height}px` }"
      role="img"
      aria-label="Candlestick price chart"
    />
  </UiPanel>
</template>
