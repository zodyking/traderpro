import { defineStore } from 'pinia'
import type { WorkspaceLayout } from '#shared/schemas/workspace'

export type SymbolSummary = {
  id: string
  ticker: string
  exchange: string
  label: string
  description?: string
}

export type WatchlistItem = {
  id: string
  name: string
  sort: number
  symbols: Array<{ symbolId: string, sort: number }>
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const activeSymbolId = ref<string | null>(null)
  const chartInterval = ref<WorkspaceLayout['chartInterval']>('1h')
  const watchlists = ref<WatchlistItem[]>([])
  const workspaceId = ref<string | null>(null)
  const watchlistRailOpen = ref(true)

  async function loadWatchlists() {
    const data = await $fetch<{ watchlists: WatchlistItem[] }>('/api/watchlists')
    watchlists.value = data.watchlists

    if (!watchlists.value.length) {
      const created = await $fetch<{ watchlist: WatchlistItem }>('/api/watchlists', {
        method: 'POST',
        body: { name: 'Default' },
      })
      watchlists.value = [{ ...created.watchlist, symbols: [] }]
    }
  }

  async function ensureWorkspace() {
    const data = await $fetch<{ workspaces: Array<{ id: string, layout: WorkspaceLayout, isDefault: boolean }> }>(
      '/api/workspaces',
    )

    let workspace = data.workspaces.find((item) => item.isDefault) ?? data.workspaces[0]

    if (!workspace) {
      const created = await $fetch<{ workspace: { id: string, layout: WorkspaceLayout, isDefault: boolean } }>(
        '/api/workspaces',
        {
          method: 'POST',
          body: {
            name: 'Main',
            isDefault: true,
            layout: {
              chartInterval: chartInterval.value,
              watchlistRailOpen: true,
            },
          },
        },
      )
      workspace = created.workspace
    }

    if (workspace) {
      workspaceId.value = workspace.id
      activeSymbolId.value = workspace.layout?.activeSymbolId ?? activeSymbolId.value
      chartInterval.value = workspace.layout?.chartInterval ?? chartInterval.value
      watchlistRailOpen.value = workspace.layout?.watchlistRailOpen ?? true
    }
  }

  async function saveWorkspace() {
    if (!workspaceId.value) return

    await $fetch(`/api/workspaces/${workspaceId.value}`, {
      method: 'PATCH',
      body: {
        layout: {
          activeSymbolId: activeSymbolId.value ?? undefined,
          chartInterval: chartInterval.value,
          watchlistRailOpen: watchlistRailOpen.value,
        },
      },
    })
  }

  async function addSymbolToDefaultWatchlist(symbolId: string) {
    const list = watchlists.value[0]
    if (!list) return

    const symbolIds = [...new Set([...list.symbols.map((item) => item.symbolId), symbolId])]
    const data = await $fetch<{ watchlists: WatchlistItem[] }>(`/api/watchlists/${list.id}/symbols`, {
      method: 'PUT',
      body: { symbolIds },
    })
    watchlists.value = data.watchlists
  }

  function selectSymbol(symbolId: string) {
    activeSymbolId.value = symbolId
    saveWorkspace()
  }

  return {
    activeSymbolId,
    chartInterval,
    watchlists,
    workspaceId,
    watchlistRailOpen,
    loadWatchlists,
    ensureWorkspace,
    saveWorkspace,
    addSymbolToDefaultWatchlist,
    selectSymbol,
  }
})
