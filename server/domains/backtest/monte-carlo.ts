export type MonteCarloDistribution = {
  p5: number
  p50: number
  p95: number
}

export type MonteCarloResult = {
  iterations: number
  tradeCount: number
  returns: MonteCarloDistribution
  maxDrawdown: MonteCarloDistribution
}

export type RandomSource = () => number

function defaultRandom(): number {
  return Math.random()
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]!

  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]!

  const weight = index - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

function distributionFromSamples(samples: number[]): MonteCarloDistribution {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    p5: percentile(sorted, 0.05),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  }
}

function simulateEquityPath(
  pnls: number[],
  startingCapital: number,
  random: RandomSource,
): { totalReturn: number; maxDrawdown: number } {
  let equity = startingCapital
  let peak = startingCapital
  let maxDrawdown = 0

  for (let i = 0; i < pnls.length; i++) {
    const idx = Math.floor(random() * pnls.length)
    equity += pnls[idx]!
    peak = Math.max(peak, equity)
    const drawdown = peak > 0 ? (peak - equity) / peak : 0
    maxDrawdown = Math.max(maxDrawdown, drawdown)
  }

  const totalReturn = startingCapital > 0
    ? (equity - startingCapital) / startingCapital
    : 0

  return { totalReturn, maxDrawdown }
}

export function runMonteCarlo(input: {
  pnls: number[]
  startingCapital: number
  iterations: number
  random?: RandomSource
}): MonteCarloResult {
  const { pnls, startingCapital, iterations } = input
  const random = input.random ?? defaultRandom

  if (iterations < 1) {
    throw new Error('iterations must be at least 1')
  }

  if (pnls.length === 0) {
    return {
      iterations,
      tradeCount: 0,
      returns: { p5: 0, p50: 0, p95: 0 },
      maxDrawdown: { p5: 0, p50: 0, p95: 0 },
    }
  }

  const totalReturns: number[] = []
  const maxDrawdowns: number[] = []

  for (let i = 0; i < iterations; i++) {
    const path = simulateEquityPath(pnls, startingCapital, random)
    totalReturns.push(path.totalReturn)
    maxDrawdowns.push(path.maxDrawdown)
  }

  return {
    iterations,
    tradeCount: pnls.length,
    returns: distributionFromSamples(totalReturns),
    maxDrawdown: distributionFromSamples(maxDrawdowns),
  }
}
