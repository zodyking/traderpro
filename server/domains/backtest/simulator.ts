import type { RiskModel, RuleAst } from '../../../shared/types/strategy'
import type { EquityPoint, SimulatedTrade, SimulationResult } from '../../../shared/types/backtest'
import { atr } from '../strategy/indicators'
import { compileRuleAst, type CandleContext } from '../strategy/compiler'

const DEFAULT_SLIPPAGE_PCT = 0.0005
const DEFAULT_FEE_PCT = 0.001
const DEFAULT_EQUITY_PCT = 0.1

export type SimulatorCandle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type SimulateInput = {
  symbolId: string
  candles: SimulatorCandle[]
  rules: RuleAst
  riskModel: RiskModel
  startingCapital: number
  slippagePct?: number
  feePct?: number
  fillModel?: 'next_open' | 'close_confirmation'
}

type OpenPosition = {
  entryTime: Date
  entryPrice: number
  qty: number
  stopPrice?: number
  initialStopPrice?: number
  targetPrice?: number
  highWaterMark: number
  signalSnapshot: Record<string, unknown>
  riskPerShare: number
}

function toCandleContext(candles: SimulatorCandle[]): CandleContext {
  return {
    open: candles.map(c => c.open),
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    volume: candles.map(c => c.volume ?? 0),
  }
}

function applyEntrySlippage(price: number, slippagePct: number): number {
  return price * (1 + slippagePct)
}

function applyExitSlippage(price: number, slippagePct: number): number {
  return price * (1 - slippagePct)
}

function tradeFee(notional: number, feePct: number): number {
  return notional * feePct
}

function resolveStopPrice(
  entryPrice: number,
  riskModel: RiskModel,
  ctx: CandleContext,
  barIndex: number,
): number | undefined {
  const stop = riskModel.stopLoss
  if (!stop) return undefined

  switch (stop.type) {
    case 'percent':
      return entryPrice * (1 - stop.value / 100)
    case 'fixed':
      return entryPrice - stop.value
    case 'atr': {
      const series = atr(ctx.high, ctx.low, ctx.close, 14)
      const atrValue = series[barIndex]
      if (!Number.isFinite(atrValue)) return undefined
      return entryPrice - atrValue! * stop.value
    }
    default:
      return undefined
  }
}

function resolveTrailingStopPrice(
  highWaterMark: number,
  riskModel: RiskModel,
  ctx: CandleContext,
  barIndex: number,
): number | undefined {
  const trailing = riskModel.trailingStop
  if (!trailing) return undefined

  switch (trailing.type) {
    case 'percent':
      return highWaterMark * (1 - trailing.value / 100)
    case 'atr': {
      const series = atr(ctx.high, ctx.low, ctx.close, 14)
      const atrValue = series[barIndex]
      if (!Number.isFinite(atrValue)) return undefined
      return highWaterMark - atrValue! * trailing.value
    }
    default:
      return undefined
  }
}

function ratchetTrailingStop(
  position: OpenPosition,
  riskModel: RiskModel,
  ctx: CandleContext,
  barIndex: number,
  candle: SimulatorCandle,
): void {
  position.highWaterMark = Math.max(position.highWaterMark, candle.high)
  const trailingLevel = resolveTrailingStopPrice(position.highWaterMark, riskModel, ctx, barIndex)
  if (trailingLevel === undefined) return

  position.stopPrice = position.stopPrice !== undefined
    ? Math.max(position.stopPrice, trailingLevel)
    : trailingLevel
}

function stopExitReason(position: OpenPosition): SimulatedTrade['exitReason'] {
  if (
    position.initialStopPrice !== undefined
    && position.stopPrice !== undefined
    && position.stopPrice > position.initialStopPrice
  ) {
    return 'trailing_stop'
  }
  return 'stop_loss'
}

