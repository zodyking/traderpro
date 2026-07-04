<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

const { user, clear: clearSession } = useUserSession()

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const signingOut = ref(false)

const initials = computed(() => {
  const label = user.value?.displayName?.trim() || user.value?.email || 'U'
  return label.charAt(0).toUpperCase()
})

onClickOutside(menuRef, () => {
  open.value = false
})

function toggleMenu() {
  open.value = !open.value
}

function closeMenu() {
  open.value = false
}

async function signOut() {
  signingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clearSession()
    closeMenu()
    await navigateTo('/login')
  }
  finally {
    signingOut.value = false
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu()
  }
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    window.addEventListener('keydown', onMenuKeydown)
  }
  else {
    window.removeEventListener('keydown', onMenuKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onMenuKeydown)
  }
})
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      type="button"
      class="flex h-8 items-center gap-2 rounded-md border border-border-hair px-2.5 text-xs text-text-secondary transition-colors hover:bg-bg-raised hover:text-text-primary"
      aria-label="Account menu"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggleMenu"
    >
      <span class="flex size-6 items-center justify-center rounded-full bg-indigo/20 font-mono text-2xs text-indigo">
        {{ initials }}
      </span>
      <span class="hidden sm:inline">Account</span>
      <svg
        class="size-3 text-text-muted transition-transform"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 12 12"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M3 4.5L6 7.5L9 4.5" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute top-[calc(100%+0.5rem)] right-0 z-50 min-w-52 overflow-hidden rounded-lg border border-border-hair bg-bg-surface shadow-lg"
      role="menu"
      aria-label="Account"
    >
      <div class="border-b border-border-hair px-3 py-2.5">
        <p class="truncate text-sm font-medium text-text-primary">
          {{ user?.displayName || 'Account' }}
        </p>
        <p v-if="user?.email" class="truncate text-xs text-text-muted">
          {{ user.email }}
        </p>
      </div>

      <div class="p-1">
        <NuxtLink
          to="/app/settings"
          role="menuitem"
          class="flex w-full items-center rounded-md px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-raised hover:text-text-primary"
          @click="closeMenu"
        >
          Settings
        </NuxtLink>
        <NuxtLink
          to="/app/broker"
          role="menuitem"
          class="flex w-full items-center rounded-md px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-raised hover:text-text-primary"
          @click="closeMenu"
        >
          Broker connections
        </NuxtLink>
      </div>

      <div class="border-t border-border-hair p-1">
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-bear transition-colors hover:bg-bear/10 disabled:opacity-60"
          :disabled="signingOut"
          @click="signOut"
        >
          {{ signingOut ? 'Signing out…' : 'Sign out' }}
        </button>
      </div>
    </div>
  </div>
</template>
