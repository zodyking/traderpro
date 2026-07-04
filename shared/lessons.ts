export type LessonCatalogEntry = {
  id: string
  title: string
  stage: string
  source: string
  duration: string
}

export const LESSON_CATALOG: LessonCatalogEntry[] = [
  { id: 'f1', title: 'How exchanges work', stage: 'Foundation', source: 'Core', duration: '8 min' },
  { id: 'f2', title: 'Bid/ask spread and liquidity', stage: 'Foundation', source: 'Core', duration: '6 min' },
  { id: 'f3', title: 'Market vs. limit orders', stage: 'Foundation', source: 'Core', duration: '5 min' },
  { id: 'f4', title: 'Reading a candlestick chart', stage: 'Foundation', source: 'Core', duration: '10 min' },
  { id: 't1', title: 'Moving averages (SMA vs EMA)', stage: 'Technical Analysis', source: 'Core', duration: '9 min' },
  { id: 't2', title: 'RSI and momentum', stage: 'Technical Analysis', source: 'Core', duration: '8 min' },
  { id: 't3', title: 'Support and resistance', stage: 'Technical Analysis', source: 'Core', duration: '12 min' },
  { id: 't4', title: 'Volume confirmation', stage: 'Technical Analysis', source: 'Mistake cluster', duration: '7 min' },
  { id: 'r1', title: 'Risk-reward ratio fundamentals', stage: 'Risk Management', source: 'Core', duration: '10 min' },
  { id: 'r2', title: 'Sizing by fixed risk %', stage: 'Risk Management', source: 'Core', duration: '8 min' },
  { id: 'r3', title: 'Why traders skip stops', stage: 'Risk Management', source: 'Mistake cluster', duration: '6 min' },
  { id: 'r4', title: 'Max daily loss rules', stage: 'Risk Management', source: 'Core', duration: '7 min' },
  { id: 's1', title: 'Entry signal design', stage: 'Strategy Building', source: 'Core', duration: '11 min' },
  { id: 's2', title: 'Exit rules and take-profit logic', stage: 'Strategy Building', source: 'Core', duration: '9 min' },
  { id: 's3', title: 'Over-optimising for past data', stage: 'Strategy Building', source: 'Mistake cluster', duration: '8 min' },
  { id: 's4', title: 'Walk-forward testing basics', stage: 'Strategy Building', source: 'Core', duration: '12 min' },
  { id: 'b1', title: 'Reading Sharpe and Sortino', stage: 'Backtesting & Validation', source: 'Core', duration: '9 min' },
  { id: 'b2', title: 'Max drawdown and recovery', stage: 'Backtesting & Validation', source: 'Core', duration: '8 min' },
  { id: 'b3', title: '"Exploratory" results (< 30 trades)', stage: 'Backtesting & Validation', source: 'Mistake cluster', duration: '6 min' },
  { id: 'b4', title: 'Data quality warnings', stage: 'Backtesting & Validation', source: 'Core', duration: '7 min' },
  { id: 'l1', title: 'Paper trading before going live', stage: 'Live Trading', source: 'Core', duration: '8 min' },
  { id: 'l2', title: 'Slippage and execution realism', stage: 'Live Trading', source: 'Core', duration: '7 min' },
  { id: 'l3', title: 'Emotional discipline under drawdown', stage: 'Live Trading', source: 'Mistake cluster', duration: '10 min' },
  { id: 'l4', title: 'Scaling position size gradually', stage: 'Live Trading', source: 'Core', duration: '9 min' },
]

export function findLessonById(id: string): LessonCatalogEntry | undefined {
  return LESSON_CATALOG.find(lesson => lesson.id === id)
}
