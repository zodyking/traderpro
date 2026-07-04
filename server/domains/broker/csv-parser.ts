export type ParsedExecution = {
  rawSymbol: string
  side: 'buy' | 'sell'
  qty: number
  price: number
  fees: number
  executedAt: Date
  orderRef?: string
  sourcePayload: Record<string, unknown>
}

type ParseResult = {
  rows: ParsedExecution[]
  errors: Array<{ line: number, message: string }>
}

function normalizeSide(raw: string): 'buy' | 'sell' | null {
  const s = raw.trim().toLowerCase()
  if (s === 'buy' || s === 'b' || s === 'bot' || s === 'bought') return 'buy'
  if (s === 'sell' || s === 's' || s === 'sld' || s === 'sold') return 'sell'
  return null
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$, ]/g, '').trim()
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseDate(raw: string): Date | null {
  const trimmed = raw.trim()
  // ISO or YYYY-MM-DD
  const d = new Date(trimmed)
  if (!Number.isNaN(d.getTime())) return d
  // MM/DD/YYYY or MM/DD/YY
  const parts = trimmed.split('/')
  if (parts.length === 3) {
    const [m, day, yr] = parts
    const year = yr!.length === 2 ? `20${yr}` : yr
    const d2 = new Date(`${year}-${m!.padStart(2, '0')}-${day!.padStart(2, '0')}`)
    if (!Number.isNaN(d2.getTime())) return d2
  }
  return null
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    }
    else if (ch === ',' && !inQuotes) {
      fields.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    }
    else {
      current += ch
    }
  }
  fields.push(current.trim().replace(/^"|"$/g, ''))
  return fields
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.map(h =>
    h.trim()
      .replace(/^"|"$/g, '')
      .toLowerCase()
      .replace(/[\s/()-]+/g, '_')
      .replace(/_+$/g, ''),
  )
}

// Map normalized header names to canonical field names
const FIELD_ALIASES: Record<string, string> = {
  date: 'date',
  trade_date: 'date',
  transaction_date: 'date',
  datetime: 'date',
  exec_time: 'date',
  execution_time: 'date',
  time: 'date',
  date_time: 'date',

  symbol: 'symbol',
  ticker: 'symbol',
  instrument: 'symbol',
  financial_instrument: 'symbol',
  description: 'symbol',
  underlying: 'symbol',

  side: 'side',
  action: 'side',
  buy_sell: 'side',
  transaction_type: 'side',
  type: 'side',

  qty: 'qty',
  quantity: 'qty',
  shares: 'qty',
  amount: 'qty',
  executed_quantity: 'qty',
  fill_qty: 'qty',

  price: 'price',
  fill_price: 'price',
  exec_price: 'price',
  execution_price: 'price',
  trade_price: 'price',
  avg_price: 'price',
  t_price: 'price',

  fees: 'fees',
  commission: 'fees',
  commissions: 'fees',
  fee: 'fees',
  commission_fee: 'fees',
  total_fees: 'fees',

  order_ref: 'order_ref',
  order_id: 'order_ref',
  trade_id: 'order_ref',
  execution_id: 'order_ref',
  ibkr_order_id: 'order_ref',
  order_reference: 'order_ref',
}

