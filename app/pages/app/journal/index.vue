<script setup lang="ts">
import type { JournalCoachingMode, JournalEntry } from '~/stores/journal'

definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const journalStore = useJournalStore()

const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingEntry = ref<JournalEntry | null>(null)

const showReviewPanel = ref(false)
const reviewEntryId = ref<string | null>(null)

const filterSetupTag = ref('')
const filterSymbolId = ref('')

const confirmDeleteId = ref<string | null>(null)

onMounted(() => {
  journalStore.fetchEntries({ reset: true })
})

function openCreate() {
  editingEntry.value = null
  modalMode.value = 'create'
  showModal.value = true
}

function openEdit(entry: JournalEntry) {
  editingEntry.value = entry
  modalMode.value = 'edit'
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingEntry.value = null
}

async function handleFormSubmit(data: Record<string, unknown>) {
  try {
    if (modalMode.value === 'edit' && editingEntry.value) {
      await journalStore.updateEntry(editingEntry.value.id, data as Parameters<typeof journalStore.updateEntry>[1])
    }
    else {
      await journalStore.createEntry(data as Parameters<typeof journalStore.createEntry>[0])
    }
    closeModal()
  }
  catch {
    // error is shown in store
  }
}

async function handleDelete(entry: JournalEntry) {
  if (confirmDeleteId.value === entry.id) {
    await journalStore.deleteEntry(entry.id)
    confirmDeleteId.value = null
  }
  else {
    confirmDeleteId.value = entry.id
    setTimeout(() => {
      if (confirmDeleteId.value === entry.id) confirmDeleteId.value = null
    }, 3000)
  }
}

async function openReview(entry: JournalEntry) {
  reviewEntryId.value = entry.id
  showReviewPanel.value = true
  await journalStore.fetchReviews(entry.id)
}

function closeReview() {
  showReviewPanel.value = false
  reviewEntryId.value = null
}

async function handleRequestReview(mode: JournalCoachingMode) {
  if (!reviewEntryId.value) return
  await journalStore.requestReview(reviewEntryId.value, mode)
}

const reviews = computed(() =>
  reviewEntryId.value ? (journalStore.reviewsByEntryId[reviewEntryId.value] ?? []) : [],
)

const reviewLoading = computed(() =>
  reviewEntryId.value ? (journalStore.reviewLoading[reviewEntryId.value] ?? false) : false,
)

async function applyFilters() {
  await journalStore.fetchEntries({
    reset: true,
    symbolId: filterSymbolId.value || undefined,
    setupTag: filterSetupTag.value || undefined,
  })
}

async function clearFilters() {
  filterSetupTag.value = ''
  filterSymbolId.value = ''
  await journalStore.fetchEntries({ reset: true })
}

