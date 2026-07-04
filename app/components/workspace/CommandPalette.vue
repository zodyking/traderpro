<script setup lang="ts">
type NavItem = { kind: 'nav'; label: string; description: string; to: string; key: string }
type ActionItem = { kind: 'action'; label: string; description: string; key: string; action: () => void }
type SymbolItem = { kind: 'symbol'; id: string; label: string; description: string; key: string }
type PaletteItem = NavItem | ActionItem | SymbolItem

const palette = useCommandPalette()
const router = useRouter()
const workspace = useWorkspaceStore()

const query = ref('')
const activeIndex = ref(0)
const searchPending = ref(false)
const symbolResults = ref<SymbolItem[]>([])
let searchTimeout: ReturnType<typeof setTimeout> | undefined

const navItems: NavItem[] = [
  { kind: 'nav', key: 'nav-home', label: 'Home', description: 'Command Center overview', to: '/app' },
  { kind: 'nav', key: 'nav-chart', label: 'Chart', description: 'Live price chart workspace', to: '/app/chart' },
  { kind: 'nav', key: 'nav-strategy', label: 'Strategy Lab', description: 'Build and version rule-based strategies', to: '/app/strategy' },
  { kind: 'nav', key: 'nav-backtest', label: 'Backtest', description: 'Run and review backtest reports', to: '/app/backtest' },
  { kind: 'nav', key: 'nav-journal', label: 'Journal', description: 'Trade journal and AI review', to: '/app/journal' },
  { kind: 'nav', key: 'nav-learning', label: 'Learning Path', description: 'Skill ladder and lessons', to: '/app/learning' },
  { kind: 'nav', key: 'nav-settings', label: 'Settings', description: 'Account and workspace settings', to: '/app/settings' },
]

const actionItems: ActionItem[] = [
  {
    kind: 'action',
    key: 'action-backtest',
    label: 'Run Backtest',
    description: 'Open Strategy Lab and run a backtest',
    action: () => { router.push('/app/strategy'); palette.hide() },
  },
  {
    kind: 'action',
    key: 'action-journal',
    label: 'New Journal Entry',
    description: 'Add a new trade journal entry',
    action: () => { router.push('/app/journal?new=1'); palette.hide() },
  },
  {
    kind: 'action',
    key: 'action-alerts',
    label: 'Scan Alerts',
    description: 'Run alert scan against current watchlist',
    action: async () => {
      palette.hide()
      try {
        await $fetch('/api/alerts/scan', { method: 'POST', body: {} })
      }
      catch { /* scan errors are non-critical */ }
      router.push('/app/chart')
    },
  },
]

function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h.includes(n)) return 2
  let hi = 0
  let ni = 0
  while (hi < h.length && ni < n.length) {
    if (h[hi] === n[ni]) ni++
    hi++
  }
  return ni === n.length ? 1 : 0
}

