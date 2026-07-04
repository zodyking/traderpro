export type IndicatorType = 'ema' | 'sma' | 'rsi' | 'vwap' | 'atr'

export type IndicatorOverlay = {
  id: string
  type: IndicatorType
  params: Record<string, number>
  color?: string
  visible: boolean
}
