<script setup lang="ts">
import type { IndicatorOverlay } from '#shared/types/indicators'
import { overlayLabel, paletteColor } from '~/utils/indicators'

const props = defineProps<{
  overlays: IndicatorOverlay[]
}>()

const emit = defineEmits<{
  'update:overlays': [overlays: IndicatorOverlay[]]
}>()

const presets: Array<Pick<IndicatorOverlay, 'id' | 'type' | 'params'>> = [
  { id: 'ema-20', type: 'ema', params: { period: 20 } },
  { id: 'sma-50', type: 'sma', params: { period: 50 } },
  { id: 'rsi-14', type: 'rsi', params: { period: 14 } },
  { id: 'vwap', type: 'vwap', params: {} },
  { id: 'atr-14', type: 'atr', params: { period: 14 } },
]

function isActive(id: string): boolean {
  return props.overlays.some((overlay) => overlay.id === id && overlay.visible)
}

function isAdded(id: string): boolean {
  return props.overlays.some((overlay) => overlay.id === id)
}

function togglePreset(preset: (typeof presets)[number]) {
  const existing = props.overlays.find((overlay) => overlay.id === preset.id)

  if (existing) {
    emit(
      'update:overlays',
      props.overlays.map((overlay) =>
        overlay.id === preset.id
          ? { ...overlay, visible: !overlay.visible }
          : overlay,
      ),
    )
    return
  }

  const colorIndex = props.overlays.length
  const next: IndicatorOverlay = {
    ...preset,
    color: paletteColor(colorIndex),
    visible: true,
  }

  emit('update:overlays', [...props.overlays, next])
}

function presetLabel(preset: (typeof presets)[number]): string {
  return overlayLabel(preset as IndicatorOverlay)
}
</script>

<template>
  <UiPanel class="p-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium tracking-wide text-text-muted uppercase">Indicators</span>

      <button
        v-for="preset in presets"
        :key="preset.id"
        type="button"
        class="rounded-md border px-2.5 py-1 font-mono text-xs transition-colors"
        :class="
          isActive(preset.id)
            ? 'border-accent bg-accent/10 text-accent'
            : isAdded(preset.id)
              ? 'border-border-strong bg-bg-raised text-text-secondary'
              : 'border-border-hair text-text-muted hover:bg-bg-raised hover:text-text-secondary'
        "
        @click="togglePreset(preset)"
      >
        {{ presetLabel(preset) }}
      </button>
    </div>
  </UiPanel>
</template>
