<script setup lang="ts">
import type { RiskModel } from '#shared/types/strategy'

const model = defineModel<RiskModel>({ required: true })

const stopTypes = [
  { value: 'fixed', label: 'Fixed $' },
  { value: 'percent', label: 'Percent' },
  { value: 'atr', label: 'ATR multiple' },
] as const

const takeProfitTypes = [
  { value: 'fixed', label: 'Fixed $' },
  { value: 'percent', label: 'Percent' },
  { value: 'r_multiple', label: 'R multiple' },
] as const

const trailingStopTypes = [
  { value: 'percent', label: 'Percent' },
  { value: 'atr', label: 'ATR multiple' },
] as const

const sizingMethods = [
  { value: 'fixed_shares', label: 'Fixed shares' },
  { value: 'fixed_dollars', label: 'Fixed dollars' },
  { value: 'percent_equity', label: '% of equity' },
  { value: 'risk_per_trade', label: 'Risk per trade' },
] as const

function ensureStopLoss() {
  if (!model.value.stopLoss) {
    model.value = {
      ...model.value,
      stopLoss: { type: 'percent', value: 2 },
    }
  }
}

function ensureTakeProfit() {
  if (!model.value.takeProfit) {
    model.value = {
      ...model.value,
      takeProfit: { type: 'r_multiple', value: 2 },
    }
  }
}

function ensureTrailingStop() {
  if (!model.value.trailingStop) {
    model.value = {
      ...model.value,
      trailingStop: { type: 'percent', value: 2 },
    }
  }
}

function setStopLossType(type: 'fixed' | 'percent' | 'atr' | '') {
  if (!type) {
    const { stopLoss, ...rest } = model.value
    model.value = rest
    return
  }
  ensureStopLoss()
  model.value = {
    ...model.value,
    stopLoss: { type, value: model.value.stopLoss?.value ?? 2 },
  }
}

function setTakeProfitType(type: 'fixed' | 'percent' | 'r_multiple' | '') {
  if (!type) {
    const { takeProfit, ...rest } = model.value
    model.value = rest
    return
  }
  ensureTakeProfit()
  model.value = {
    ...model.value,
    takeProfit: { type, value: model.value.takeProfit?.value ?? 2 },
  }
}

function setTrailingStopType(type: 'percent' | 'atr' | '') {
  if (!type) {
    const { trailingStop, ...rest } = model.value
    model.value = rest
    return
  }
  ensureTrailingStop()
  model.value = {
    ...model.value,
    trailingStop: { type, value: model.value.trailingStop?.value ?? 2 },
  }
}

function updateMaxRisk(raw: string) {
  const value = Number(raw)
  model.value = {
    ...model.value,
    maxRiskPerTrade: Number.isNaN(value) ? undefined : value,
  }
}
</script>

<template>
  <UiPanel title="Risk model">
    <div class="flex flex-col gap-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-text-secondary">Stop loss</label>
          <div class="grid grid-cols-2 gap-2">
            <select
              :value="model.stopLoss?.type ?? ''"
              class="h-9 rounded-md border border-border-strong bg-bg-raised px-2 font-mono text-xs text-text-primary"
              @change="setStopLossType(($event.target as HTMLSelectElement).value as 'fixed' | 'percent' | 'atr' | '')"
            >
              <option value="">
                None
              </option>
              <option
                v-for="opt in stopTypes"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <UiInput
              v-if="model.stopLoss"
              :model-value="String(model.stopLoss.value)"
              type="number"
              placeholder="Value"
              @update:model-value="model = { ...model, stopLoss: { ...model.stopLoss!, value: Number($event) || 0 } }"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-text-secondary">Take profit</label>
          <div class="grid grid-cols-2 gap-2">
            <select
              :value="model.takeProfit?.type ?? ''"
              class="h-9 rounded-md border border-border-strong bg-bg-raised px-2 font-mono text-xs text-text-primary"
              @change="setTakeProfitType(($event.target as HTMLSelectElement).value as 'fixed' | 'percent' | 'r_multiple' | '')"
            >
              <option value="">
                None
              </option>
              <option
                v-for="opt in takeProfitTypes"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <UiInput
              v-if="model.takeProfit"
              :model-value="String(model.takeProfit.value)"
              type="number"
              placeholder="Value"
              @update:model-value="model = { ...model, takeProfit: { ...model.takeProfit!, value: Number($event) || 0 } }"
            />
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-text-secondary">Trailing stop</label>
        <div class="grid grid-cols-2 gap-2 sm:max-w-md">
          <select
            :value="model.trailingStop?.type ?? ''"
            class="h-9 rounded-md border border-border-strong bg-bg-raised px-2 font-mono text-xs text-text-primary"
            @change="setTrailingStopType(($event.target as HTMLSelectElement).value as 'percent' | 'atr' | '')"
          >
            <option value="">
              None
            </option>
            <option
              v-for="opt in trailingStopTypes"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <UiInput
            v-if="model.trailingStop"
            :model-value="String(model.trailingStop.value)"
            type="number"
            placeholder="Value"
            @update:model-value="model = { ...model, trailingStop: { ...model.trailingStop!, value: Number($event) || 0 } }"
          />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-text-secondary">Sizing method</label>
          <select
            :value="model.sizingMethod ?? 'risk_per_trade'"
            class="h-9 rounded-md border border-border-strong bg-bg-raised px-3 font-mono text-sm text-text-primary"
            @change="model = { ...model, sizingMethod: ($event.target as HTMLSelectElement).value as NonNullable<RiskModel['sizingMethod']> }"
          >
            <option
              v-for="opt in sizingMethods"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <UiInput
          label="Max risk per trade (%)"
          :model-value="model.maxRiskPerTrade !== undefined ? String(model.maxRiskPerTrade) : ''"
          type="number"
          placeholder="1.0"
          @update:model-value="updateMaxRisk"
        />
      </div>
    </div>
  </UiPanel>
</template>
