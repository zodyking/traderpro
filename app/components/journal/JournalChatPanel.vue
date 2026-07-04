<script setup lang="ts">
export type JournalChatMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

const props = defineProps<{
  entryId: string
}>()

const messages = ref<JournalChatMessage[]>([])
const draft = ref('')
const loading = ref(false)
const sending = ref(false)
const error = ref<string | null>(null)
const threadRef = ref<HTMLElement | null>(null)

async function loadConversation() {
  loading.value = true
  error.value = null
  try {
    const data = await $fetch<{ messages: JournalChatMessage[] }>(`/api/journal/${props.entryId}/chat`)
    messages.value = data.messages ?? []
    await nextTick()
    scrollToBottom()
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load chat'
  }
  finally {
    loading.value = false
  }
}

async function sendMessage() {
  const text = draft.value.trim()
  if (!text || sending.value) return

  sending.value = true
  error.value = null
  const optimistic: JournalChatMessage = {
    role: 'user',
    content: text,
    createdAt: new Date().toISOString(),
  }
  messages.value = [...messages.value, optimistic]
  draft.value = ''
  await nextTick()
  scrollToBottom()

  try {
    const data = await $fetch<{ messages: JournalChatMessage[] }>(`/api/journal/${props.entryId}/chat`, {
      method: 'POST',
      body: { message: text },
    })
    messages.value = data.messages
    await nextTick()
    scrollToBottom()
  }
  catch (err: unknown) {
    messages.value = messages.value.filter(m => m !== optimistic)
    draft.value = text
    error.value = err instanceof Error ? err.message : 'Failed to send message'
  }
  finally {
    sending.value = false
  }
}

function scrollToBottom() {
  const el = threadRef.value
  if (el) el.scrollTop = el.scrollHeight
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(() => props.entryId, () => {
  void loadConversation()
}, { immediate: true })
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-border-hair px-4 py-3">
      <h3 class="text-sm font-semibold text-text-primary">
        Journal Chat
      </h3>
      <p class="mt-0.5 text-xs text-text-muted">
        Multi-turn coaching about this entry
      </p>
    </div>

    <div
      ref="threadRef"
      class="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      aria-live="polite"
    >
      <template v-if="loading">
        <UiSkeleton
          v-for="i in 3"
          :key="i"
          class="h-16 w-full"
        />
      </template>

      <p
        v-else-if="!messages.length"
        class="py-8 text-center text-sm text-text-muted"
      >
        Ask a question about this trade to start a conversation.
      </p>

      <div
        v-for="(message, index) in messages"
        :key="`${message.createdAt}-${index}`"
        class="flex"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[90%] rounded-lg px-3 py-2 text-sm"
          :class="message.role === 'user'
            ? 'bg-accent/15 text-text-primary'
            : 'border border-border-hair bg-bg-raised text-text-secondary'"
        >
          <p class="whitespace-pre-wrap">
            {{ message.content }}
          </p>
          <p class="mt-1 text-[10px] text-text-muted">
            {{ formatTime(message.createdAt) }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      class="mx-4 mb-2 rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear"
    >
      {{ error }}
    </div>

    <form
      class="border-t border-border-hair p-3"
      @submit.prevent="sendMessage"
    >
      <div class="flex gap-2">
        <UiInput
          v-model="draft"
          placeholder="Ask about this trade…"
          class="flex-1"
          :disabled="sending"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <UiBtn
          type="submit"
          :loading="sending"
          :disabled="!draft.trim()"
        >
          Send
        </UiBtn>
      </div>
    </form>
  </div>
</template>
