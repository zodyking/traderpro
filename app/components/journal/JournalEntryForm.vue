<script setup lang="ts">
import type { JournalEntry, JournalPlanned, JournalActual } from '~/stores/journal'

const props = withDefaults(
  defineProps<{
    entry?: JournalEntry | null
    loading?: boolean
  }>(),
  { entry: null, loading: false },
)

const emit = defineEmits<{
  submit: [data: Record<string, unknown>]
  cancel: []
}>()

const journalStore = useJournalStore()

type SymbolResult = { id: string; ticker: string; name: string }

const symbolQuery = ref(props.entry?.symbolId ? '' : '')
const symbolResults = ref<SymbolResult[]>([])
const symbolSearchLoading = ref(false)
const selectedSymbolId = ref<string | undefined>(props.entry?.symbolId ?? undefined)
const selectedSymbolTicker = ref('')

const side = ref<'long' | 'short' | ''>(props.entry?.side ?? '')
const setupTag = ref(props.entry?.setupTag ?? '')
const emotion = ref(props.entry?.emotion ?? '')
const note = ref(props.entry?.note ?? '')
const mistakesText = ref(props.entry?.mistakes?.join(', ') ?? '')

const plannedEntry = ref<string>(props.entry?.planned?.entry?.toString() ?? '')
const plannedStop = ref<string>(props.entry?.planned?.stop?.toString() ?? '')
const plannedTarget = ref<string>(props.entry?.planned?.target?.toString() ?? '')
const plannedSize = ref<string>(props.entry?.planned?.size?.toString() ?? '')
const plannedThesis = ref(props.entry?.planned?.thesis ?? '')

const actualEntry = ref<string>(props.entry?.actual?.entry?.toString() ?? '')
const actualExit = ref<string>(props.entry?.actual?.exit?.toString() ?? '')
const actualSize = ref<string>(props.entry?.actual?.size?.toString() ?? '')

const openedAt = ref(props.entry?.openedAt ? new Date(props.entry.openedAt).toISOString().slice(0, 16) : '')
const closedAt = ref(props.entry?.closedAt ? new Date(props.entry.closedAt).toISOString().slice(0, 16) : '')

const screenshots = ref<string[]>(props.entry?.screenshots ?? [])
const uploadingScreenshot = ref(false)
const screenshotError = ref<string | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | undefined

async function searchSymbols(q: string) {
  if (!q.trim()) {
    symbolResults.value = []
    return
  }
  symbolSearchLoading.value = true
  try {
    const data = await $fetch<{ results: SymbolResult[] }>('/api/symbols/search', { query: { q } })
    symbolResults.value = data.results.slice(0, 8)
  }
  catch {
    symbolResults.value = []
  }
  finally {
    symbolSearchLoading.value = false
  }
}

function onSymbolInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => searchSymbols(symbolQuery.value), 280)
}

function selectSymbol(sym: SymbolResult) {
  selectedSymbolId.value = sym.id
  selectedSymbolTicker.value = sym.ticker
  symbolQuery.value = sym.ticker
  symbolResults.value = []
}

function clearSymbol() {
  selectedSymbolId.value = undefined
  selectedSymbolTicker.value = ''
  symbolQuery.value = ''
  symbolResults.value = []
}

async function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  screenshotError.value = null
  uploadingScreenshot.value = true
  try {
    const url = await journalStore.uploadScreenshot(file)
    screenshots.value = [...screenshots.value, url]
  }
  catch (err: unknown) {
    screenshotError.value = err instanceof Error ? err.message : 'Upload failed'
  }
  finally {
    uploadingScreenshot.value = false
    input.value = ''
  }
}

function removeScreenshot(idx: number) {
  screenshots.value = screenshots.value.filter((_, i) => i !== idx)
}

function parseNum(v: string): number | undefined {
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) ? n : undefined
}

function handleSubmit() {
  const planned: JournalPlanned = {}
  if (plannedEntry.value) planned.entry = parseNum(plannedEntry.value)
  if (plannedStop.value) planned.stop = parseNum(plannedStop.value)
  if (plannedTarget.value) planned.target = parseNum(plannedTarget.value)
  if (plannedSize.value) planned.size = parseNum(plannedSize.value)
  if (plannedThesis.value.trim()) planned.thesis = plannedThesis.value.trim()

  const actual: JournalActual = {}
  if (actualEntry.value) actual.entry = parseNum(actualEntry.value)
  if (actualExit.value) actual.exit = parseNum(actualExit.value)
  if (actualSize.value) actual.size = parseNum(actualSize.value)

  const mistakes = mistakesText.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  emit('submit', {
    symbolId: selectedSymbolId.value,
    side: side.value || undefined,
    setupTag: setupTag.value.trim() || undefined,
    planned,
    actual,
    emotion: emotion.value.trim() || undefined,
    mistakes,
    note: note.value.trim() || undefined,
    screenshots: screenshots.value,
    openedAt: openedAt.value ? new Date(openedAt.value).toISOString() : undefined,
    closedAt: closedAt.value ? new Date(closedAt.value).toISOString() : undefined,
  })
}
</script>

