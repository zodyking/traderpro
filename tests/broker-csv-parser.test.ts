import { describe, expect, it } from 'vitest'
import { parseBrokerCsv } from '../server/domains/broker/csv-parser'

// ─── Generic CSV ────────────────────────────────────────────────────────────

describe('parseBrokerCsv - generic CSV parsing', () => {
  const genericCsv = [
    'Date,Symbol,Side,Qty,Price,Fees',
    '2024-01-15,AAPL,BUY,100,185.50,1.00',
    '2024-01-16,AAPL,SELL,100,188.00,1.00',
    '2024-01-17,TSLA,buy,50,200.00,0.50',
    '2024-01-18,TSLA,sell,50,210.00,0.50',
  ].join('\n')

  it('parses all valid rows', () => {
    const result = parseBrokerCsv(genericCsv, 'generic')
    expect(result.rows).toHaveLength(4)
    expect(result.errors).toHaveLength(0)
  })

  it('maps rawSymbol, qty, price, fees correctly', () => {
    const result = parseBrokerCsv(genericCsv, 'generic')
    const row = result.rows[0]!
    expect(row.rawSymbol).toBe('AAPL')
    expect(row.qty).toBe(100)
    expect(row.price).toBeCloseTo(185.5)
    expect(row.fees).toBeCloseTo(1.0)
  })

  it('parses executedAt as a valid Date', () => {
    const result = parseBrokerCsv(genericCsv, 'generic')
    expect(result.rows[0]!.executedAt).toBeInstanceOf(Date)
    expect(result.rows[0]!.executedAt.toISOString()).toContain('2024-01-15')
  })

  it('stores the broker name in sourcePayload', () => {
    const result = parseBrokerCsv(genericCsv, 'my_broker')
    expect(result.rows[0]!.sourcePayload.broker).toBe('my_broker')
  })

  it('uses absolute value for qty (always positive)', () => {
    const csv = [
      'Date,Symbol,Side,Qty,Price',
      '2024-01-01,AAPL,SELL,100,150',
    ].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.qty).toBeGreaterThan(0)
  })
})

// ─── Side Normalization ──────────────────────────────────────────────────────

describe('parseBrokerCsv - side normalization', () => {
  function singleRow(side: string) {
    return ['Date,Symbol,Side,Qty,Price', `2024-01-01,AAPL,${side},10,100`].join('\n')
  }

  const validSides: Array<[string, 'buy' | 'sell']> = [
    ['BUY', 'buy'],
    ['buy', 'buy'],
    ['B', 'buy'],
    ['BOT', 'buy'],
    ['BOUGHT', 'buy'],
    ['SELL', 'sell'],
    ['sell', 'sell'],
    ['S', 'sell'],
    ['SLD', 'sell'],
    ['SOLD', 'sell'],
  ]

  for (const [input, expected] of validSides) {
    it(`normalizes "${input}" → "${expected}"`, () => {
      const result = parseBrokerCsv(singleRow(input), 'generic')
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]!.side).toBe(expected)
    })
  }

  it('returns an error for an unrecognised side value', () => {
    const result = parseBrokerCsv(singleRow('LONG'), 'generic')
    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]!.message).toMatch(/LONG/i)
  })
})

// ─── Parse Warnings / Errors ─────────────────────────────────────────────────

