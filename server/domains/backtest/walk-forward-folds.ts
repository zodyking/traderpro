export type WalkForwardFold = {
  foldIndex: number
  from: string
  to: string
}

export function splitDateRangeIntoFolds(
  from: string,
  to: string,
  foldCount: number,
): WalkForwardFold[] {
  if (foldCount < 1) {
    throw new Error('foldCount must be at least 1')
  }

  const startMs = Date.parse(from)
  const endMs = Date.parse(to)

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error('Invalid date range')
  }
  if (endMs <= startMs) {
    throw new Error('End date must be after start date')
  }

  const totalMs = endMs - startMs
  const foldMs = totalMs / foldCount
  const folds: WalkForwardFold[] = []

  for (let i = 0; i < foldCount; i++) {
    const foldStart = startMs + Math.floor(i * foldMs)
    const foldEnd = i === foldCount - 1 ? endMs : startMs + Math.floor((i + 1) * foldMs)
    folds.push({
      foldIndex: i,
      from: new Date(foldStart).toISOString(),
      to: new Date(foldEnd).toISOString(),
    })
  }

  return folds
}