function filterItems<T extends { label: string; description: string }>(
  items: T[],
  q: string,
): T[] {
  if (!q) return items
  return items
    .map((item) => ({ item, score: fuzzyScore(item.label + ' ' + item.description, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}

const filteredNav = computed(() => filterItems(navItems, query.value))
const filteredActions = computed(() => filterItems(actionItems, query.value))

const groups = computed(() => {
  const result: Array<{ title: string; items: PaletteItem[] }> = []
  if (filteredNav.value.length) {
    result.push({ title: 'Navigation', items: filteredNav.value })
  }
  if (filteredActions.value.length) {
    result.push({ title: 'Actions', items: filteredActions.value })
  }
  if (symbolResults.value.length) {
    result.push({ title: 'Symbols', items: symbolResults.value })
  }
  return result
})

const flatItems = computed<PaletteItem[]>(() => groups.value.flatMap((g) => g.items))

watch(query, (q) => {
  activeIndex.value = 0
  clearTimeout(searchTimeout)

  if (q.length < 2) {
    symbolResults.value = []
    return
  }

  searchPending.value = true
  searchTimeout = setTimeout(async () => {
    try {
      const data = await $fetch<{
        results: Array<{ id: string; ticker: string; exchange: string; label: string; description?: string }>
      }>('/api/symbols/search', { query: { q } })

      symbolResults.value = data.results.slice(0, 6).map((s) => ({
        kind: 'symbol' as const,
        id: s.id,
        key: `symbol-${s.id}`,
        label: s.ticker,
        description: `${s.exchange} · ${s.label}`,
      }))
    }
    catch {
      symbolResults.value = []
    }
    finally {
      searchPending.value = false
    }
  }, 200)
})

watch(
  () => palette.open.value,
  (open) => {
    if (open) {
      query.value = ''
      activeIndex.value = 0
      symbolResults.value = []
      nextTick(() => inputRef.value?.focus())
    }
  },
)

const inputRef = ref<HTMLInputElement>()

function activate(item: PaletteItem) {
  if (item.kind === 'nav') {
    router.push(item.to)
    palette.hide()
  }
  else if (item.kind === 'action') {
    item.action()
  }
  else if (item.kind === 'symbol') {
    workspace.selectSymbol(item.id)
    router.push('/app/chart')
    palette.hide()
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (!palette.open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    palette.hide()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, flatItems.value.length - 1)
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems.value[activeIndex.value]
    if (item) activate(item)
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

function indexOfItem(item: PaletteItem) {
  return flatItems.value.findIndex((i) => i.key === item.key)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="palette.open.value"
        class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
        @click.self="palette.hide()"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="palette.hide()" />

        <div
          class="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border-strong bg-bg-overlay shadow-2xl"
          role="dialog"
          aria-label="Command palette"
          aria-modal="true"
        >
          <div class="flex items-center gap-3 border-b border-border-hair px-4 py-3">
            <svg
              class="size-4 shrink-0 text-text-muted"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <circle cx="6.5" cy="6.5" r="4" />
              <path d="M11 11l3 3" stroke-linecap="round" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="Search pages, symbols, actions…"
              class="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              autocomplete="off"
              spellcheck="false"
            >
            <span
              v-if="searchPending"
              class="size-3.5 animate-spin rounded-full border border-text-muted border-t-transparent"
            />
            <kbd class="hidden rounded border border-border-hair px-1.5 py-0.5 font-mono text-2xs text-text-muted sm:inline">
              esc
            </kbd>
          </div>

          <div class="max-h-[min(480px,60vh)] overflow-y-auto py-2">
            <template v-if="groups.length">
              <div
                v-for="group in groups"
                :key="group.title"
                class="mb-1"
              >
                <p class="px-4 py-1.5 text-2xs font-medium tracking-wide text-text-muted uppercase">
                  {{ group.title }}
                </p>
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors"
                  :class="indexOfItem(item) === activeIndex
                    ? 'bg-accent/10 text-text-primary'
                    : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'"
                  @click="activate(item)"
                  @mousemove="activeIndex = indexOfItem(item)"
                >
                  <span
                    class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-hair bg-bg-surface text-text-muted"
                  >
                    <svg
                      v-if="item.kind === 'nav'"
                      class="size-3.5"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      aria-hidden="true"
                    >
                      <path d="M2 3h10M2 7h10M2 11h6" stroke-linecap="round" />
                    </svg>
                    <svg
                      v-else-if="item.kind === 'action'"
                      class="size-3.5"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      aria-hidden="true"
                    >
                      <path d="M7 1v12M1 7h12" stroke-linecap="round" />
                    </svg>
                    <svg
                      v-else
                      class="size-3.5"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      aria-hidden="true"
                    >
                      <rect x="1" y="3" width="12" height="8" rx="1.5" />
                      <path d="M4 7h2M7 7h3" stroke-linecap="round" />
                    </svg>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ item.label }}</span>
                    <span class="block truncate text-xs text-text-muted">{{ item.description }}</span>
                  </span>
                  <span
                    v-if="indexOfItem(item) === activeIndex"
                    class="shrink-0 text-xs text-text-muted"
                  >
                    ↵
                  </span>
                </button>
              </div>
            </template>

            <div
              v-else-if="query"
              class="px-4 py-8 text-center text-sm text-text-muted"
            >
              No results for <span class="font-medium text-text-secondary">{{ query }}</span>
            </div>

            <div
              v-else
              class="px-4 py-3 text-xs text-text-muted"
            >
              Type to search pages, symbols, or actions.
            </div>
          </div>

          <div class="flex items-center gap-4 border-t border-border-hair px-4 py-2">
            <span class="text-2xs text-text-muted">
              <kbd class="rounded border border-border-hair px-1 font-mono">↑↓</kbd>
              navigate
            </span>
            <span class="text-2xs text-text-muted">
              <kbd class="rounded border border-border-hair px-1 font-mono">↵</kbd>
              open
            </span>
            <span class="text-2xs text-text-muted">
              <kbd class="rounded border border-border-hair px-1 font-mono">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
