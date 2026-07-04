<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'mfa-pending',
})

const code = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/mfa/verify', {
      method: 'POST',
      body: { code: code.value },
    })
    await navigateTo('/app')
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { statusMessage?: string }, message?: string }
    error.value = fetchError.data?.statusMessage ?? fetchError.message ?? 'Verification failed.'
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
          Two-factor authentication
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <UiPanel>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <UiInput
            v-model="code"
            label="Verification code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="000000"
            maxlength="6"
            :error="error"
          />
          <UiBtn type="submit" variant="primary" class="w-full" :loading="loading">
            Verify
          </UiBtn>
        </form>
      </UiPanel>

      <p class="mt-4 text-center text-sm text-text-muted">
        <NuxtLink to="/login" class="text-accent hover:text-accent-hover">
          Back to sign in
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
