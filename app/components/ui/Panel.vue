<script setup lang="ts">
defineProps<{
  title?: string
  padded?: boolean
}>()
</script>

<template>
  <section
    class="rounded-lg border border-border-hair bg-bg-surface shadow-panel"
    :class="padded !== false ? 'p-4' : ''"
  >
    <header
      v-if="title || $slots.title"
      class="mb-3 flex items-center justify-between border-b border-border-hair pb-3"
    >
      <h2
        v-if="title"
        class="text-sm font-medium tracking-wide text-text-primary uppercase"
      >
        {{ title }}
      </h2>
      <slot name="title" />
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
