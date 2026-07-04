<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'Home', to: '/app', icon: 'home' },
  { label: 'Chart', to: '/app/chart', icon: 'chart' },
  { label: 'Strategy', to: '/app/strategy', icon: 'strategy' },
  { label: 'Backtest', to: '/app/backtest', icon: 'backtest' },
  { label: 'Journal', to: '/app/journal', icon: 'journal' },
  { label: 'Settings', to: '/app/settings', icon: 'settings' },
] as const

function isActive(to: string) {
  if (to === '/app') return route.path === '/app' || route.path === '/app/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav
    class="fixed top-0 left-0 z-40 flex h-full w-rail flex-col items-center border-r border-border-hair bg-bg-surface py-3"
    aria-label="Main navigation"
  >
    <div class="mb-6 flex size-9 items-center justify-center rounded-md bg-accent/10">
      <span class="font-mono text-xs font-bold text-accent">AE</span>
    </div>

    <ul class="flex flex-1 flex-col items-center gap-1">
      <li v-for="item in navItems" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="group relative flex size-10 items-center justify-center rounded-md transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-bg-raised text-accent'
              : 'text-text-muted hover:bg-bg-raised hover:text-text-secondary'
          "
          :aria-label="item.label"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <svg
            class="size-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <template v-if="item.icon === 'home'">
              <path d="M3 10.5L10 4l7 6.5V16a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1v-5.5z" />
            </template>
            <template v-else-if="item.icon === 'chart'">
              <path d="M3 16V8m4 8V4m4 12V10m4 6V6" stroke-linecap="round" />
            </template>
            <template v-else-if="item.icon === 'strategy'">
              <path d="M4 6h12M4 10h8M4 14h10" stroke-linecap="round" />
              <circle cx="16" cy="14" r="2" fill="currentColor" stroke="none" />
            </template>
            <template v-else-if="item.icon === 'backtest'">
              <path d="M4 4v12h12" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 13l3-3 2 2 4-5" stroke-linecap="round" stroke-linejoin="round" />
            </template>
            <template v-else-if="item.icon === 'journal'">
              <rect x="4" y="3" width="12" height="14" rx="1" />
              <path d="M7 7h6M7 10h6M7 13h4" stroke-linecap="round" />
            </template>
            <template v-else-if="item.icon === 'settings'">
              <circle cx="10" cy="10" r="2.5" />
              <path
                d="M10 2.5v1.5M10 16v1.5M2.5 10h1.5M16 10h1.5M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1"
                stroke-linecap="round"
              />
            </template>
          </svg>
          <span
            class="pointer-events-none absolute left-full ml-2 hidden rounded border border-border-strong bg-bg-overlay px-2 py-1 text-xs whitespace-nowrap text-text-primary group-hover:block"
          >
            {{ item.label }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
