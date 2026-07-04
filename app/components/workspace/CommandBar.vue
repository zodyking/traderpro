<script setup lang="ts">
const connection = useLiveChannel()
const providerStatus = ref<'healthy' | 'delayed' | 'gapped' | 'untrusted' | 'unavailable'>('healthy')
const providerMessage = ref<string>()

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
})

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

function onSymbolSelect(symbol: { id: string }) {
  const workspace = useWorkspaceStore()
  workspace.selectSymbol(symbol.id)
  navigateTo('/app/chart')
}
</script>

<template>
  <header
    class="fixed top-0 right-0 left-rail z-30 flex h-command-bar items-center gap-4 border-b border-border-hair bg-bg-surface px-4"
  >
    <div class="flex shrink-0 items-center gap-3">
      <span class="font-mono text-sm font-bold tracking-[0.2em] text-text-primary">
        AXIOMEDGE
      </span>
    </div>

    <div class="flex flex-1 items-center justify-center px-4">
      <WorkspaceSymbolSearch @select="onSymbolSelect" />
    </div>

    <div class="flex shrink-0 items-center gap-3">
      <WorkspaceProviderBadge
        name="TradingView"
        :state="providerStatus"
        :title="providerMessage"
      />
      <UiBadge :label="statusLabel" :variant="statusVariant" />

      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md border border-border-hair text-text-muted transition-colors hover:bg-bg-raised hover:text-text-secondary"
        aria-label="Open command palette"
      >
        <svg class="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M2 4h12v1.5H2V4zm0 3.25h12V8.75H2V7.25zm0 3.25h8V12H2v-1.5z" />
        </svg>
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