function parseGenericCsv(lines: string[], broker: string): ParseResult {
  const rows: ParsedExecution[] = []
  const errors: Array<{ line: number, message: string }> = []

  // Find the header line - skip comment/metadata lines (IB uses them heavily)
  let headerIdx = -1
  let normalizedHeaders: string[] = []

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i]!.trim()
    if (!line || line.startsWith('#')) continue
    const raw = splitCsvLine(line)
    const normalized = normalizeHeaders(raw)
    // Check if this looks like a header row by seeing if we can map symbol + side + qty + price
    const fieldSet = new Set(normalized.map(h => FIELD_ALIASES[h]).filter(Boolean))
    if (fieldSet.has('symbol') && fieldSet.has('side') && fieldSet.has('qty') && fieldSet.has('price')) {
      headerIdx = i
      normalizedHeaders = normalized
      break
    }
  }

  if (headerIdx === -1) {
    errors.push({ line: 0, message: 'Could not find a valid header row with Symbol, Side, Qty, Price columns.' })
    return { rows, errors }
  }

  // Build column index map
  const colMap: Record<string, number> = {}
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const canonical = FIELD_ALIASES[normalizedHeaders[i]!]
    if (canonical && !(canonical in colMap)) {
      colMap[canonical] = i
    }
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue
    // IB wraps sections in commas-only lines or lines starting with headers
    if (line.startsWith('Trades,Header')) continue
    // Skip subtotal / summary lines
    if (/subtotal|total|summary/i.test(line.split(',')[0] ?? '')) continue

    const fields = splitCsvLine(line)

    const rawSymbol = (colMap.symbol !== undefined ? fields[colMap.symbol] : undefined)?.trim()
    if (!rawSymbol) continue

    const rawSide = (colMap.side !== undefined ? fields[colMap.side] : undefined)?.trim() ?? ''
    const side = normalizeSide(rawSide)
    if (!side) {
      errors.push({ line: i + 1, message: `Unknown side value "${rawSide}"` })
      continue
    }

    const rawQty = (colMap.qty !== undefined ? fields[colMap.qty] : undefined) ?? ''
    const qty = parseNumber(rawQty)
    if (qty === null || qty <= 0) {
      errors.push({ line: i + 1, message: `Invalid quantity "${rawQty}"` })
      continue
    }

    const rawPrice = (colMap.price !== undefined ? fields[colMap.price] : undefined) ?? ''
    const price = parseNumber(rawPrice)
    if (price === null || price < 0) {
      errors.push({ line: i + 1, message: `Invalid price "${rawPrice}"` })
      continue
    }

    const rawFees = (colMap.fees !== undefined ? fields[colMap.fees] : undefined) ?? '0'
    const fees = parseNumber(rawFees) ?? 0

    const rawDate = (colMap.date !== undefined ? fields[colMap.date] : undefined) ?? ''
    const executedAt = parseDate(rawDate)
    if (!executedAt) {
      errors.push({ line: i + 1, message: `Invalid date "${rawDate}"` })
      continue
    }

    const orderRef = (colMap.order_ref !== undefined ? fields[colMap.order_ref] : undefined)?.trim() || undefined

    const sourcePayload: Record<string, unknown> = { broker }
    for (let k = 0; k < normalizedHeaders.length; k++) {
      const h = normalizedHeaders[k]
      if (h) sourcePayload[h] = fields[k]
    }

    rows.push({
      rawSymbol,
      side,
      qty: Math.abs(qty),
      price,
      fees: Math.abs(fees),
      executedAt,
      orderRef,
      sourcePayload,
    })
  }

  return { rows, errors }
}

/**
 * Interactive Brokers flex-query / activity-statement CSV.
 * IB wraps relevant trade rows inside sections like:
 *   Trades,Header,DataDiscriminator,Asset Category,Currency,...
 *   Trades,Data,Order,Stocks,USD,...
 */
function parseIbkrCsv(content: string): ParseResult {
  const allLines = content.split('\n')
  const tradeLines: string[] = []
  let headerLine: string | null = null

  for (const line of allLines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('Trades,Header,')) {
      headerLine = trimmed
    }
    else if (trimmed.startsWith('Trades,Data,Order,')) {
      tradeLines.push(trimmed)
    }
  }

  if (!headerLine || tradeLines.length === 0) {
    // Fallback to generic parser
    return parseGenericCsv(allLines, 'interactive_brokers')
  }

  const headers = splitCsvLine(headerLine).slice(2) // skip "Trades,Header"
  const normalized = normalizeHeaders(headers)

  return parseGenericCsv([normalized.join(','), ...tradeLines.map(l => splitCsvLine(l).slice(2).join(','))], 'interactive_brokers')
}

export function parseBrokerCsv(content: string, broker: string): ParseResult {
  const lines = content.split('\n')

  if (broker === 'interactive_brokers') {
    return parseIbkrCsv(content)
  }

  return parseGenericCsv(lines, broker)
}
