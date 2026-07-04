<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex items-center justify-between border-b border-border-hair px-6 py-4">
      <span class="font-mono text-sm font-bold tracking-[0.2em] text-text-primary">
        AXIOMEDGE
      </span>
      <nav class="flex items-center gap-4">
        <NuxtLink
          to="/login"
          class="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Sign in
        </NuxtLink>
        <UiBtn variant="primary" size="sm" @click="navigateTo('/register')">
          Get started
        </UiBtn>
      </nav>
    </header>

    <main class="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p class="mb-4 font-mono text-xs tracking-[0.3em] text-accent uppercase">
        Quantitative trading workspace
      </p>
      <h1 class="mb-4 max-w-2xl text-4xl font-semibold tracking-tight text-text-primary">
        Evidence over instinct.
      </h1>
      <p class="mb-10 max-w-lg text-md text-text-secondary">
        Institutional-grade strategy research, backtesting, and execution — built for traders who demand reproducible edge.
      </p>
      <div class="flex items-center gap-3">
        <UiBtn variant="primary" size="lg" @click="navigateTo('/login')">
          Enter workspace
        </UiBtn>
        <UiBtn variant="secondary" size="lg" @click="navigateTo('/register')">
          Create account
        </UiBtn>
      </div>
    </main>

    <footer class="border-t border-border-hair px-6 py-4 text-center text-xs text-text-muted">
      © {{ new Date().getFullYear() }} AxiomEdge
    </footer>
  </div>
</template>
