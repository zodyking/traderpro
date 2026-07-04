import { defineStore } from 'pinia'
import {
  createTrendPullbackRiskModel,
  createTrendPullbackRules,
  TREND_PULLBACK_NAME,
} from '#shared/templates/trend-pullback'
import type { RiskModel, RuleAst } from '#shared/types/strategy'
import { validateSignal } from '~/utils/strategy-conditions'

export type StrategyVersionRecord = {
  id: string
  version: number
  createdAt: string
  note?: string | null
  rules: RuleAst
  riskModel: RiskModel
}

export type StrategyRecord = {
  id: string
  name: string
  assetClass: string
  timeframe: string
  createdAt: string
  versions: StrategyVersionRecord[]
}

export type ValidationIssue = {
  signalId: string
  signalName: string
  level: 'warning' | 'error'
  message: string
}

export const useStrategyStore = defineStore('strategy', () => {
  const currentStrategy = ref<StrategyRecord | null>(null)
  const activeVersionId = ref<string | null>(null)
  const draftRules = ref<RuleAst>(createTrendPullbackRules())
  const draftRiskModel = ref<RiskModel>(createTrendPullbackRiskModel())
  const draftName = ref(TREND_PULLBACK_NAME)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const isDirty = ref(false)
  let suppressDirty = false

  function markDirty() {
    if (!suppressDirty) {
      isDirty.value = true
    }
  }

  watch(draftRules, markDirty, { deep: true })
  watch(draftRiskModel, markDirty, { deep: true })

  const versions = computed(() => currentStrategy.value?.versions ?? [])

  const activeVersion = computed(() =>
    versions.value.find((version) => version.id === activeVersionId.value) ?? null,
  )

  function resetDraftFromTemplate() {
    suppressDirty = true
    draftRules.value = createTrendPullbackRules()
    draftRiskModel.value = createTrendPullbackRiskModel()
    draftName.value = TREND_PULLBACK_NAME
    isDirty.value = false
    nextTick(() => {
      suppressDirty = false
    })
  }

  function loadDraftFromVersion(version: StrategyVersionRecord) {
    suppressDirty = true
    draftRules.value = structuredClone(version.rules)
    draftRiskModel.value = structuredClone(version.riskModel)
    isDirty.value = false
    nextTick(() => {
      suppressDirty = false
    })
  }

  function selectVersion(versionId: string) {
    const version = versions.value.find((item) => item.id === versionId)
    if (!version) return
    activeVersionId.value = versionId
    loadDraftFromVersion(version)
  }

  function updateSignal(index: number, signal: RuleAst['signals'][number]) {
    const signals = [...draftRules.value.signals]
    signals[index] = signal
    draftRules.value = { signals }
  }

  function validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    for (const signal of draftRules.value.signals) {
      const state = validateSignal(signal)
      if (state === 'valid') continue

      issues.push({
        signalId: signal.id,
        signalName: signal.name,
        level: state,
        message: state === 'error'
          ? 'One or more conditions are invalid'
          : 'Review signal conditions',
      })
    }

    if (!draftRiskModel.value.maxRiskPerTrade && draftRiskModel.value.sizingMethod === 'risk_per_trade') {
      issues.push({
        signalId: '_risk',
        signalName: 'Risk model',
        level: 'warning',
        message: 'Max risk per trade is not set',
      })
    }

    return issues
  }

  async function loadStrategies() {
    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ strategies: StrategyRecord[] }>('/api/strategies')
      if (data.strategies.length) {
        currentStrategy.value = data.strategies[0]!
        const latest = data.strategies[0]!.versions[0]
        if (latest) {
          activeVersionId.value = latest.id
          draftName.value = data.strategies[0]!.name
          loadDraftFromVersion(latest)
        }
      }
      else {
        currentStrategy.value = null
        activeVersionId.value = null
        resetDraftFromTemplate()
      }
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load strategies'
    }
    finally {
      loading.value = false
    }
  }

  async function createStrategy(note?: string) {
    saving.value = true
    error.value = null

    try {
      const data = await $fetch<{ strategy: Omit<StrategyRecord, 'versions'> }>('/api/strategies', {
        method: 'POST',
        body: {
          name: draftName.value,
          assetClass: 'stock',
          timeframe: '1h',
        },
      })

      const versionData = await $fetch<{ version: StrategyVersionRecord }>(
        `/api/strategies/${data.strategy.id}/versions`,
        {
          method: 'POST',
          body: {
            rules: draftRules.value,
            riskModel: draftRiskModel.value,
            note,
          },
        },
      )

      currentStrategy.value = {
        ...data.strategy,
        versions: [versionData.version],
      }
      activeVersionId.value = versionData.version.id
      isDirty.value = false
      return currentStrategy.value
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to create strategy'
      throw err
    }
    finally {
      saving.value = false
    }
  }

  async function saveVersion(note?: string) {
    if (!currentStrategy.value) {
      return createStrategy(note)
    }

    saving.value = true
    error.value = null

    try {
      const data = await $fetch<{ version: StrategyVersionRecord }>(
        `/api/strategies/${currentStrategy.value.id}/versions`,
        {
          method: 'POST',
          body: {
            rules: draftRules.value,
            riskModel: draftRiskModel.value,
            note,
          },
        },
      )

      const updatedVersions = [data.version, ...currentStrategy.value.versions]
      currentStrategy.value = {
        ...currentStrategy.value,
        versions: updatedVersions,
      }
      activeVersionId.value = data.version.id
      isDirty.value = false
      return data.version
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to save version'
      throw err
    }
    finally {
      saving.value = false
    }
  }

  return {
    currentStrategy,
    versions,
    activeVersion,
    activeVersionId,
    draftRules,
    draftRiskModel,
    draftName,
    loading,
    saving,
    error,
    isDirty,
    loadStrategies,
    createStrategy,
    saveVersion,
    validate,
    selectVersion,
    updateSignal,
    resetDraftFromTemplate,
  }
})
