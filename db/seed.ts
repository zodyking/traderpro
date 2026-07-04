import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { plans, providers, symbols } from './schema'

const DEMO_SYMBOLS = [
  {
    id: '01930000-0000-7000-8000-000000000001',
    providerId: 'tradingview',
    exchange: 'NASDAQ',
    ticker: 'AAPL',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'Apple Inc.' },
  },
  {
    id: '01930000-0000-7000-8000-000000000002',
    providerId: 'tradingview',
    exchange: 'AMEX',
    ticker: 'SPY',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'SPDR S&P 500 ETF Trust' },
  },
  {
    id: '01930000-0000-7000-8000-000000000003',
    providerId: 'tradingview',
    exchange: 'BINANCE',
    ticker: 'BTCUSDT',
    assetClass: 'crypto',
    currency: 'USDT',
    meta: { description: 'Bitcoin / Tether' },
  },
  {
    id: '01930000-0000-7000-8000-000000000004',
    providerId: 'tradingview',
    exchange: 'NASDAQ',
    ticker: 'MSFT',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'Microsoft Corporation' },
  },
  {
    id: '01930000-0000-7000-8000-000000000005',
    providerId: 'tradingview',
    exchange: 'NASDAQ',
    ticker: 'TSLA',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'Tesla, Inc.' },
  },
] as const

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const connection = postgres(databaseUrl, { max: 1 })
  const db = drizzle(connection)

  await db
    .insert(plans)
    .values([
      {
        id: 'free',
        label: 'Free',
        limits: {
          backtestsPerMonth: 5,
          scannerSymbols: 10,
          aiCredits: 3,
          brokerAccounts: 1,
          savedStrategies: 3,
          savedWorkspaces: 1,
        },
      },
      {
        id: 'starter',
        label: 'Starter',
        limits: {
          backtestsPerMonth: 25,
          scannerSymbols: 25,
          aiCredits: 15,
          brokerAccounts: 2,
          savedStrategies: 10,
          savedWorkspaces: 3,
        },
      },
      {
        id: 'pro',
        label: 'Pro',
        limits: {
          backtestsPerMonth: 100,
          scannerSymbols: 100,
          aiCredits: 50,
          brokerAccounts: 5,
          savedStrategies: 50,
          savedWorkspaces: 10,
          exports: 10,
        },
      },
      {
        id: 'power',
        label: 'Power',
        limits: {
          backtestsPerMonth: 500,
          scannerSymbols: 500,
          aiCredits: 200,
          brokerAccounts: 20,
          savedStrategies: 200,
          savedWorkspaces: 50,
          exports: 100,
          apiCalls: 10000,
        },
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(providers)
    .values({
      id: 'tradingview',
      label: 'TradingView',
      status: 'healthy',
    })
    .onConflictDoNothing()

  await db.insert(symbols).values([...DEMO_SYMBOLS]).onConflictDoNothing()

  await connection.end()
  console.log('Seed complete: plans, tradingview provider, demo symbols')
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
