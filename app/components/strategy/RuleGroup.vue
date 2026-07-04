<script setup lang="ts">
import type { Condition, Signal } from '#shared/types/strategy'
import { validateSignal } from '~/utils/strategy-conditions'

const props = withDefaults(
  defineProps<{
    signal: Signal
    readonly?: boolean
  }>(),
  {
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:signal': [value: Signal]
}>()

const kindBadgeVariant = computed(() => {
  const map: Record<Signal['kind'], 'bull' | 'bear' | 'warn' | 'info' | 'accent' | 'default'> = {
    entry_long: 'bull',
    entry_short: 'bear',
    exit: 'warn',
    filter: 'info',
    warning: 'accent',
  }
  return map[props.signal.kind]
})

const kindLabel = computed(() => props.signal.kind.replace('_', ' '))

const validity = computed(() => validateSignal(props.signal))

function updateCondition(index: number, condition: Condition) {
  const conditions = [...props.signal.conditions]
  conditions[index] = condition
  emit('update:signal', { ...props.signal, conditions })
}

function moveCondition(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= props.signal.conditions.length) return

  const conditions = [...props.signal.conditions]
  const [item] = conditions.splice(index, 1)
  conditions.splice(target, 0, item!)
  emit('update:signal', { ...props.signal, conditions })
}
</script>

<template>
  <UiPanel
    class="overflow-hidden"
    :class="validity === 'error' ? 'ring-1 ring-bear/30' : validity === 'warning' ? 'ring-1 ring-warn/20' : ''"
  >
    <template #title>
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="text-sm font-medium text-text-primary">
          {{ signal.name }}
        </h3>
        <UiBadge
          :label="kindLabel"
          :variant="kindBadgeVariant"
        />
        <span class="text-2xs tracking-wide text-text-muted uppercase">
          Match {{ signal.logic }}
        </span>
      </div>
    </template>

    <div class="flex flex-col gap-2">
      <div
        v-for="(condition, index) in signal.conditions"
        :key="`${signal.id}-${index}`"
        class="flex items-start gap-2"
      >
        <div
          v-if="!readonly && signal.conditions.length > 1"
          class="flex shrink-0 flex-col gap-0.5 pt-2"
        >
          <button
            type="button"
            class="rounded border border-border-hair px-1.5 py-0.5 text-2xs text-text-muted hover:border-border-strong hover:text-text-secondary disabled:opacity-30"
            :disabled="index === 0"
            aria-label="Move condition up"
            @click="moveCondition(index, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="rounded border border-border-hair px-1.5 py-0.5 text-2xs text-text-muted hover:border-border-strong hover:text-text-secondary disabled:opacity-30"
            :disabled="index === signal.conditions.length - 1"
            aria-label="Move condition down"
            @click="moveCondition(index, 1)"
          >
            ↓
          </button>
        </div>

        <StrategyRuleBlock
          class="min-w-0 flex-1"
          :condition="condition"
          :model-value="condition"
          :readonly="readonly"
          @update:model-value="updateCondition(index, $event)"
        />
      </div>

      <p
        v-if="!signal.conditions.length"
        class="rounded-md border border-dashed border-border-hair px-3 py-4 text-center text-xs text-text-muted"
      >
        No conditions in this signal group.
      </p>
    </div>
  </UiPanel>
</template>