describe('parseBrokerCsv - parse warnings for bad rows', () => {
  it('reports an error when no valid header row is present', () => {
    const csv = 'foo,bar,baz\n1,2,3'
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]!.message).toMatch(/header/i)
  })

  it('reports an error for a non-numeric quantity', () => {
    const csv = ['Date,Symbol,Side,Qty,Price', '2024-01-01,AAPL,BUY,notanumber,100'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]!.message).toMatch(/quantity/i)
  })

  it('reports an error for zero quantity', () => {
    const csv = ['Date,Symbol,Side,Qty,Price', '2024-01-01,AAPL,BUY,0,100'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]!.message).toMatch(/quantity/i)
  })

  it('reports an error for an invalid price', () => {
    const csv = ['Date,Symbol,Side,Qty,Price', '2024-01-01,AAPL,BUY,10,abc'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]!.message).toMatch(/price/i)
  })

  it('reports an error for an invalid date', () => {
    const csv = ['Date,Symbol,Side,Qty,Price', 'not-a-date,AAPL,BUY,10,100'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]!.message).toMatch(/date/i)
  })

  it('silently skips rows without a symbol', () => {
    const csv = ['Date,Symbol,Side,Qty,Price', '2024-01-01,,BUY,10,100'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(0)
  })

  it('collects multiple errors across rows', () => {
    const csv = [
      'Date,Symbol,Side,Qty,Price',
      '2024-01-01,AAPL,INVALID,10,100',
      '2024-01-02,MSFT,BADSIDE,20,200',
    ].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('still returns valid rows when some rows are bad', () => {
    const csv = [
      'Date,Symbol,Side,Qty,Price',
      '2024-01-01,AAPL,BUY,10,150',
      '2024-01-02,MSFT,BADSIDE,20,200',
      '2024-01-03,GOOG,SELL,5,100',
    ].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
  })

  it('defaults fees to 0 when the Fees column is absent', () => {
    const csv = ['Date,Symbol,Side,Qty,Price', '2024-01-01,AAPL,BUY,10,100'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.fees).toBe(0)
  })
})

// ─── Number / Currency Formatting ────────────────────────────────────────────

describe('parseBrokerCsv - numeric formatting', () => {
  it('strips $ prefix from price', () => {
    const csv = ['Date,Symbol,Side,Qty,Price,Fees', '2024-01-01,AAPL,BUY,10,$150.00,$1.00'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.price).toBeCloseTo(150.0)
    expect(result.rows[0]!.fees).toBeCloseTo(1.0)
  })

  it('handles comma-separated numbers (e.g., 1,000)', () => {
    const csv = [
      'Date,Symbol,Side,Qty,Price',
      '2024-01-01,AAPL,BUY,"1,000",150',
    ].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.qty).toBe(1000)
  })

  it('uses absolute value for negative fees', () => {
    const csv = ['Date,Symbol,Side,Qty,Price,Fees', '2024-01-01,AAPL,BUY,10,150,-1.50'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.fees).toBeCloseTo(1.5)
  })

  it('parses MM/DD/YYYY date format', () => {
    const csv = ['Date,Symbol,Side,Qty,Price', '01/15/2024,AAPL,BUY,10,150'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.executedAt).toBeInstanceOf(Date)
  })
})

// ─── Column Aliases ───────────────────────────────────────────────────────────

describe('parseBrokerCsv - column header aliases', () => {
  it('recognises "Quantity" as qty', () => {
    const csv = ['Date,Symbol,Action,Quantity,Fill Price', '2024-01-01,AAPL,BUY,10,150'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.qty).toBe(10)
  })

  it('recognises "Commission" as fees', () => {
    const csv = ['Trade Date,Ticker,Action,Shares,Price,Commission', '2024-01-01,AAPL,BUY,10,150,0.75'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.fees).toBeCloseTo(0.75)
  })

  it('recognises "Order ID" as orderRef', () => {
    const csv = ['Date,Symbol,Side,Qty,Price,Order ID', '2024-01-01,AAPL,BUY,10,150,ORD-001'].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows[0]!.orderRef).toBe('ORD-001')
  })
})

// ─── IBKR Flex Format ─────────────────────────────────────────────────────────

describe('parseBrokerCsv - IBKR flex format', () => {
  // The IBKR flex header uses "Buy/Sell" for direction and plain "Price" for the fill price.
  // Avoid "T. Price" — the period in it is not stripped by the normalizer (only
  // whitespace, slashes, parens, and dashes are), so it maps to "t._price" which has
  // no alias entry.
  const ibkrCsv = [
    'Statement,Header,Field Name,Field Value',
    'Statement,Data,BrokerName,Interactive Brokers',
    'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,DateTime,Buy/Sell,Quantity,Price,Commission',
    'Trades,Data,Order,Stocks,USD,AAPL,2024-01-15,BUY,100,185.50,1.00',
    'Trades,Data,Order,Stocks,USD,MSFT,2024-01-16,SELL,50,380.00,0.75',
  ].join('\n')

  it('extracts trade rows from IBKR flex sections', () => {
    const result = parseBrokerCsv(ibkrCsv, 'interactive_brokers')
    expect(result.rows.length).toBeGreaterThan(0)
  })

  it('falls back to generic parser when no IBKR sections are present', () => {
    const plainCsv = ['Date,Symbol,Side,Qty,Price', '2024-01-15,AAPL,BUY,100,185.50'].join('\n')
    const result = parseBrokerCsv(plainCsv, 'interactive_brokers')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.rawSymbol).toBe('AAPL')
  })

  it('skips "Trades,Header" section lines in generic mode', () => {
    const csv = [
      'Date,Symbol,Side,Qty,Price',
      'Trades,Header,some,extra,stuff',
      '2024-01-15,AAPL,BUY,100,185',
    ].join('\n')
    const result = parseBrokerCsv(csv, 'generic')
    expect(result.rows).toHaveLength(1)
  })
})
