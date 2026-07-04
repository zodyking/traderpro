import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { hash } from '@node-rs/argon2'
import { plans, providers, symbols, users, workspaces, watchlists, watchlistSymbols, strategies, strategyVersions } from './schema'
import { createTrendPullbackRules, createTrendPullbackRiskModel } from '../shared/templates/trend-pullback'

const DEMO_SYMBOLS = [
  {
    id: '01930000-0000-7000-8000-000000000001',
    providerId: 'tradingview',
    exchange: 'NASDAQ',
    ticker: 'AAPL',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'Apple Inc.', tvMarketId: 'NASDAQ:AAPL' },
  },
  {
    id: '01930000-0000-7000-8000-000000000002',
    providerId: 'tradingview',
    exchange: 'AMEX',
    ticker: 'SPY',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'SPDR S&P 500 ETF Trust', tvMarketId: 'AMEX:SPY' },
  },
  {
    id: '01930000-0000-7000-8000-000000000003',
    providerId: 'tradingview',
    exchange: 'BINANCE',
    ticker: 'BTCUSDT',
    assetClass: 'crypto',
    currency: 'USDT',
    meta: { description: 'Bitcoin / Tether', tvMarketId: 'BINANCE:BTCUSDT' },
  },
  {
    id: '01930000-0000-7000-8000-000000000004',
    providerId: 'tradingview',
    exchange: 'NASDAQ',
    ticker: 'MSFT',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'Microsoft Corporation', tvMarketId: 'NASDAQ:MSFT' },
  },
  {
    id: '01930000-0000-7000-8000-000000000005',
    providerId: 'tradingview',
    exchange: 'NASDAQ',
    ticker: 'TSLA',
    assetClass: 'stock',
    currency: 'USD',
    meta: { description: 'Tesla, Inc.', tvMarketId: 'NASDAQ:TSLA' },
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

  // Demo user
  const DEMO_USER_ID = '01930000-0000-7000-8000-000000000100'
  const DEMO_WORKSPACE_ID = '01930000-0000-7000-8000-000000000200'
  const DEMO_WATCHLIST_ID = '01930000-0000-7000-8000-000000000300'
  const DEMO_STRATEGY_ID = '01930000-0000-7000-8000-000000000400'
  const DEMO_VERSION_ID = '01930000-0000-7000-8000-000000000500'

  const passwordHash = await hash('demo1234', {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  await db
    .insert(users)
    .values({
      id: DEMO_USER_ID,
      email: 'demo@axiomedge.app',
      passwordHash,
      displayName: 'Demo Trader',
      experience: 'developing',
      uiMode: 'novice',
    })
    .onConflictDoNothing()

  await db
    .insert(workspaces)
    .values({
      id: DEMO_WORKSPACE_ID,
      userId: DEMO_USER_ID,
      name: 'Main Workspace',
      isDefault: true,
      layout: { chartInterval: '1h', watchlistRailOpen: true },
    })
    .onConflictDoNothing()

  await db
    .insert(watchlists)
    .values({
      id: DEMO_WATCHLIST_ID,
      userId: DEMO_USER_ID,
      name: 'My Watchlist',
      sort: 0,
    })
    .onConflictDoNothing()

  const watchlistSymbolRows = [
    { symbolId: '01930000-0000-7000-8000-000000000001', sort: 0 }, // AAPL
    { symbolId: '01930000-0000-7000-8000-000000000004', sort: 1 }, // MSFT
    { symbolId: '01930000-0000-7000-8000-000000000002', sort: 2 }, // SPY
  ]

  for (const row of watchlistSymbolRows) {
    await db
      .insert(watchlistSymbols)
      .values({ watchlistId: DEMO_WATCHLIST_ID, ...row })
      .onConflictDoNothing()
  }

  await db
    .insert(strategies)
    .values({
      id: DEMO_STRATEGY_ID,
      userId: DEMO_USER_ID,
      name: 'Trend Pullback — Demo',
      assetClass: 'stock',
      timeframe: '1h',
    })
    .onConflictDoNothing()

  await db
    .insert(strategyVersions)
    .values({
      id: DEMO_VERSION_ID,
      strategyId: DEMO_STRATEGY_ID,
      version: 1,
      rules: createTrendPullbackRules(),
      riskModel: createTrendPullbackRiskModel(),
      filters: {},
      assumptions: {},
      note: 'Initial version from onboarding template',
    })
    .onConflictDoNothing()

  await connection.end()
  console.log('Seed complete: plans, tradingview provider, demo symbols, demo user + workspace + watchlist + strategy')
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
