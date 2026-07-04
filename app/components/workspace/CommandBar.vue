<script setup lang="ts">
const connectionStatus = ref<'connected' | 'reconnecting' | 'disconnected'>('connected')

const statusLabel = computed(() => {
  switch (connectionStatus.value) {
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
  switch (connectionStatus.value) {
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
          type="search"
          placeholder="Search symbols…"
          class="h-8 w-full rounded-md border border-border-hair bg-bg-raised pr-20 pl-9 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          aria-label="Symbol search"
        >
        <kbd
          class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border-strong bg-bg-overlay px-1.5 py-0.5 font-mono text-2xs text-text-muted"
        >
          ⌘K
        </kbd>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-3">
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