function openPosition(
  candle: SimulatorCandle,
  fillPrice: number,
  riskModel: RiskModel,
  ctx: CandleContext,
  barIndex: number,
  cash: number,
  feePct: number,
  signalSnapshot: Record<string, unknown>,
): { position: OpenPosition; cost: number } | null {
  const stopPrice = resolveStopPrice(fillPrice, riskModel, ctx, barIndex)
  const targetPrice = resolveTargetPrice(fillPrice, stopPrice, riskModel)
  const qty = resolvePositionQty(cash, fillPrice, riskModel, stopPrice)
  const cost = fillPrice * qty
  const fees = tradeFee(cost, feePct)

  if (qty <= 0 || cost + fees > cash) return null

  return {
    position: {
      entryTime: new Date(candle.time),
      entryPrice: fillPrice,
      qty,
      stopPrice,
      initialStopPrice: stopPrice,
      targetPrice,
      highWaterMark: Math.max(fillPrice, candle.high),
      signalSnapshot,
      riskPerShare: stopPrice !== undefined ? fillPrice - stopPrice : 0,
    },
    cost: cost + fees,
  }
}

function resolveTargetPrice(
  entryPrice: number,
  stopPrice: number | undefined,
  riskModel: RiskModel,
): number | undefined {
  const target = riskModel.takeProfit
  if (!target) return undefined

  switch (target.type) {
    case 'percent':
      return entryPrice * (1 + target.value / 100)
    case 'fixed':
      return entryPrice + target.value
    case 'r_multiple': {
      const risk = stopPrice !== undefined ? entryPrice - stopPrice : undefined
      if (risk === undefined || risk <= 0) return undefined
      return entryPrice + risk * target.value
    }
    default:
      return undefined
  }
}

function resolvePositionQty(
  equity: number,
  entryPrice: number,
  riskModel: RiskModel,
  stopPrice?: number,
): number {
  const sizing = riskModel.sizingMethod ?? 'percent_equity'

  if (sizing === 'risk_per_trade' && stopPrice !== undefined && riskModel.maxRiskPerTrade) {
    const riskPerShare = entryPrice - stopPrice
    if (riskPerShare > 0) {
      const riskBudget = equity * riskModel.maxRiskPerTrade
      return riskBudget / riskPerShare
    }
  }

  if (sizing === 'fixed_shares' && riskModel.maxRiskPerTrade) {
    return riskModel.maxRiskPerTrade
  }

  if (sizing === 'fixed_dollars' && riskModel.maxRiskPerTrade) {
    return riskModel.maxRiskPerTrade / entryPrice
  }

  return (equity * DEFAULT_EQUITY_PCT) / entryPrice
}

function closeTrade(
  position: OpenPosition,
  exitTime: Date,
  exitPrice: number,
  exitReason: SimulatedTrade['exitReason'],
  feePct: number,
  slippagePct: number,
): { trade: SimulatedTrade; proceeds: number } {
  const fillPrice = applyExitSlippage(exitPrice, slippagePct)
  const gross = fillPrice * position.qty
  const fees = tradeFee(position.entryPrice * position.qty, feePct) + tradeFee(gross, feePct)
  const pnl = gross - position.entryPrice * position.qty - fees
  const rMultiple = position.riskPerShare > 0
    ? pnl / (position.riskPerShare * position.qty)
    : undefined

  return {
    trade: {
      symbolId: '',
      side: 'long',
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      exitTime,
      exitPrice: fillPrice,
      qty: position.qty,
      pnl,
      rMultiple,
      exitReason,
      signalSnapshot: position.signalSnapshot,
    },
    proceeds: gross - tradeFee(gross, feePct),
  }
}

