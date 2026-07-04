<script setup lang="ts">
import type { EmailNotificationKey, EmailNotificationPreferences } from '#shared/types/email'
import { EMAIL_NOTIFICATION_KEYS } from '#shared/types/email'

const OPTIONS: Array<{
  key: EmailNotificationKey
  label: string
  description: string
}> = [
  {
    key: 'signUp',
    label: 'Welcome email',
    description: 'Sent when you create your account.',
  },
  {
    key: 'login',
    label: 'Sign-in alerts',
    description: 'Notify you when a new session starts on your account.',
  },
  {
    key: 'alerts',
    label: 'Market alerts',
    description: 'Email when a price or strategy alert fires.',
  },
  {
    key: 'backtests',
    label: 'Backtest results',
    description: 'Email when a backtest run finishes.',
  },
  {
    key: 'productUpdates',
    label: 'Product updates',
    description: 'Occasional tips, releases, and platform news.',
  },
]

const preferences = ref<EmailNotificationPreferences>({
  signUp: true,
  login: true,
  alerts: true,
  backtests: true,
  productUpdates: false,
})
const smtpConfigured = ref(true)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const data = await $fetch<{
      preferences: EmailNotificationPreferences
      smtpConfigured: boolean
    }>('/api/me/notifications')
    preferences.value = data.preferences
    smtpConfigured.value = data.smtpConfigured
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load notification settings'
  }
  finally {
    loading.value = false
  }
})

function toggle(key: EmailNotificationKey) {
  preferences.value = {
    ...preferences.value,
    [key]: !preferences.value[key],
  }
}

async function savePreferences() {
  saving.value = true
  error.value = null
  success.value = false

  try {
    const payload = Object.fromEntries(
      EMAIL_NOTIFICATION_KEYS.map((key) => [key, preferences.value[key]]),
    ) as EmailNotificationPreferences

    const data = await $fetch<{ preferences: EmailNotificationPreferences }>(
      '/api/me/notifications',
      {
        method: 'PATCH',
        body: payload,
      },
    )
    preferences.value = data.preferences
    success.value = true
    setTimeout(() => {
      success.value = false
    }, 2500)
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to save notification settings'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p
      v-if="!smtpConfigured"
      class="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn"
    >
      Email delivery is not configured on this server yet. Your preferences are saved and will apply once SMTP is enabled.
    </p>

    <div
      v-if="loading"
      class="flex flex-col gap-2"
    >
      <UiSkeleton
        v-for="i in 4"
        :key="i"
        class="h-14 w-full"
      />
    </div>

    <ul
      v-else
      class="flex flex-col gap-2"
    >
      <li
        v-for="option in OPTIONS"
        :key="option.key"
      >
        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-border-hair bg-bg-raised px-3 py-3 transition-colors hover:border-border-strong">
          <input
            type="checkbox"
            class="mt-1 size-4 rounded border-border-strong accent-accent"
            :checked="preferences[option.key]"
            @change="toggle(option.key)"
          >
          <span>
            <span class="block text-sm font-medium text-text-primary">{{ option.label }}</span>
            <span class="mt-0.5 block text-xs text-text-muted">{{ option.description }}</span>
          </span>
        </label>
      </li>
    </ul>

    <div class="flex items-center gap-3">
      <UiBtn
        :loading="saving"
        :disabled="loading"
        @click="savePreferences"
      >
        Save notifications
      </UiBtn>
      <p
        v-if="error"
        class="text-xs text-bear"
      >
        {{ error }}
      </p>
      <p
        v-else-if="success"
        class="text-xs text-bull"
      >
        Notification preferences saved.
      </p>
    </div>
  </div>
</template>
