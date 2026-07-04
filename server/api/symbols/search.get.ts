import { symbolSearchSchema } from '#shared/schemas/symbols'
import { searchSymbols } from '../../domains/market-data/service'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = symbolSearchSchema.parse(getQuery(event))
  const results = await searchSymbols(query.q, query.assetClass)

  return { results }
})
