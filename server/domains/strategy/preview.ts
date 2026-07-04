import type { RuleAst } from '../../../shared/types/strategy'
import { getCandles } from '../market-data/service'
import { type CandleContext, compileRuleAst } from './compiler'

export type SignalMarker = {
  time: string
  signalId: string
  signalName: string
  kind: string
  price: number
}

export async function previewStrategySignals(input: {
  symbolId: string
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'
  rules: RuleAst
}): Promise<{ markers: SignalMarker[], triggerCount: number }> {
  const to = new Date().toISOString()
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const series = await getCandles({
    symbolId: input.symbolId,
    interval: input.interval,
    from,
    to,
  })

  const ctx: CandleContext = {
    open: series.candles.map((c: { open: number }) => c.open),
    high: series.candles.map((c: { high: number }) => c.high),
    low: series.candles.map((c: { low: number }) => c.low),
    close: series.candles.map((c: { close: number }) => c.close),
    volume: series.candles.map((c: { volume?: number }) => c.volume ?? 0),
  }

  const compiled = compileRuleAst(input.rules, ctx)
  const markers: SignalMarker[] = []
  const signalMap = new Map(input.rules.signals.map((signal) => [signal.id, signal]))

  for (let index = 1; index < ctx.close.length; index++) {
    const { signals: fired } = compiled.evaluateBar(index)
    for (const signalId of fired) {
      const signal = signalMap.get(signalId)
      if (!signal) continue
      markers.push({
        time: series.candles[index]!.time,
        signalId,
        signalName: signal.name,
        kind: signal.kind,
        price: ctx.close[index]!,
      })
    }
  }

  return {
    markers,
    triggerCount: markers.length,
  }
}
