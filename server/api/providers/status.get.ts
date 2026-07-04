import { getProviderStatuses } from '../../domains/market-data/service'

export default defineEventHandler(async () => {
  const providers = await getProviderStatuses()
  const primary = providers[0]

  return {
    providers,
    active: primary?.id ?? 'tradingview',
    status: primary?.status ?? 'unavailable',
    message: primary?.message,
  }
})
