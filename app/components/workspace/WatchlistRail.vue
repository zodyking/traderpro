<script setup lang="ts">
const workspace = useWorkspaceStore()

const activeList = computed(() => workspace.watchlists[0])

const symbolLabels = ref<Record<string, string>>({})

async function loadSymbolLabel(symbolId: string) {
  if (symbolLabels.value[symbolId]) return
  try {
    const data = await $fetch<{ symbol: { ticker: string, exchange: string } }>(
      `/api/symbols/${symbolId}`,
    )
    symbolLabels.value[symbolId] = `${data.symbol.ticker} · ${data.symbol.exchange}`
  }
  catch {
    symbolLabels.value[symbolId] = symbolId.slice(0, 8)
  }
}

watch(
  () => activeList.value?.symbols ?? [],
  (symbols) => {
    for (const item of symbols) {
      loadSymbolLabel(item.symbolId)
    }
  },
  { immediate: true, deep: true },
)

function select(symbolId: string) {
  workspace.selectSymbol(symbolId)
  navigateTo('/app/chart')
}
</script>

<template>
  <aside
    class="flex h-full w-64 shrink-0 flex-col border-r border-border-hair bg-bg-surface"
    aria-label="Watchlist"
  >
    <div class="flex items-center justify-between border-b border-border-hair px-3 py-2">
      <h2 class="text-xs font-medium tracking-wide text-text-muted uppercase">
        {{ activeList?.name ?? 'Watchlist' }}
      </h2>
      <span class="font-mono text-2xs text-text-muted">
        {{ activeList?.symbols.length ?? 0 }}
      </span>
    </div>

    <ul class="flex-1 overflow-y-auto p-2">
      <li
        v-for="item in activeList?.symbols ?? []"
        :key="item.symbolId"
      >
        <button
          type="button"
          class="flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors"
          :class="
            workspace.activeSymbolId === item.symbolId
              ? 'bg-accent/10 text-accent'
              : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'
          "
          @click="select(item.symbolId)"
        >
          <span class="font-mono text-sm">
            {{ symbolLabels[item.symbolId] ?? '…' }}
          </span>
        </button>
      </li>
      <li
        v-if="!activeList?.symbols.length"
        class="px-2 py-4 text-xs text-text-muted"
      >
        Search a symbol to add it here.
      </li>
    </ul>
  </aside>
</template>
