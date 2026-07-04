<script setup lang="ts">
const route = useRoute()
const moreOpen = ref(false)

const primaryTabs = [
  { label: 'Home', to: '/app', icon: 'home' },
  { label: 'Chart', to: '/app/chart', icon: 'chart' },
  { label: 'Strategy', to: '/app/strategy', icon: 'strategy' },
  { label: 'Journal', to: '/app/journal', icon: 'journal' },
] as const

const moreItems = [
  { label: 'Scanner', to: '/app/scanner', icon: 'scanner' },
  { label: 'Broker', to: '/app/broker', icon: 'broker' },
  { label: 'Backtest', to: '/app/backtest', icon: 'backtest' },
  { label: 'Learning', to: '/app/learning', icon: 'learning' },
  { label: 'Settings', to: '/app/settings', icon: 'settings' },
] as const

function isActive(to: string) {
  if (to === '/app') return route.path === '/app' || route.path === '/app/'
  return route.path.startsWith(to)
}

const isMoreActive = computed(() => moreItems.some(item => isActive(item.to)))

function closeMore() {
  moreOpen.value = false
}

watch(() => route.path, () => {
  moreOpen.value = false
})
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-border-hair bg-bg-surface pb-safe md:hidden"
    aria-label="Mobile navigation"
  >
    <ul class="flex items-stretch justify-around px-1">
      <li v-for="item in primaryTabs" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 transition-colors"
          :class="
            isActive(item.to)
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
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
            <template v-else-if="item.icon === 'journal'">
              <rect x="4" y="3" width="12" height="14" rx="1" />
              <path d="M7 7h6M7 10h6M7 13h4" stroke-linecap="round" />
            </template>
          </svg>
          <span class="text-2xs font-medium">{{ item.label }}</span>
        </NuxtLink>
      </li>

      <li>
        <button
          type="button"
          class="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 transition-colors"
          :class="
            isMoreActive || moreOpen
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          "
          aria-label="More navigation"
          :aria-expanded="moreOpen"
          @click="moreOpen = true"
        >
          <svg
            class="size-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="10" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="15" cy="10" r="1.5" />
          </svg>
          <span class="text-2xs font-medium">More</span>
        </button>
      </li>
    </ul>
  </nav>

  <UiDrawer v-model:open="moreOpen" title="More">
    <ul class="flex flex-col gap-1 pb-4">
      <li v-for="item in moreItems" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="flex min-h-11 items-center gap-3 rounded-md px-3 transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-bg-raised text-accent'
              : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'
          "
          :aria-current="isActive(item.to) ? 'page' : undefined"
          @click="closeMore"
        >
          <svg
            class="size-5 shrink-0"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <template v-if="item.icon === 'backtest'">
              <path d="M4 4v12h12" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 13l3-3 2 2 4-5" stroke-linecap="round" stroke-linejoin="round" />
            </template>
            <template v-else-if="item.icon === 'scanner'">
              <circle cx="10" cy="10" r="6" />
              <path d="M10 6v4l2.5 2.5" stroke-linecap="round" />
            </template>
            <template v-else-if="item.icon === 'broker'">
              <rect x="3" y="12" width="3" height="5" rx="0.5" />
              <rect x="8.5" y="8" width="3" height="9" rx="0.5" />
              <rect x="14" y="5" width="3" height="12" rx="0.5" />
              <path d="M4.5 11l5-5 3 3 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
            </template>
            <template v-else-if="item.icon === 'learning'">
              <path d="M10 3L2 7l8 4 8-4-8-4z" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M2 7v5c2.5 2 5.5 3 8 3s5.5-1 8-3V7" stroke-linecap="round" stroke-linejoin="round" />
            </template>
            <template v-else-if="item.icon === 'settings'">
              <circle cx="10" cy="10" r="2.5" />
              <path
                d="M10 2.5v1.5M10 16v1.5M2.5 10h1.5M16 10h1.5M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1"
                stroke-linecap="round"
              />
            </template>
          </svg>
          <span class="text-sm font-medium">{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </UiDrawer>
</template>
