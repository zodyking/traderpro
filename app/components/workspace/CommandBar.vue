<script setup lang="ts">
const connection = useLiveChannel()
const palette = useCommandPalette()
const providerStatus = ref<'healthy' | 'delayed' | 'gapped' | 'untrusted' | 'unavailable'>('healthy')
const providerMessage = ref<string>()
const symbolSearchRef = ref<{ focus: () => void } | null>(null)

const aiCredits = ref<{ used: number; limit: number } | null>(null)

onMounted(async () => {
  connection.connect()

  try {
    const data = await $fetch<{
      status: 'healthy' | 'delayed' | 'gapped' | 'untrusted' | 'unavailable'
      message?: string
    }>('/api/providers/status')
    providerStatus.value = data.status
    providerMessage.value = data.message
  }
  catch {
    providerStatus.value = 'unavailable'
    providerMessage.value = 'Provider status unavailable'
  }

  try {
    const usage = await $fetch<{
      usage: { aiCredits: { used: number; limit: number } }
    }>('/api/me/usage')
    aiCredits.value = usage.usage.aiCredits
  }
  catch {
    // non-critical
  }

  window.addEventListener('keydown', onGlobalKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKey)
})

function onGlobalKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  if (e.key === '/' && !inInput && !(e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    symbolSearchRef.value?.focus()
  }
}

const statusLabel = computed(() => {
  switch (connection.status.value) {
    case 'connected':
      return 'Live'
    case 'reconnecting':
      return 'Reconnecting'
    case 'disconnected':
      return 'Offline'
    default:
      return 'Unknown'
  }
})

const statusVariant = computed(() => {
  switch (connection.status.value) {
    case 'connected':
      return 'bull' as const
    case 'reconnecting':
      return 'warn' as const
    case 'disconnected':
      return 'bear' as const
    default:
      return 'default' as const
  }
})

const aiCreditsRemaining = computed(() => {
  if (!aiCredits.value) return null
  return aiCredits.value.limit - aiCredits.value.used
})

const aiCreditsBadgeVariant = computed(() => {
  if (aiCreditsRemaining.value === null) return 'default' as const
  const pct = aiCreditsRemaining.value / (aiCredits.value?.limit || 1)
  if (pct <= 0.1) return 'bear' as const
  if (pct <= 0.3) return 'warn' as const
  return 'default' as const
})

function onSymbolSelect(symbol: { id: string }) {
  const workspace = useWorkspaceStore()
  workspace.selectSymbol(symbol.id)
  navigateTo('/app/chart')
}
</script>


<template>
  <header
    class="fixed top-0 right-0 left-0 z-30 flex h-command-bar items-center gap-4 border-b border-border-hair bg-bg-surface px-4 md:left-rail"
  >
    <div class="flex shrink-0 items-center gap-3">
      <span class="font-mono text-sm font-bold tracking-[0.2em] text-text-primary">
        AXIOMEDGE
      </span>
    </div>

    <div class="flex flex-1 items-center justify-center px-4">
      <WorkspaceSymbolSearch ref="symbolSearchRef" @select="onSymbolSelect" />
    </div>

    <div class="flex shrink-0 items-center gap-3">
      <WorkspaceProviderBadge
        name="TradingView"
        :state="providerStatus"
        :title="providerMessage"
      />
      <UiBadge :label="statusLabel" :variant="statusVariant" />

      <NuxtLink
        v-if="aiCreditsRemaining !== null"
        to="/app/settings"
        class="hidden items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors sm:flex"
        :class="
          aiCreditsBadgeVariant === 'bear'
            ? 'border-bear/40 bg-bear/10 text-bear'
            : aiCreditsBadgeVariant === 'warn'
              ? 'border-warn/40 bg-warn/10 text-warn'
              : 'border-border-hair text-text-muted hover:bg-bg-raised hover:text-text-secondary'
        "
        title="AI credits remaining — click to view usage"
      >
        <svg class="size-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z" />
        </svg>
        {{ aiCreditsRemaining }} AI cr
      </NuxtLink>

      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-md border border-border-hair px-2.5 text-xs text-text-secondary transition-colors hover:bg-bg-raised hover:text-text-primary"
        aria-label="Open command palette"
        title="Command palette (⌘K)"
        @click="palette.toggle()"
      >
        <svg class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4" />
          <path d="M11 11l3 3" stroke-linecap="round" />
        </svg>
        <span class="hidden sm:inline">Search</span>
        <kbd class="ml-1 hidden rounded border border-border-hair px-1 font-mono text-2xs text-text-muted lg:inline">⌘K</kbd>
      </button>

      <button
        type="button"
        class="flex h-8 items-center gap-2 rounded-md border border-border-hair px-2.5 text-xs text-text-secondary transition-colors hover:bg-bg-raised hover:text-text-primary"
        aria-label="Account menu"
      >
        <span class="flex size-6 items-center justify-center rounded-full bg-indigo/20 font-mono text-2xs text-indigo">
          U
        </span>
        <span class="hidden sm:inline">Account</span>
        <svg class="size-3 text-text-muted" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
    </div>
  </header>
</template>