<template>
  <form
    class="flex flex-col gap-5"
    @submit.prevent="handleSubmit"
  >
    <!-- Symbol search -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-text-secondary">Symbol</label>
      <div class="relative">
        <input
          v-model="symbolQuery"
          type="text"
          placeholder="Search symbol…"
          class="h-9 w-full rounded-md border border-border-strong bg-bg-raised px-3 font-mono text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          autocomplete="off"
          @input="onSymbolInput"
        >
        <button
          v-if="selectedSymbolId"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          aria-label="Clear symbol"
          @click="clearSymbol"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.53 4.47L9.06 8l2.47 2.53-1.06 1.06L8 9.06l-2.53 2.53-1.06-1.06L6.94 8 4.41 5.47l1.06-1.06L8 6.94l2.53-2.53 1 1.06z" /></svg>
        </button>
        <ul
          v-if="symbolResults.length"
          class="absolute z-20 mt-1 w-full rounded-md border border-border-strong bg-bg-overlay shadow-lg"
        >
          <li
            v-for="sym in symbolResults"
            :key="sym.id"
            class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-bg-raised"
            @mousedown.prevent="selectSymbol(sym)"
          >
            <span class="font-mono font-medium text-text-primary">{{ sym.ticker }}</span>
            <span class="truncate text-text-secondary">{{ sym.name }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Side + Setup tag -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-text-secondary">Side</label>
        <select
          v-model="side"
          class="h-9 w-full rounded-md border border-border-strong bg-bg-raised px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        >
          <option value="">— none —</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </div>
      <UiInput
        v-model="setupTag"
        label="Setup tag"
        placeholder="e.g. breakout"
      />
    </div>

    <!-- Dates -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-text-secondary">Opened at</label>
        <input
          v-model="openedAt"
          type="datetime-local"
          class="h-9 w-full rounded-md border border-border-strong bg-bg-raised px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        >
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-text-secondary">Closed at</label>
        <input
          v-model="closedAt"
          type="datetime-local"
          class="h-9 w-full rounded-md border border-border-strong bg-bg-raised px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        >
      </div>
    </div>

    <!-- Planned -->
    <div class="rounded-lg border border-border-hair bg-bg-raised/50 p-4">
      <p class="mb-3 text-xs font-medium tracking-wide text-text-muted uppercase">
        Planned
      </p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <UiInput v-model="plannedEntry" label="Entry" type="number" placeholder="0.00" />
        <UiInput v-model="plannedStop" label="Stop" type="number" placeholder="0.00" />
        <UiInput v-model="plannedTarget" label="Target" type="number" placeholder="0.00" />
        <UiInput v-model="plannedSize" label="Size" type="number" placeholder="0" />
      </div>
      <div class="mt-3 flex flex-col gap-1.5">
        <label class="text-xs font-medium text-text-secondary">Thesis</label>
        <textarea
          v-model="plannedThesis"
          rows="2"
          placeholder="Why are you taking this trade?"
          class="w-full resize-none rounded-md border border-border-strong bg-bg-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </div>
    </div>

    <!-- Actual -->
    <div class="rounded-lg border border-border-hair bg-bg-raised/50 p-4">
      <p class="mb-3 text-xs font-medium tracking-wide text-text-muted uppercase">
        Actual
      </p>
      <div class="grid grid-cols-3 gap-3">
        <UiInput v-model="actualEntry" label="Entry" type="number" placeholder="0.00" />
        <UiInput v-model="actualExit" label="Exit" type="number" placeholder="0.00" />
        <UiInput v-model="actualSize" label="Size" type="number" placeholder="0" />
      </div>
    </div>

    <!-- Emotion + Mistakes -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UiInput
        v-model="emotion"
        label="Emotion"
        placeholder="e.g. confident, anxious"
      />
      <UiInput
        v-model="mistakesText"
        label="Mistakes (comma-separated)"
        placeholder="e.g. chased entry, sized too big"
      />
    </div>

    <!-- Note -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-text-secondary">Notes</label>
      <textarea
        v-model="note"
        rows="4"
        placeholder="Post-trade analysis, lessons learned…"
        class="w-full resize-y rounded-md border border-border-strong bg-bg-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
      />
    </div>

    <!-- Screenshots -->
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-text-secondary">Screenshots</label>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(url, idx) in screenshots"
          :key="url"
          class="group relative h-20 w-28 overflow-hidden rounded-md border border-border-strong bg-bg-raised"
        >
          <img
            :src="url"
            alt="screenshot"
            class="size-full object-cover"
          >
          <button
            type="button"
            class="absolute right-1 top-1 hidden rounded-full bg-bg-overlay/80 p-0.5 text-text-secondary hover:text-bear group-hover:flex"
            @click="removeScreenshot(idx)"
          >
            <svg class="size-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.53 4.47L9.06 8l2.47 2.53-1.06 1.06L8 9.06l-2.53 2.53-1.06-1.06L6.94 8 4.41 5.47l1.06-1.06L8 6.94l2.53-2.53 1 1.06z" /></svg>
          </button>
        </div>

        <label
          class="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong bg-bg-raised text-text-muted transition-colors hover:border-accent hover:text-text-secondary"
          :class="{ 'opacity-60 cursor-not-allowed': uploadingScreenshot }"
        >
          <svg
            v-if="!uploadingScreenshot"
            class="size-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 4v12m-6-6h12" />
          </svg>
          <svg
            v-else
            class="size-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-xs">{{ uploadingScreenshot ? 'Uploading…' : 'Add image' }}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="sr-only"
            :disabled="uploadingScreenshot"
            @change="handleFileInput"
          >
        </label>
      </div>
      <p
        v-if="screenshotError"
        class="text-xs text-bear"
      >
        {{ screenshotError }}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-2 border-t border-border-hair pt-4">
      <UiBtn
        variant="ghost"
        type="button"
        @click="emit('cancel')"
      >
        Cancel
      </UiBtn>
      <UiBtn
        type="submit"
        :loading="props.loading"
      >
        {{ props.entry ? 'Save changes' : 'Add entry' }}
      </UiBtn>
    </div>
  </form>
</template>
