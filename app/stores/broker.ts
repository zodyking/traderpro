import { defineStore } from 'pinia'
import type {
  AttributionData,
  BrokerConnectionRow,
  CalendarPnlData,
  ExecutionRow,
  PerformanceSummary,
} from '#shared/schemas/broker'
import { BROKER_TYPES } from '#shared/schemas/broker'

export { BROKER_TYPES }

export type { AttributionData, BrokerConnectionRow, CalendarPnlData, ExecutionRow, PerformanceSummary }

export const useBrokerStore = defineStore('broker', () => {
  const connections = ref<BrokerConnectionRow[]>([])
  const executions = ref<ExecutionRow[]>([])
  const performance = ref<PerformanceSummary | null>(null)
  const calendar = ref<CalendarPnlData | null>(null)
  const attribution = ref<AttributionData | null>(null)

  const connectionsLoading = ref(false)
  const executionsLoading = ref(false)
  const performanceLoading = ref(false)
  const calendarLoading = ref(false)
  const attributionLoading = ref(false)
  const importLoading = ref(false)

  const connectionsError = ref<string | null>(null)
  const executionsError = ref<string | null>(null)
  const performanceError = ref<string | null>(null)
  const calendarError = ref<string | null>(null)
  const attributionError = ref<string | null>(null)
  const importError = ref<string | null>(null)
  const importResult = ref<{ inserted: number, skipped: number, parseErrors: Array<{ line: number, message: string }> } | null>(null)
  const unresolvedSymbols = ref<string[]>([])

  const selectedAccountId = ref<string | null>(null)

  async function fetchConnections() {
    connectionsLoading.value = true
    connectionsError.value = null
    try {
      connections.value = await $fetch<BrokerConnectionRow[]>('/api/broker/connections')
    }
    catch (e: unknown) {
      connectionsError.value = extractMessage(e)
    }
    finally {
      connectionsLoading.value = false
    }
  }

  async function fetchExecutions(params: { accountId?: string, from?: string, to?: string } = {}) {
    executionsLoading.value = true
    executionsError.value = null
    try {
      executions.value = await $fetch<ExecutionRow[]>('/api/broker/executions', { query: params })
    }
    catch (e: unknown) {
      executionsError.value = extractMessage(e)
    }
    finally {
      executionsLoading.value = false
    }
  }

  async function fetchPerformance(accountId?: string) {
    performanceLoading.value = true
    performanceError.value = null
    try {
      performance.value = await $fetch<PerformanceSummary>('/api/broker/performance', {
        query: accountId ? { accountId } : {},
      })
    }
    catch (e: unknown) {
      performanceError.value = extractMessage(e)
    }
    finally {
      performanceLoading.value = false
    }
  }

  async function fetchCalendar(accountId?: string) {
    calendarLoading.value = true
    calendarError.value = null
    try {
      calendar.value = await $fetch<CalendarPnlData>('/api/broker/calendar', {
        query: accountId ? { accountId } : {},
      })
    }
    catch (e: unknown) {
      calendarError.value = extractMessage(e)
    }
    finally {
      calendarLoading.value = false
    }
  }

  async function fetchAttribution(accountId?: string) {
    attributionLoading.value = true
    attributionError.value = null
    try {
      attribution.value = await $fetch<AttributionData>('/api/broker/attribution', {
        query: accountId ? { accountId } : {},
      })
    }
    catch (e: unknown) {
      attributionError.value = extractMessage(e)
    }
    finally {
      attributionLoading.value = false
    }
  }

  async function importCsv(payload: { broker: string, label: string, csv: string }) {
    importLoading.value = true
    importError.value = null
    importResult.value = null
    unresolvedSymbols.value = []
    try {
      const result = await $fetch<{
        connectionId: string
        accountId: string
        inserted: number
        skipped: number
        parseErrors: Array<{ line: number, message: string }>
        unresolvedSymbols: string[]
      }>('/api/broker/import', {
        method: 'POST',
        body: payload,
      })
      importResult.value = {
        inserted: result.inserted,
        skipped: result.skipped,
        parseErrors: result.parseErrors,
      }
      unresolvedSymbols.value = result.unresolvedSymbols ?? []
      await fetchConnections()
      await fetchPerformance(selectedAccountId.value ?? undefined)
      await fetchExecutions(selectedAccountId.value ? { accountId: selectedAccountId.value } : {})
      return result
    }
    catch (e: unknown) {
      importError.value = extractMessage(e)
      throw e
    }
    finally {
      importLoading.value = false
    }
  }

  async function mapSymbols(mappings: Array<{ rawSymbol: string, symbolId: string }>) {
    await $fetch('/api/broker/map-symbols', { method: 'POST', body: { mappings } })
    unresolvedSymbols.value = unresolvedSymbols.value.filter(
      s => !mappings.some(m => m.rawSymbol === s),
    )
  }

  function selectAccount(id: string | null) {
    selectedAccountId.value = id
  }

  return {
    connections,
    executions,
    performance,
    calendar,
    attribution,
    connectionsLoading,
    executionsLoading,
    performanceLoading,
    calendarLoading,
    attributionLoading,
    importLoading,
    connectionsError,
    executionsError,
    performanceError,
    calendarError,
    attributionError,
    importError,
    importResult,
    unresolvedSymbols,
    selectedAccountId,
    fetchConnections,
    fetchExecutions,
    fetchPerformance,
    fetchCalendar,
    fetchAttribution,
    importCsv,
    mapSymbols,
    selectAccount,
  }
})

function extractMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'statusMessage' in e) return String((e as { statusMessage: string }).statusMessage)
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message)
  return 'An unexpected error occurred'
}

