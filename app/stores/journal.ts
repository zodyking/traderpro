import { defineStore } from 'pinia'

import type { PlanVsExecutionExecution } from '#shared/schemas/broker'

export type JournalPlanned = {
  entry?: number
  stop?: number
  target?: number
  size?: number
  thesis?: string
}

export type JournalActual = {
  entry?: number
  exit?: number
  size?: number
}

export type JournalEntry = {
  id: string
  userId: string
  symbolId?: string | null
  symbolTicker?: string | null
  strategyVersionId?: string | null
  executionIds: string[]
  linkedExecutions?: PlanVsExecutionExecution[]
  side?: 'long' | 'short' | null
  setupTag?: string | null
  planned: JournalPlanned
  actual: JournalActual
  emotion?: string | null
  mistakes: string[]
  note?: string | null
  screenshots: string[]
  openedAt?: string | null
  closedAt?: string | null
  createdAt: string
}

export type JournalCoachingMode = 'trade' | 'risk' | 'assistant'

export type AIReview = {
  id: string
  status: string
  createdAt: string
  reviewType?: string | null
  result?: {
    observations?: string[]
    risks?: string[]
    strengths?: string[]
    actions?: string[]
  } | null
}

type CreateInput = Omit<JournalEntry, 'id' | 'userId' | 'createdAt' | 'planned' | 'actual' | 'mistakes' | 'screenshots' | 'executionIds' | 'linkedExecutions'> & {
  planned?: JournalPlanned
  actual?: JournalActual
  mistakes?: string[]
  screenshots?: string[]
  executionIds?: string[]
}

type UpdateInput = Partial<CreateInput>

