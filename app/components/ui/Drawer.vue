<script setup lang="ts">
import {
  DrawerClose,
  DrawerContent,
  DrawerHandle,
  DrawerOverlay,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
} from 'reka-ui'

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  title?: string
}>()
</script>

<template>
  <DrawerRoot v-model:open="open">
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/60" />
      <DrawerContent
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-lg border-t border-border-hair bg-bg-surface outline-none"
      >
        <DrawerHandle class="mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
        <DrawerTitle
          v-if="title"
          class="px-4 pb-2 text-sm font-semibold text-text-primary"
        >
          {{ title }}
        </DrawerTitle>
        <div class="overflow-y-auto px-4 pb-safe">
          <slot />
        </div>
        <DrawerClose class="sr-only">
          Close
        </DrawerClose>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
