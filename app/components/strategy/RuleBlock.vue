<script setup lang="ts">
import type { Condition, Op } from '#shared/types/strategy'
import {
  formatCondition,
  validateCondition,
  validityBorderClasses,
} from '~/utils/strategy-conditions'

const props = withDefaults(
  defineProps<{
    condition: Condition
    modelValue?: Condition
    readonly?: boolean
  }>(),
  {
    modelValue: undefined,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: Condition]
}>()

const editing = ref(false)

const local = computed({
  get: () => props.modelValue ?? props.condition,
  set: (value: Condition) => emit('update:modelValue', value),
})

const naturalLanguage = computed(() => formatCondition(local.value))
const validity = computed(() => validateCondition(local.value))

const borderClass = computed(() => validityBorderClasses[validity.value])

const opOptions: Array<{ value: Op, label: string }> = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq_within', label: '≈' },
]

const fieldOptions = ['open', 'high', 'low', 'close'] as const
const indicatorOptions = ['ema', 'sma', 'rsi', 'vwap', 'atr'] as const

function updateCondition(patch: Partial<Condition>) {
  local.value = { ...local.value, ...patch } as Condition
}

function updateIndicatorParam(key: string, raw: string) {
  if (local.value.type !== 'indicator_compare' && local.value.type !== 'price_level' && local.value.type !== 'crossover') {
    return
  }

  const value = Number(raw)
  if (Number.isNaN(value)) return

  if (local.value.type === 'indicator_compare') {
    local.value = {
      ...local.value,
      left: {
        ...local.value.left,
        params: { ...local.value.left.params, [key]: value },
      },
    }
  }
  else if (local.value.type === 'price_level' && 'indicator' in local.value.ref) {
    local.value = {
      ...local.value,
      ref: {
        ...local.value.ref,
        params: { ...local.value.ref.params, [key]: value },
      },
    }
  }
  else if (local.value.type === 'crossover') {
    local.value = {
      ...local.value,
      a: {
        ...local.value.a,
        params: { ...local.value.a.params, [key]: value },
      },
    }
  }
}
</script>

<template>
  <div
    class="rounded-md border bg-bg-raised/60 transition-colors"
    :class="borderClass"
  >
    <div class="flex items-start justify-between gap-3 px-3 py-2.5">
      <div class="min-w-0 flex-1">
        <p class="font-mono text-sm text-text-primary">
          {{ naturalLanguage }}
        </p>
        <p
          v-if="validity !== 'valid'"
          class="mt-1 text-2xs"
          :class="validity === 'error' ? 'text-bear' : 'text-warn'"
        >
          {{ validity === 'error' ? 'Invalid condition' : 'Review condition parameters' }}
        </p>
      </div>

      <button
        v-if="!readonly"
        type="button"
        class="shrink-0 rounded border border-border-hair px-2 py-0.5 text-2xs text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
        @click="editing = !editing"
      >
        {{ editing ? 'Done' : 'Edit' }}
      </button>
    </div>

    <div
      v-if="editing && !readonly"
      class="border-t border-border-hair px-3 py-2.5"
    >
      <div
        v-if="local.type === 'price_level'"
        class="grid gap-2 sm:grid-cols-3"
      >
        <label class="flex flex-col gap-1">
          <span class="text-2xs text-text-muted">Field</span>
          <select
            :value="local.field"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @change="updateCondition({ field: ($event.target as HTMLSelectElement).value as typeof local.field })"
          >
            <option
              v-for="field in fieldOptions"
              :key="field"
              :value="field"
            >
              {{ field }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-2xs text-text-muted">Operator</span>
          <select
            :value="local.op"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @change="updateCondition({ op: ($event.target as HTMLSelectElement).value as Op })"
          >
            <option
              v-for="op in opOptions"
              :key="op.value"
              :value="op.value"
            >
              {{ op.label }}
            </option>
          </select>
        </label>
        <label
          v-if="'indicator' in local.ref"
          class="flex flex-col gap-1"
        >
          <span class="text-2xs text-text-muted">Indicator</span>
          <select
            :value="local.ref.indicator"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @change="local = { ...local, ref: { ...local.ref, indicator: ($event.target as HTMLSelectElement).value as typeof local.ref.indicator } }"
          >
            <option
              v-for="ind in indicatorOptions"
              :key="ind"
              :value="ind"
            >
              {{ ind.toUpperCase() }}
            </option>
          </select>
        </label>
        <label
          v-if="'indicator' in local.ref"
          class="flex flex-col gap-1"
        >
          <span class="text-2xs text-text-muted">Period</span>
          <input
            type="number"
            min="1"
            :value="local.ref.params.period ?? 14"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @input="updateIndicatorParam('period', ($event.target as HTMLInputElement).value)"
          >
        </label>
      </div>

      <div
        v-else-if="local.type === 'indicator_compare'"
        class="grid gap-2 sm:grid-cols-4"
      >
        <label class="flex flex-col gap-1">
          <span class="text-2xs text-text-muted">Indicator</span>
          <select
            :value="local.left.indicator"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @change="local = { ...local, left: { ...local.left, indicator: ($event.target as HTMLSelectElement).value as typeof local.left.indicator } }"
          >
            <option
              v-for="ind in indicatorOptions"
              :key="ind"
              :value="ind"
            >
              {{ ind.toUpperCase() }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-2xs text-text-muted">Period</span>
          <input
            type="number"
            min="1"
            :value="local.left.params.period ?? 14"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @input="updateIndicatorParam('period', ($event.target as HTMLInputElement).value)"
          >
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-2xs text-text-muted">Operator</span>
          <select
            :value="local.op"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @change="updateCondition({ op: ($event.target as HTMLSelectElement).value as Op })"
          >
            <option
              v-for="op in opOptions"
              :key="op.value"
              :value="op.value"
            >
              {{ op.label }}
            </option>
          </select>
        </label>
        <label
          v-if="typeof local.right === 'number'"
          class="flex flex-col gap-1"
        >
          <span class="text-2xs text-text-muted">Threshold</span>
          <input
            type="number"
            :value="local.right"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @input="local = { ...local, right: Number(($event.target as HTMLInputElement).value) }"
          >
        </label>
      </div>

      <div
        v-else-if="local.type === 'crossover'"
        class="grid gap-2 sm:grid-cols-3"
      >
        <label class="flex flex-col gap-1">
          <span class="text-2xs text-text-muted">Direction</span>
          <select
            :value="local.direction"
            class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
            @change="updateCondition({ direction: ($event.target as HTMLSelectElement).value as 'above' | 'below' })"
          >
            <option value="above">
              Above
            </option>
            <option value="below">
              Below
            </option>
          </select>
        </label>
      </div>

      <p
        v-else
        class="text-xs text-text-muted"
      >
        This condition type is display-only for now.
      </p>
    </div>
  </div>
</template>
