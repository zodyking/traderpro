<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    direction?: 'horizontal' | 'vertical'
    initial?: number
    min?: number
    max?: number
  }>(),
  {
    direction: 'horizontal',
    initial: 50,
    min: 20,
    max: 80,
  },
)

const containerRef = ref<HTMLElement | null>(null)
const splitPercent = ref(props.initial)
const isDragging = ref(false)

const isHorizontal = computed(() => props.direction === 'horizontal')

function onPointerDown(event: PointerEvent) {
  isDragging.value = true
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  document.body.style.cursor = isHorizontal.value ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
}

function onPointerMove(event: PointerEvent) {
  if (!isDragging.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const ratio = isHorizontal.value
    ? ((event.clientX - rect.left) / rect.width) * 100
    : ((event.clientY - rect.top) / rect.height) * 100

  splitPercent.value = Math.min(props.max, Math.max(props.min, ratio))
}

function onPointerUp() {
  isDragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex size-full overflow-hidden"
    :class="isHorizontal ? 'flex-row' : 'flex-col'"
  >
    <div
      class="min-h-0 min-w-0 overflow-auto"
      :style="
        isHorizontal
          ? { width: `${splitPercent}%` }
          : { height: `${splitPercent}%` }
      "
    >
      <slot name="first" />
    </div>

    <div
      class="group relative shrink-0 bg-border-hair transition-colors hover:bg-accent/40"
      :class="
        isHorizontal
          ? 'w-px cursor-col-resize'
          : 'h-px cursor-row-resize'
      "
      role="separator"
      :aria-orientation="isHorizontal ? 'vertical' : 'horizontal'"
      :aria-valuenow="Math.round(splitPercent)"
      aria-valuemin="20"
      aria-valuemax="80"
      tabindex="0"
      @pointerdown="onPointerDown"
    >
      <div
        class="absolute bg-border-strong transition-colors group-hover:bg-accent"
        :class="
          isHorizontal
            ? 'top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full'
            : 'top-1/2 left-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full'
        "
      />
    </div>

    <div class="min-h-0 min-w-0 flex-1 overflow-auto">
      <slot name="second" />
    </div>
  </div>
</template>
