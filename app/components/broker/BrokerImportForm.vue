<script setup lang="ts">
import { BROKER_TYPES, useBrokerStore } from '~/stores/broker'

const emit = defineEmits<{
  imported: []
}>()

const store = useBrokerStore()

const BROKER_LABELS: Record<string, string> = {
  interactive_brokers: 'Interactive Brokers',
  td_ameritrade: 'TD Ameritrade',
  robinhood: 'Robinhood',
  generic: 'Generic CSV',
}

const broker = ref<string>(BROKER_TYPES[0])
const label = ref('')
const csvContent = ref('')
const fileName = ref<string | null>(null)
const fileError = ref<string | null>(null)

const canSubmit = computed(() => broker.value && label.value.trim() && csvContent.value.trim())

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    fileError.value = 'Please select a CSV file.'
    return
  }
  fileError.value = null
  fileName.value = file.name

  if (!label.value) {
    label.value = file.name.replace(/\.csv$/i, '').slice(0, 80)
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    csvContent.value = (e.target?.result as string) ?? ''
  }
  reader.readAsText(file)
}

async function handleSubmit() {
  if (!canSubmit.value) return
  try {
    await store.importCsv({
      broker: broker.value,
      label: label.value.trim(),
      csv: csvContent.value,
    })
    emit('imported')
    label.value = ''
    csvContent.value = ''
    fileName.value = null
  }
  catch {
    // error shown via store.importError
  }
}
</script>

<template>
  <UiPanel title="Import Broker CSV">
    <form
      class="flex flex-col gap-4"
      @submit.prevent="handleSubmit"
    >
      <div class="flex flex-col gap-1.5">
        <label
          for="broker-select"
          class="text-xs font-medium text-text-secondary"
        >
          Broker
        </label>
        <select
          id="broker-select"
          v-model="broker"
          class="h-9 w-full rounded-md border border-border-strong bg-bg-raised px-3 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option
            v-for="b in BROKER_TYPES"
            :key="b"
            :value="b"
          >
            {{ BROKER_LABELS[b] ?? b }}
          </option>
        </select>
      </div>

      <UiInput
        v-model="label"
        label="Account label"
        placeholder="e.g. My IB Account"
      />

      <div class="flex flex-col gap-1.5">
        <span class="text-xs font-medium text-text-secondary">CSV file</span>
        <label
          class="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-bg-raised text-sm text-text-muted transition-colors hover:border-accent/50 hover:text-text-secondary"
          :class="fileName ? 'border-accent/40 bg-accent/5' : ''"
        >
          <svg
            class="size-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path
              d="M10 13V7m0 0L7.5 9.5M10 7l2.5 2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M4 14.5A2.5 2.5 0 014 9.5h.5A5 5 0 0115 9v.5a3 3 0 010 6H4z"
              stroke-linecap="round"
            />
          </svg>
          <span>{{ fileName ? fileName : 'Click to upload CSV' }}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            class="sr-only"
            @change="handleFile"
          >
        </label>
        <p
          v-if="fileError"
          class="text-xs text-bear"
        >
          {{ fileError }}
        </p>
      </div>

      <div
        v-if="store.importError"
        class="rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
        role="alert"
      >
        {{ store.importError }}
      </div>

      <div
        v-if="store.importResult"
        class="rounded-md border border-bull/30 bg-bull/10 px-3 py-2 text-sm text-bull"
      >
        <span class="font-medium">Import complete.</span>
        {{ store.importResult.inserted }} rows imported, {{ store.importResult.skipped }} skipped.
        <span
          v-if="store.importResult.parseErrors.length > 0"
          class="ml-1 text-warn"
        >
          {{ store.importResult.parseErrors.length }} parse warning(s).
        </span>
      </div>

      <UiBtn
        type="submit"
        :loading="store.importLoading"
        :disabled="!canSubmit"
      >
        Import
      </UiBtn>
    </form>
  </UiPanel>
</template>