export const useJournalStore = defineStore('journal', () => {
  const entries = ref<JournalEntry[]>([])
  const total = ref(0)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<string | null>(null)

  const reviewsByEntryId = ref<Record<string, AIReview[]>>({})
  const reviewLoading = ref<Record<string, boolean>>({})

  function normalizeEntry(raw: Record<string, unknown>): JournalEntry {
    return {
      id: String(raw.id),
      userId: String(raw.userId),
      symbolId: raw.symbolId != null ? String(raw.symbolId) : null,
      symbolTicker: raw.symbolTicker != null ? String(raw.symbolTicker) : null,
      strategyVersionId: raw.strategyVersionId != null ? String(raw.strategyVersionId) : null,
      executionIds: Array.isArray(raw.executionIds) ? raw.executionIds as string[] : [],
      linkedExecutions: Array.isArray(raw.linkedExecutions)
        ? raw.linkedExecutions as PlanVsExecutionExecution[]
        : [],
      side: (raw.side as 'long' | 'short' | null) ?? null,
      setupTag: raw.setupTag != null ? String(raw.setupTag) : null,
      planned: (raw.planned as JournalPlanned) ?? {},
      actual: (raw.actual as JournalActual) ?? {},
      emotion: raw.emotion != null ? String(raw.emotion) : null,
      mistakes: Array.isArray(raw.mistakes) ? raw.mistakes as string[] : [],
      note: raw.note != null ? String(raw.note) : null,
      screenshots: Array.isArray(raw.screenshots) ? raw.screenshots as string[] : [],
      openedAt: raw.openedAt != null
        ? (raw.openedAt instanceof Date ? raw.openedAt.toISOString() : String(raw.openedAt))
        : null,
      closedAt: raw.closedAt != null
        ? (raw.closedAt instanceof Date ? raw.closedAt.toISOString() : String(raw.closedAt))
        : null,
      createdAt: raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt),
    }
  }

  async function fetchEntries(opts: { symbolId?: string; setupTag?: string; reset?: boolean } = {}) {
    if (opts.reset) {
      entries.value = []
      nextCursor.value = null
    }

    loading.value = true
    error.value = null

    try {
      const query: Record<string, string> = {}
      if (opts.symbolId) query.symbolId = opts.symbolId
      if (opts.setupTag) query.setupTag = opts.setupTag
      if (nextCursor.value && !opts.reset) query.cursor = nextCursor.value

      const data = await $fetch<{ entries: Record<string, unknown>[]; nextCursor: string | null }>(
        '/api/journal',
        { query },
      )

      const normalized = data.entries.map(normalizeEntry)
      if (opts.reset) {
        entries.value = normalized
      }
      else {
        entries.value.push(...normalized)
      }
      nextCursor.value = data.nextCursor
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load journal entries'
    }
    finally {
      loading.value = false
    }
  }

  async function createEntry(input: CreateInput): Promise<JournalEntry> {
    submitting.value = true
    error.value = null
    try {
      const raw = await $fetch<Record<string, unknown>>('/api/journal', {
        method: 'POST',
        body: input,
      })
      const entry = normalizeEntry(raw)
      entries.value.unshift(entry)
      return entry
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to create journal entry'
      throw err
    }
    finally {
      submitting.value = false
    }
  }

  async function updateEntry(id: string, input: UpdateInput): Promise<JournalEntry> {
    submitting.value = true
    error.value = null
    try {
      const raw = await $fetch<Record<string, unknown>>(`/api/journal/${id}`, {
        method: 'PATCH',
        body: input,
      })
      const updated = normalizeEntry(raw)
      const idx = entries.value.findIndex(e => e.id === id)
      if (idx >= 0) entries.value[idx] = updated
      return updated
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to update journal entry'
      throw err
    }
    finally {
      submitting.value = false
    }
  }

  async function deleteEntry(id: string) {
    submitting.value = true
    error.value = null
    try {
      await $fetch(`/api/journal/${id}`, { method: 'DELETE' })
      entries.value = entries.value.filter(e => e.id !== id)
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to delete journal entry'
      throw err
    }
    finally {
      submitting.value = false
    }
  }

  async function requestReview(entryId: string, mode: JournalCoachingMode = 'trade') {
    reviewLoading.value[entryId] = true
    try {
      let raw: Record<string, unknown>

      if (mode === 'trade') {
        raw = await $fetch<Record<string, unknown>>('/api/ai/review/trade', {
          method: 'POST',
          body: { targetId: entryId },
        })
      }
      else if (mode === 'risk') {
        raw = await $fetch<Record<string, unknown>>('/api/ai/review/risk', {
          method: 'POST',
          body: { targetId: entryId },
        })
      }
      else {
        raw = await $fetch<Record<string, unknown>>('/api/ai/reviews', {
          method: 'POST',
          body: { targetType: 'trade', targetId: entryId, reviewType: 'assistant' },
        })
      }

      const review: AIReview = {
        id: String(raw.id),
        status: String(raw.status),
        createdAt: raw.createdAt != null ? String(raw.createdAt) : new Date().toISOString(),
        reviewType: mode === 'assistant' ? 'assistant' : mode,
        result: raw.result as AIReview['result'] ?? null,
      }
      if (!reviewsByEntryId.value[entryId]) {
        reviewsByEntryId.value[entryId] = []
      }
      reviewsByEntryId.value[entryId].unshift(review)
      return review
    }
    finally {
      reviewLoading.value[entryId] = false
    }
  }

  async function fetchReviews(entryId: string) {
    reviewLoading.value[entryId] = true
    try {
      const data = await $fetch<{ reviews: Record<string, unknown>[] }>('/api/ai/reviews', {
        query: { targetId: entryId },
      })
      reviewsByEntryId.value[entryId] = data.reviews.map(raw => ({
        id: String(raw.id),
        status: String(raw.status),
        createdAt: String(raw.createdAt),
        reviewType: raw.reviewType != null ? String(raw.reviewType) : String(raw.targetType ?? 'trade'),
        result: raw.result as AIReview['result'] ?? null,
      }))
    }
    finally {
      reviewLoading.value[entryId] = false
    }
  }

  async function uploadScreenshot(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const data = await $fetch<{ url: string }>('/api/journal/upload', {
      method: 'POST',
      body: form,
    })
    return data.url
  }

  return {
    entries,
    total,
    loading,
    submitting,
    error,
    nextCursor,
    reviewsByEntryId,
    reviewLoading,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    requestReview,
    fetchReviews,
    uploadScreenshot,
  }
})
