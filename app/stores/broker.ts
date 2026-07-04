import { defineStore } from 'pinia'
import type {
  BrokerConnectionRow,
  ExecutionRow,
  PerformanceSummary,
} from '#shared/schemas/broker'
import { BROKER_TYPES } from '#shared/schemas/broker'

export { BROKER_TYPES }

export type { BrokerConnectionRow, ExecutionRow, PerformanceSummary }

export const useBrokerStore = defineStore('broker', () => {
  const connections = ref<BrokerConnectionRow[]>([])
  const executions = ref<ExecutionRow[]>([])
  const performance = ref<PerformanceSummary | null>(null)

  const connectionsLoading = ref(false)
  const executionsLoading = ref(false)
  const performanceLoading = ref(false)
  const importLoading = ref(false)

  const connectionsError = ref<string | null>(null)
  const executionsError = ref<string | null>(null)
  const performanceError = ref<string | null>(null)
  const importError = ref<string | null>(null)
  const importResult = ref<{ inserted: number, skipped: number, parseErrors: Array<{ line: number, message: string }> } | null>(null)

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

  async function importCsv(payload: { broker: string, label: string, csv: string }) {
    importLoading.value = true
    importError.value = null
    importResult.value = null
    try {
      const result = await $fetch<{
        connectionId: string
        accountId: string
        inserted: number
        skipped: number
        parseErrors: Array<{ line: number, message: string }>
      }>('/api/broker/import', {
        method: 'POST',
        body: payload,
      })
      importResult.value = {
        inserted: result.inserted,
        skipped: result.skipped,
        parseErrors: result.parseErrors,
      }
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

  function selectAccount(id: string | null) {
    selectedAccountId.value = id
  }

  return {
    connections,
    executions,
    performance,
    connectionsLoading,
    executionsLoading,
    performanceLoading,
    importLoading,
    connectionsError,
    executionsError,
    performanceError,
    importError,
    importResult,
    selectedAccountId,
    fetchConnections,
    fetchExecutions,
    fetchPerformance,
    importCsv,
    selectAccount,
  }
})

function extractMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'statusMessage' in e) return String((e as { statusMessage: string }).statusMessage)
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message)
  return 'An unexpected error occurred'
}
