<script setup lang="ts">
import type { CompiledCondition, Condition, IndicatorRef, Op } from '#shared/types/strategy'
import { formatCondition } from '~/utils/strategy-conditions'

const props = withDefaults(
  defineProps<{
    symbolId?: string
    strategyVersionId?: string
  }>(),
  {
    symbolId: undefined,
    strategyVersionId: undefined,
  },
)

const emit = defineEmits<{
  created: [alert: { id: string; condition: CompiledCondition; active: boolean }]
  cancel: []
}>()

type AlertMode = 'price_cross' | 'indicator_compare' | 'crossover'

const mode = ref<AlertMode>('price_cross')
const saving = ref(false)
const error = ref('')

const fieldOptions = ['open', 'high', 'low', 'close'] as const
const indicatorOptions = ['ema', 'sma', 'rsi', 'vwap', 'atr'] as const
const opOptions: Array<{ value: Op; label: string }> = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
]

const priceCross = reactive({
  field: 'close' as typeof fieldOptions[number],
  op: 'gt' as Op,
  threshold: 100,
})

const indicatorCompare = reactive({
  indicator: 'ema' as typeof indicatorOptions[number],
  period: 20,
  op: 'gt' as Op,
  threshold: 50,
})

const crossover = reactive({
  fastIndicator: 'ema' as typeof indicatorOptions[number],
  fastPeriod: 9,
  slowIndicator: 'ema' as typeof indicatorOptions[number],
  slowPeriod: 21,
  direction: 'above' as 'above' | 'below',
})

function buildCondition(): Condition {
  if (mode.value === 'price_cross') {
    return {
      type: 'price_level',
      field: priceCross.field,
      op: priceCross.op,
      ref: { type: 'price' },
    } satisfies Condition
  }

  if (mode.value === 'indicator_compare') {
    const leftRef: IndicatorRef = {
      indicator: indicatorCompare.indicator,
      params: { period: indicatorCompare.period },
    }
    return {
      type: 'indicator_compare',
      left: leftRef,
      op: indicatorCompare.op,
      right: indicatorCompare.threshold,
    }
  }

  const aRef: IndicatorRef = {
    indicator: crossover.fastIndicator,
    params: { period: crossover.fastPeriod },
  }
  const bRef: IndicatorRef = {
    indicator: crossover.slowIndicator,
    params: { period: crossover.slowPeriod },
  }
  return {
    type: 'crossover',
    a: aRef,
    b: bRef,
    direction: crossover.direction,
  }
}

function buildCompiledCondition(): CompiledCondition {
  const root = buildCondition()
  const hash = btoa(JSON.stringify(root)).slice(0, 32)
  return { hash, root }
}

const preview = computed(() => {
  try {
    return formatCondition(buildCondition())
  }
  catch {
    return '—'
  }
})

async function submit() {
  saving.value = true
  error.value = ''

  try {
    const condition = buildCompiledCondition()
    const body: Record<string, unknown> = { condition }
    if (props.symbolId) body.symbolId = props.symbolId
    if (props.strategyVersionId) body.strategyVersionId = props.strategyVersionId

    const data = await $fetch<{ alert: { id: string; condition: CompiledCondition; active: boolean } }>(
      '/api/alerts',
      { method: 'POST', body },
    )
    emit('created', data.alert)
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to create alert'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 rounded-lg border border-border-strong bg-bg-raised p-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-text-primary">
        New Alert
      </h3>
      <button
        type="button"
        class="text-xs text-text-muted hover:text-text-secondary"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>

    <div class="flex flex-wrap gap-1">
      <button
        v-for="opt in [
          { value: 'price_cross', label: 'Price Cross' },
          { value: 'indicator_compare', label: 'Indicator' },
          { value: 'crossover', label: 'Crossover' },
        ]"
        :key="opt.value"
        type="button"
        class="rounded border px-2.5 py-1 text-xs transition-colors"
        :class="
          mode === opt.value
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-border-hair text-text-muted hover:border-border-strong hover:text-text-secondary'
        "
        @click="mode = opt.value as AlertMode"
      >
        {{ opt.label }}
      </button>
    </div>

    <div
      v-if="mode === 'price_cross'"
      class="grid grid-cols-3 gap-2"
    >
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Field</span>
        <select
          v-model="priceCross.field"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
        >
          <option
            v-for="f in fieldOptions"
            :key="f"
            :value="f"
          >
            {{ f }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Operator</span>
        <select
          v-model="priceCross.op"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
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
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Price</span>
        <input
          v-model.number="priceCross.threshold"
          type="number"
          step="0.01"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
        >
      </label>
    </div>

    <div
      v-else-if="mode === 'indicator_compare'"
      class="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Indicator</span>
        <select
          v-model="indicatorCompare.indicator"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
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
          v-model.number="indicatorCompare.period"
          type="number"
          min="1"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
        >
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Operator</span>
        <select
          v-model="indicatorCompare.op"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
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
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Threshold</span>
        <input
          v-model.number="indicatorCompare.threshold"
          type="number"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
        >
      </label>
    </div>

    <div
      v-else-if="mode === 'crossover'"
      class="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Fast</span>
        <div class="flex gap-1">
          <select
            v-model="crossover.fastIndicator"
            class="h-8 w-20 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
          >
            <option
              v-for="ind in indicatorOptions"
              :key="ind"
              :value="ind"
            >
              {{ ind.toUpperCase() }}
            </option>
          </select>
          <input
            v-model.number="crossover.fastPeriod"
            type="number"
            min="1"
            class="h-8 w-14 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
          >
        </div>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Direction</span>
        <select
          v-model="crossover.direction"
          class="h-8 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
        >
          <option value="above">
            Above
          </option>
          <option value="below">
            Below
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-text-muted">Slow</span>
        <div class="flex gap-1">
          <select
            v-model="crossover.slowIndicator"
            class="h-8 w-20 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
          >
            <option
              v-for="ind in indicatorOptions"
              :key="ind"
              :value="ind"
            >
              {{ ind.toUpperCase() }}
            </option>
          </select>
          <input
            v-model.number="crossover.slowPeriod"
            type="number"
            min="1"
            class="h-8 w-14 rounded-md border border-border-strong bg-bg-base px-2 font-mono text-xs text-text-primary"
          >
        </div>
      </label>
    </div>

    <div class="rounded-md bg-bg-surface px-3 py-2">
      <span class="text-2xs text-text-muted">Preview: </span>
      <span class="font-mono text-xs text-accent">{{ preview }}</span>
    </div>

    <p
      v-if="error"
      class="text-xs text-bear"
    >
      {{ error }}
    </p>

    <div class="flex justify-end gap-2">
      <UiBtn
        variant="ghost"
        size="sm"
        @click="emit('cancel')"
      >
        Cancel
      </UiBtn>
      <UiBtn
        variant="primary"
        size="sm"
        :loading="saving"
        @click="submit"
      >
        Create Alert
      </UiBtn>
    </div>
  </div>
</template>
