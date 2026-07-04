<script setup lang="ts">
type EnrollResponse = {
  secret: string
  otpauthUrl: string
  qrDataUrl: string
}

const enabled = ref(false)
const loading = ref(true)
const enrolling = ref(false)
const confirming = ref(false)
const disabling = ref(false)
const error = ref<string | null>(null)
const enrollment = ref<EnrollResponse | null>(null)
const confirmCode = ref('')

async function loadStatus() {
  loading.value = true
  error.value = null
  try {
    const data = await $fetch<{ enabled: boolean }>('/api/auth/mfa/status')
    enabled.value = data.enabled
    if (data.enabled) {
      enrollment.value = null
      confirmCode.value = ''
    }
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load MFA status'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStatus()
})

async function startEnrollment() {
  enrolling.value = true
  error.value = null
  try {
    enrollment.value = await $fetch<EnrollResponse>('/api/auth/mfa/enroll', {
      method: 'POST',
    })
    confirmCode.value = ''
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to start MFA enrollment'
  }
  finally {
    enrolling.value = false
  }
}

async function confirmEnrollment() {
  if (!/^\d{6}$/.test(confirmCode.value)) {
    error.value = 'Enter a 6-digit code from your authenticator app.'
    return
  }

  confirming.value = true
  error.value = null
  try {
    await $fetch('/api/auth/mfa/confirm', {
      method: 'POST',
      body: { code: confirmCode.value },
    })
    enrollment.value = null
    confirmCode.value = ''
    enabled.value = true
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { statusMessage?: string }, message?: string }
    error.value = fetchError.data?.statusMessage ?? fetchError.message ?? 'Invalid verification code'
  }
  finally {
    confirming.value = false
  }
}

async function disableMfa() {
  disabling.value = true
  error.value = null
  try {
    await $fetch('/api/auth/mfa', { method: 'DELETE' })
    enabled.value = false
    enrollment.value = null
    confirmCode.value = ''
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to disable MFA'
  }
  finally {
    disabling.value = false
  }
}

function cancelEnrollment() {
  enrollment.value = null
  confirmCode.value = ''
  error.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-text-secondary">
      Protect your account with a time-based one-time password from an authenticator app.
    </p>

    <div
      v-if="error"
      class="rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
    >
      {{ error }}
    </div>

    <div
      v-if="loading"
      class="flex flex-col gap-2"
    >
      <UiSkeleton class="h-10 w-full" />
    </div>

    <template v-else-if="enabled">
      <div class="flex items-center justify-between gap-4 rounded-md border border-bull/30 bg-bull/5 px-4 py-3">
        <div>
          <p class="text-sm font-medium text-text-primary">
            MFA is enabled
          </p>
          <p class="mt-0.5 text-xs text-text-muted">
            Sign-in requires a code from your authenticator app.
          </p>
        </div>
        <UiBadge
          label="Active"
          variant="bull"
        />
      </div>
      <UiBtn
        variant="secondary"
        :loading="disabling"
        @click="disableMfa"
      >
        Disable MFA
      </UiBtn>
    </template>

    <template v-else-if="enrollment">
      <p class="text-sm font-medium text-text-primary">
        Scan this QR code
      </p>
      <p class="text-xs text-text-muted">
        Use Google Authenticator, 1Password, or another TOTP app. Then enter the 6-digit code to confirm.
      </p>

      <img
        :src="enrollment.qrDataUrl"
        alt="MFA QR code"
        class="mx-auto h-48 w-48 rounded-md border border-border-hair bg-white p-2"
      >

      <div class="rounded-md border border-border-hair bg-bg-raised px-3 py-2">
        <p class="text-xs text-text-muted">
          Manual entry key
        </p>
        <code class="mt-1 block break-all font-mono text-xs text-text-primary">
          {{ enrollment.secret }}
        </code>
      </div>

      <form
        class="flex flex-col gap-3"
        @submit.prevent="confirmEnrollment"
      >
        <UiInput
          v-model="confirmCode"
          label="Verification code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="000000"
          maxlength="6"
        />
        <div class="flex flex-wrap gap-2">
          <UiBtn
            type="submit"
            :loading="confirming"
            :disabled="confirmCode.length !== 6"
          >
            Confirm and enable
          </UiBtn>
          <UiBtn
            variant="ghost"
            type="button"
            @click="cancelEnrollment"
          >
            Cancel
          </UiBtn>
        </div>
      </form>
    </template>

    <template v-else>
      <UiBtn
        :loading="enrolling"
        @click="startEnrollment"
      >
        Enable MFA
      </UiBtn>
    </template>
  </div>
</template>