async function loadMore() {
  if (!journalStore.nextCursor || journalStore.loading) return
  await journalStore.fetchEntries({
    symbolId: filterSymbolId.value || undefined,
    setupTag: filterSetupTag.value || undefined,
  })
}
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--spacing-command-bar))] flex-col">
    <!-- Page header -->
    <header class="shrink-0 border-b border-border-hair px-4 py-3">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-text-primary">
            Trade Journal
          </h1>
          <p class="mt-0.5 text-sm text-text-secondary">
            Log trades, review emotions, and get AI feedback.
          </p>
        </div>
        <UiBtn @click="openCreate">
          <svg class="size-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5H1.75a.75.75 0 010-1.5h5.5V1.75A.75.75 0 018 1z" />
          </svg>
          New entry
        </UiBtn>
      </div>

      <!-- Filters -->
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <UiInput
          v-model="filterSetupTag"
          placeholder="Filter by setup tag…"
          class="w-44"
          @keydown.enter="applyFilters"
        />
        <UiBtn
          variant="secondary"
          size="sm"
          @click="applyFilters"
        >
          Apply
        </UiBtn>
        <UiBtn
          v-if="filterSetupTag || filterSymbolId"
          variant="ghost"
          size="sm"
          @click="clearFilters"
        >
          Clear
        </UiBtn>
      </div>
    </header>

    <!-- Main content area: split when review panel open -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Entry list -->
      <div
        class="flex-1 overflow-y-auto p-4"
        :class="showReviewPanel ? 'lg:max-w-[calc(100%-380px)]' : ''"
      >
        <!-- Error banner -->
        <div
          v-if="journalStore.error"
          class="mb-4 rounded-lg border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear"
        >
          {{ journalStore.error }}
        </div>

        <!-- Skeleton loading -->
        <div
          v-if="journalStore.loading && !journalStore.entries.length"
          class="flex flex-col gap-4"
        >
          <UiSkeleton
            v-for="i in 4"
            :key="i"
            class="h-36 w-full"
          />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!journalStore.loading && !journalStore.entries.length"
          class="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 text-center"
        >
          <div class="rounded-lg border border-border-hair bg-bg-surface p-8">
            <p class="text-sm font-medium text-text-primary">
              No journal entries yet
            </p>
            <p class="mt-2 max-w-sm text-sm text-text-secondary">
              Start logging your trades to build a detailed history, track emotions, and improve with AI-powered reviews.
            </p>
            <UiBtn
              class="mt-5"
              @click="openCreate"
            >
              Add first entry
            </UiBtn>
          </div>
        </div>

          <!-- Entry grid -->
        <div
          v-else
          class="flex flex-col gap-4"
        >
          <div
            v-for="entry in journalStore.entries"
            :key="entry.id"
            class="relative"
          >
            <JournalJournalEntryCard
              :entry="entry"
              @edit="openEdit"
              @delete="handleDelete"
              @review="openReview"
            />
            <!-- Confirm delete overlay -->
            <div
              v-if="confirmDeleteId === entry.id"
              class="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-bg-overlay/90"
            >
              <span class="text-sm text-bear">Delete this entry?</span>
              <UiBtn
                variant="destructive"
                size="sm"
                :loading="journalStore.submitting"
                @click.stop="handleDelete(entry)"
              >
                Confirm
              </UiBtn>
              <UiBtn
                variant="ghost"
                size="sm"
                @click.stop="confirmDeleteId = null"
              >
                Cancel
              </UiBtn>
            </div>
          </div>

          <!-- Load more -->
          <div
            v-if="journalStore.nextCursor"
            class="flex justify-center pt-2"
          >
            <UiBtn
              variant="secondary"
              :loading="journalStore.loading"
              @click="loadMore"
            >
              Load more
            </UiBtn>
          </div>
        </div>
      </div>

      <!-- AI Review panel (right side) -->
      <aside
        v-if="showReviewPanel && reviewEntryId"
        class="hidden w-[380px] shrink-0 border-l border-border-hair lg:flex lg:flex-col"
      >
        <AiAIReviewPanel
          :entry-id="reviewEntryId"
          :reviews="reviews"
          :loading="reviewLoading"
          @close="closeReview"
          @request-review="handleRequestReview"
        />
      </aside>
    </div>

    <!-- Create / Edit modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16"
        @click.self="closeModal"
      >
        <div class="w-full max-w-2xl rounded-xl border border-border-strong bg-bg-base shadow-2xl">
          <div class="flex items-center justify-between border-b border-border-hair px-5 py-4">
            <h2 class="text-base font-semibold text-text-primary">
              {{ modalMode === 'edit' ? 'Edit journal entry' : 'New journal entry' }}
            </h2>
            <button
              type="button"
              class="rounded p-1 text-text-muted hover:bg-bg-raised hover:text-text-primary"
              @click="closeModal"
            >
              <svg class="size-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.53 4.47L9.06 8l2.47 2.53-1.06 1.06L8 9.06l-2.53 2.53-1.06-1.06L6.94 8 4.41 5.47l1.06-1.06L8 6.94l2.53-2.53 1 1.06z" />
              </svg>
            </button>
          </div>
          <div class="px-5 py-5">
            <JournalJournalEntryForm
              :entry="editingEntry"
              :loading="journalStore.submitting"
              @submit="handleFormSubmit"
              @cancel="closeModal"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Mobile AI review sheet -->
    <Teleport to="body">
      <div
        v-if="showReviewPanel && reviewEntryId"
        class="fixed inset-0 z-50 flex items-end lg:hidden"
        @click.self="closeReview"
      >
        <div
          class="h-[70dvh] w-full rounded-t-2xl border-t border-border-strong bg-bg-base shadow-2xl"
          @click.stop
        >
          <AiAIReviewPanel
            :entry-id="reviewEntryId"
            :reviews="reviews"
            :loading="reviewLoading"
            @close="closeReview"
            @request-review="handleRequestReview"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