export function simulateLongOnly(input: SimulateInput): SimulationResult {
  const {
    symbolId,
    candles,
    rules,
    riskModel,
    startingCapital,
    slippagePct = DEFAULT_SLIPPAGE_PCT,
    feePct = DEFAULT_FEE_PCT,
    fillModel = 'next_open',
  } = input

  if (candles.length === 0) {
    return { trades: [], equityPoints: [], finalEquity: startingCapital }
  }

  const ctx = toCandleContext(candles)
  const compiled = compileRuleAst(rules, ctx)
  const entrySignalIds = new Set(
    rules.signals.filter(signal => signal.kind === 'entry_long').map(signal => signal.id),
  )
  const exitSignalIds = new Set(
    rules.signals.filter(signal => signal.kind === 'exit').map(signal => signal.id),
  )

  let cash = startingCapital
  let position: OpenPosition | null = null
  let pendingEntry: { barIndex: number; signals: string[] } | null = null
  let pendingExit: { barIndex: number; signals: string[] } | null = null
  const trades: SimulatedTrade[] = []
  const equityPoints: EquityPoint[] = []
  let peakEquity = startingCapital

  const markEquity = (index: number) => {
    const mark = position
      ? cash + position.qty * candles[index]!.close
      : cash
    peakEquity = Math.max(peakEquity, mark)
    const drawdown = peakEquity > 0 ? (peakEquity - mark) / peakEquity : 0
    equityPoints.push({
      time: new Date(candles[index]!.time),
      equity: mark,
      drawdown,
    })
  }

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]!

    if (fillModel === 'next_open' && pendingExit && i > pendingExit.barIndex && position) {
      const { trade, proceeds } = closeTrade(
        position,
        new Date(candle.time),
        candle.open,
        'signal',
        feePct,
        slippagePct,
      )
      trade.symbolId = symbolId
      trades.push(trade)
      cash += proceeds
      position = null
      pendingExit = null
    }

    if (fillModel === 'next_open' && pendingEntry && i > pendingEntry.barIndex && !position) {
      const entryFill = applyEntrySlippage(candle.open, slippagePct)
      const opened = openPosition(
        candle,
        entryFill,
        riskModel,
        ctx,
        i,
        cash,
        feePct,
        { entrySignals: pendingEntry.signals },
      )
      if (opened) {
        cash -= opened.cost
        position = opened.position
      }
      pendingEntry = null
    }

    if (position) {
      ratchetTrailingStop(position, riskModel, ctx, i, candle)

      if (position.stopPrice !== undefined && candle.low <= position.stopPrice) {
        const stopFill = Math.min(candle.open, position.stopPrice)
        const { trade, proceeds } = closeTrade(
          position,
          new Date(candle.time),
          stopFill,
          stopExitReason(position),
          feePct,
          slippagePct,
        )
        trade.symbolId = symbolId
        trades.push(trade)
        cash += proceeds
        position = null
        pendingExit = null
      }
      else if (position.targetPrice !== undefined && candle.high >= position.targetPrice) {
        const targetFill = Math.max(candle.open, position.targetPrice)
        const { trade, proceeds } = closeTrade(
          position,
          new Date(candle.time),
          targetFill,
          'take_profit',
          feePct,
          slippagePct,
        )
        trade.symbolId = symbolId
        trades.push(trade)
        cash += proceeds
        position = null
        pendingExit = null
      }
    }

    const { signals } = compiled.evaluateBar(i)
    const entryHits = signals.filter(id => entrySignalIds.has(id))
    const exitHits = signals.filter(id => exitSignalIds.has(id))

    if (!position && !pendingEntry && entryHits.length > 0) {
      if (fillModel === 'close_confirmation') {
        const entryFill = applyEntrySlippage(candle.close, slippagePct)
        const opened = openPosition(
          candle,
          entryFill,
          riskModel,
          ctx,
          i,
          cash,
          feePct,
          { entrySignals: entryHits },
        )
        if (opened) {
          cash -= opened.cost
          position = opened.position
        }
      }
      else {
        pendingEntry = { barIndex: i, signals: entryHits }
      }
    }

    if (position && !pendingExit && exitHits.length > 0) {
      if (fillModel === 'close_confirmation') {
        const { trade, proceeds } = closeTrade(
          position,
          new Date(candle.time),
          candle.close,
          'signal',
          feePct,
          slippagePct,
        )
        trade.symbolId = symbolId
        trades.push(trade)
        cash += proceeds
        position = null
      }
      else {
        pendingExit = { barIndex: i, signals: exitHits }
      }
    }

    markEquity(i)
  }

  if (position) {
    const last = candles[candles.length - 1]!
    const { trade, proceeds } = closeTrade(
      position,
      new Date(last.time),
      last.close,
      'end_of_data',
      feePct,
      slippagePct,
    )
    trade.symbolId = symbolId
    trades.push(trade)
    cash += proceeds

    const mark = cash
    peakEquity = Math.max(peakEquity, mark)
    const drawdown = peakEquity > 0 ? (peakEquity - mark) / peakEquity : 0
    equityPoints[equityPoints.length - 1] = {
      time: new Date(last.time),
      equity: mark,
      drawdown,
    }
  }

  return {
    trades,
    equityPoints,
    finalEquity: cash,
  }
}
