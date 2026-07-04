<script setup lang="ts">
const props = defineProps<{
  rawSymbols: string[]
}>()

const emit = defineEmits<{
  done: []
  skip: []
}>()

const store = useBrokerStore()

type Mapping = {
  rawSymbol: string
  symbolId: string | null
  ticker: string | null
  query: string
  results: Array<{ id: string; ticker: string; label: string }>
  searching: boolean
}

const mappings = ref<Mapping[]>(
  props.rawSymbols.map(s => ({
    rawSymbol: s,
    symbolId: null,
    ticker: null,
    query: s,
    results: [],
    searching: false,
  })),
)

  const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function onQueryInput(index: number) {
  const m = mappings.value[index]!
  clearTimeout(debounceTimers[index])
  debounceTimers[index] = setTimeout(() => searchSymbol(index, m.query), 250)
}

async function searchSymbol(index: number, q: string) {
  const m = mappings.value[index]!
  if (!q.trim()) {
    m.results = []
    return
  }
  m.searching = true
  try {
    const data = await $fetch<{ results: Array<{ id: string; ticker: string; label: string }> }>(
      '/api/symbols/search',
      { query: { q: q.trim() } },
    )
    m.results = data.results
  }
  catch {
    m.results = []
  }
  finally {
    m.searching = false
  }
}

function pick(index: number, symbol: { id: string; ticker: string; label: string }) {
  const m = mappings.value[index]!
  m.symbolId = symbol.id
  m.ticker = symbol.ticker
  m.query = symbol.ticker
  m.results = []
}

function clear(index: number) {
  const m = mappings.value[index]!
  m.symbolId = null
  m.ticker = null
}

const saving = ref(false)
const saveError = ref<string | null>(null)

const hasMappings = computed(() => mappings.value.some(m => m.symbolId !== null))

async function save() {
  const mapped = mappings.value.filter(m => m.symbolId !== null)
  if (!mapped.length) return
  saving.value = true
  saveError.value = null
  try {
    await store.mapSymbols(
      mapped.map(m => ({ rawSymbol: m.rawSymbol, symbolId: m.symbolId! })),
    )
    emit('done')
  }
  catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save mappings'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm">
    <div class="mx-4 w-full max-w-lg rounded-xl border border-border-strong bg-bg-surface shadow-2xl">
      <div class="flex items-center justify-between border-b border-border-hair px-5 py-4">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">
            Map Unresolved Symbols
          </h2>
          <p class="mt-0.5 text-xs text-text-muted">
            {{ rawSymbols.length }} symbol{{ rawSymbols.length === 1 ? '' : 's' }} could not be matched automatically.
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-raised hover:text-text-secondary"
          aria-label="Close"
          @click="emit('skip')"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 3l10 10M13 3L3 13" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="max-h-[55vh] overflow-y-auto px-5 py-4">
        <ul class="flex flex-col gap-4">
          <li
            v-for="(m, i) in mappings"
            :key="m.rawSymbol"
          >
            <div class="mb-1.5 flex items-center gap-2">
              <span class="font-mono text-xs font-semibold text-text-primary">{{ m.rawSymbol }}</span>
              <svg class="size-3.5 shrink-0 text-text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span
                v-if="m.ticker"
                class="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-2xs font-medium text-accent"
              >
                {{ m.ticker }}
              </span>
            </div>

            <div class="relative">
              <input
                v-model="m.query"
                type="text"
                class="h-8 w-full rounded-md border border-border-strong bg-bg-raised px-3 text-xs text-text-primary outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent/40"
                :placeholder="`Search symbol for ${m.rawSymbol}…`"
                @input="onQueryInput(i)"
                @focus="searchSymbol(i, m.query)"
              >
              <div
                v-if="m.searching"
                class="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <span class="block size-3 animate-spin rounded-full border-2 border-border-hair border-t-accent" />
              </div>
            </div>

            <ul
              v-if="m.results.length"
              class="mt-1 rounded-md border border-border-hair bg-bg-base shadow-md"
            >
              <li
                v-for="res in m.results.slice(0, 6)"
                :key="res.id"
                class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-bg-raised"
                @click="pick(i, res)"
              >
                <span class="font-mono font-semibold text-text-primary">{{ res.ticker }}</span>
                <span class="truncate text-text-muted">{{ res.label }}</span>
              </li>
            </ul>

            <button
              v-if="m.symbolId"
              type="button"
              class="mt-1 text-2xs text-text-muted hover:text-bear"
              @click="clear(i)"
            >
              Clear selection
            </button>
          </li>
        </ul>
      </div>

      <p
        v-if="saveError"
        class="px-5 pb-2 text-xs text-bear"
      >
        {{ saveError }}
      </p>

      <div class="flex items-center justify-end gap-2 border-t border-border-hair px-5 py-3">
        <UiBtn
          variant="ghost"
          size="sm"
          @click="emit('skip')"
        >
          Skip
        </UiBtn>
        <UiBtn
          variant="primary"
          size="sm"
          :loading="saving"
          :disabled="!hasMappings"
          @click="save"
        >
          Save Mappings
        </UiBtn>
      </div>
    </div>
  </div>
</template>
