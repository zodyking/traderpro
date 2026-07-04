<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'guest',
})

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
      },
    })
    await navigateTo('/app')
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { statusMessage?: string }, message?: string }
    error.value = fetchError.data?.statusMessage ?? fetchError.message ?? 'Sign in failed.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="mb-2 font-mono text-xs tracking-[0.2em] text-accent uppercase">
          AxiomEdge
        </p>
        <h1 class="text-xl font-semibold text-text-primary">
          Sign in
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          Evidence over instinct.
        </p>
      </div>

      <UiPanel>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <UiInput
            v-model="email"
            label="Email"
            type="email"
            placeholder="you@firm.com"
            autocomplete="email"
          />
          <UiInput
            v-model="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            :error="error"
          />
          <UiBtn type="submit" variant="primary" class="w-full" :loading="loading">
            Sign in
          </UiBtn>
        </form>
      </UiPanel>

      <p class="mt-4 text-center text-sm text-text-muted">
        No account?
        <NuxtLink to="/register" class="text-accent hover:text-accent-hover">
          Register
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
