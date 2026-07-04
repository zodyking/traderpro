<script setup lang="ts">
const emit = defineEmits<{
  select: [symbol: {
    id: string
    ticker: string
    exchange: string
    label: string
    description?: string
  }]
}>()

const query = ref('')
const loading = ref(false)
const results = ref<Array<{
  id: string
  ticker: string
  exchange: string
  label: string
  description?: string
}>>([])
const open = ref(false)

const workspace = useWorkspaceStore()

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(query, (value) => {
  clearTimeout(debounceTimer)
  if (!value.trim()) {
    results.value = []
    open.value = false
    return
  }

  debounceTimer = setTimeout(async () => {
    loading.value = true
    try {
      const data = await $fetch<{ results: typeof results.value }>('/api/symbols/search', {
        query: { q: value.trim() },
      })
      results.value = data.results
      open.value = data.results.length > 0
    }
    catch {
      results.value = []
      open.value = false
    }
    finally {
      loading.value = false
    }
  }, 250)
})

async function pick(symbol: (typeof results.value)[number]) {
  emit('select', symbol)
  await workspace.addSymbolToDefaultWatchlist(symbol.id)
  workspace.selectSymbol(symbol.id)
  query.value = symbol.ticker
  open.value = false
}

function onFocus() {
  if (results.value.length) open.value = true
}
</script>

<template>
  <div class="relative w-full max-w-md">
    <svg
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" stroke-linecap="round" />
    </svg>

    <input
      v-model="query"
      type="search"
      placeholder="Search symbols…"
      class="h-8 w-full rounded-md border border-border-hair bg-bg-raised pr-20 pl-9 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
      aria-label="Symbol search"
      autocomplete="off"
      @focus="onFocus"
    >

    <kbd
      class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border-strong bg-bg-overlay px-1.5 py-0.5 font-mono text-2xs text-text-muted"
    >
      /
    </kbd>

    <div
      v-if="open"
      class="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border-strong bg-bg-overlay shadow-lg"
    >
      <button
        v-for="symbol in results"
        :key="symbol.id"
        type="button"
        class="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-bg-raised"
        @mousedown.prevent="pick(symbol)"
      >
        <span class="font-mono text-sm text-text-primary">{{ symbol.ticker }}</span>
        <span class="text-xs text-text-muted">{{ symbol.exchange }}</span>
        <span
          v-if="symbol.description"
          class="ml-auto truncate text-xs text-text-secondary"
        >
          {{ symbol.description }}
        </span>
      </button>
      <p
        v-if="loading"
        class="px-3 py-2 text-xs text-text-muted"
      >
        Searching…
      </p>
      <p
        v-else-if="!results.length"
        class="px-3 py-2 text-xs text-text-muted"
      >
        No symbols found.
      </p>
    </div>
  </div>
</template>
