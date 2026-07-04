<script setup lang="ts">
export type StrategyVersionSummary = {
  id: string
  version: number
  createdAt: string
  note?: string | null
}

defineProps<{
  versions: StrategyVersionSummary[]
  activeVersionId?: string | null
}>()

const emit = defineEmits<{
  select: [versionId: string]
}>()

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
</script>

<template>
  <div class="flex items-center gap-2 overflow-x-auto pb-1">
    <button
      v-for="item in versions"
      :key="item.id"
      type="button"
      class="flex shrink-0 flex-col rounded-md border px-3 py-2 text-left transition-colors"
      :class="
        item.id === activeVersionId
          ? 'border-accent bg-accent/10 text-text-primary'
          : 'border-border-hair bg-bg-raised/50 text-text-secondary hover:border-border-strong hover:bg-bg-raised'
      "
      @click="emit('select', item.id)"
    >
      <span class="font-mono text-xs font-medium">
        v{{ item.version }}
      </span>
      <span class="text-2xs text-text-muted">
        {{ formatDate(item.createdAt) }}
      </span>
      <span
        v-if="item.note"
        class="mt-0.5 max-w-[10rem] truncate text-2xs text-text-secondary"
      >
        {{ item.note }}
      </span>
    </button>

    <p
      v-if="!versions.length"
      class="text-xs text-text-muted"
    >
      No saved versions yet — save to create v1.
    </p>
  </div>
</template>
