import { describe, expect, it } from 'vitest'
import {
  BREAKOUT_RETEST_NAME,
  MEAN_REVERSION_NAME,
  MOMENTUM_CONTINUATION_NAME,
  OPENING_RANGE_BREAKOUT_NAME,
  STRATEGY_TEMPLATES,
  TREND_PULLBACK_NAME,
  VWAP_RECLAIM_NAME,
  getTemplateById,
} from '../shared/templates/index'
import type { StrategyTemplateId } from '../shared/templates/index'

// ── Template registry ─────────────────────────────────────────────────────────

describe('STRATEGY_TEMPLATES registry', () => {
  it('contains exactly 6 templates', () => {
    expect(STRATEGY_TEMPLATES).toHaveLength(6)
  })

  it('contains all expected template IDs', () => {
    const ids = STRATEGY_TEMPLATES.map(t => t.id)
    expect(ids).toContain('trend-pullback')
    expect(ids).toContain('breakout-retest')
    expect(ids).toContain('mean-reversion')
    expect(ids).toContain('vwap-reclaim')
    expect(ids).toContain('opening-range-breakout')
    expect(ids).toContain('momentum-continuation')
  })

  it('every template has all required fields', () => {
    for (const template of STRATEGY_TEMPLATES) {
      expect(template.id, `${template.id} missing id`).toBeTruthy()
      expect(template.name, `${template.id} missing name`).toBeTruthy()
      expect(template.description, `${template.id} missing description`).toBeTruthy()
      expect(template.assetClass, `${template.id} missing assetClass`).toBeTruthy()
      expect(template.timeframe, `${template.id} missing timeframe`).toBeTruthy()
      expect(template.difficulty, `${template.id} missing difficulty`).toBeTruthy()
      expect(template.createRules, `${template.id} missing createRules`).toBeTypeOf('function')
      expect(template.createRiskModel, `${template.id} missing createRiskModel`).toBeTypeOf('function')
    }
  })

  it('template IDs are unique', () => {
    const ids = STRATEGY_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── getTemplateById ────────────────────────────────────────────────────────────

describe('getTemplateById', () => {
  it('returns the correct template for each known ID', () => {
    const knownIds: StrategyTemplateId[] = [
      'trend-pullback',
      'breakout-retest',
      'mean-reversion',
      'vwap-reclaim',
      'opening-range-breakout',
      'momentum-continuation',
    ]
    for (const id of knownIds) {
      const tpl = getTemplateById(id)
      expect(tpl, `template not found: ${id}`).toBeDefined()
      expect(tpl!.id).toBe(id)
    }
  })

  it('returns undefined for an unknown ID', () => {
    const result = getTemplateById('does-not-exist' as StrategyTemplateId)
    expect(result).toBeUndefined()
  })
})

// ── Exported name constants ───────────────────────────────────────────────────

describe('exported template name constants', () => {
  it('TREND_PULLBACK_NAME is a non-empty string', () => {
    expect(typeof TREND_PULLBACK_NAME).toBe('string')
    expect(TREND_PULLBACK_NAME.length).toBeGreaterThan(0)
  })

  it('BREAKOUT_RETEST_NAME is a non-empty string', () => {
    expect(typeof BREAKOUT_RETEST_NAME).toBe('string')
    expect(BREAKOUT_RETEST_NAME.length).toBeGreaterThan(0)
  })

  it('MEAN_REVERSION_NAME is a non-empty string', () => {
    expect(typeof MEAN_REVERSION_NAME).toBe('string')
    expect(MEAN_REVERSION_NAME.length).toBeGreaterThan(0)
  })

  it('VWAP_RECLAIM_NAME is a non-empty string', () => {
    expect(typeof VWAP_RECLAIM_NAME).toBe('string')
    expect(VWAP_RECLAIM_NAME.length).toBeGreaterThan(0)
  })

  it('OPENING_RANGE_BREAKOUT_NAME is a non-empty string', () => {
    expect(typeof OPENING_RANGE_BREAKOUT_NAME).toBe('string')
    expect(OPENING_RANGE_BREAKOUT_NAME.length).toBeGreaterThan(0)
  })

  it('MOMENTUM_CONTINUATION_NAME is a non-empty string', () => {
    expect(typeof MOMENTUM_CONTINUATION_NAME).toBe('string')
    expect(MOMENTUM_CONTINUATION_NAME.length).toBeGreaterThan(0)
  })

  it('template name matches exported constant', () => {
    expect(getTemplateById('trend-pullback')!.name).toBe(TREND_PULLBACK_NAME)
    expect(getTemplateById('breakout-retest')!.name).toBe(BREAKOUT_RETEST_NAME)
    expect(getTemplateById('mean-reversion')!.name).toBe(MEAN_REVERSION_NAME)
    expect(getTemplateById('vwap-reclaim')!.name).toBe(VWAP_RECLAIM_NAME)
    expect(getTemplateById('opening-range-breakout')!.name).toBe(OPENING_RANGE_BREAKOUT_NAME)
    expect(getTemplateById('momentum-continuation')!.name).toBe(MOMENTUM_CONTINUATION_NAME)
  })
})

// ── createRules() validity ────────────────────────────────────────────────────

describe('createRules - every template returns a valid RuleAst', () => {
  for (const template of STRATEGY_TEMPLATES) {
    it(`${template.id}: createRules() returns an object with a signals array`, () => {
      const rules = template.createRules()
      expect(rules).toBeDefined()
      expect(Array.isArray(rules.signals)).toBe(true)
    })

    it(`${template.id}: has at least one signal`, () => {
      const rules = template.createRules()
      expect(rules.signals.length).toBeGreaterThan(0)
    })

    it(`${template.id}: every signal has id, name, kind, logic, conditions`, () => {
      const rules = template.createRules()
      for (const signal of rules.signals) {
        expect(signal.id, 'signal missing id').toBeTruthy()
        expect(signal.name, 'signal missing name').toBeTruthy()
        expect(['entry_long', 'entry_short', 'exit', 'filter', 'warning']).toContain(signal.kind)
        expect(['all', 'any']).toContain(signal.logic)
        expect(Array.isArray(signal.conditions)).toBe(true)
        expect(signal.conditions.length).toBeGreaterThan(0)
      }
    })

    it(`${template.id}: includes at least one entry signal`, () => {
      const rules = template.createRules()
      const hasEntry = rules.signals.some(s => s.kind === 'entry_long' || s.kind === 'entry_short')
      expect(hasEntry).toBe(true)
    })
  }
})

// ── createRiskModel() validity ────────────────────────────────────────────────

describe('createRiskModel - every template returns a valid RiskModel', () => {
  for (const template of STRATEGY_TEMPLATES) {
    it(`${template.id}: createRiskModel() returns a non-null object`, () => {
      const riskModel = template.createRiskModel()
      expect(riskModel).toBeDefined()
      expect(typeof riskModel).toBe('object')
    })
  }

  it('trend-pullback has stopLoss and takeProfit', () => {
    const tpl = getTemplateById('trend-pullback')!
    const model = tpl.createRiskModel()
    expect(model.stopLoss).toBeDefined()
    expect(model.takeProfit).toBeDefined()
  })

  it('momentum-continuation has a trailing stop', () => {
    const tpl = getTemplateById('momentum-continuation')!
    const model = tpl.createRiskModel()
    expect(model.trailingStop).toBeDefined()
  })

  it('all risk models specify a sizingMethod', () => {
    for (const template of STRATEGY_TEMPLATES) {
      const model = template.createRiskModel()
      expect(
        ['fixed_shares', 'fixed_dollars', 'percent_equity', 'risk_per_trade'],
        `${template.id} has unexpected sizingMethod`,
      ).toContain(model.sizingMethod)
    }
  })
})

// ── Per-template spot checks ──────────────────────────────────────────────────

describe('trend-pullback template', () => {
  const tpl = getTemplateById('trend-pullback')!

  it('is tagged as stock / 1h / beginner', () => {
    expect(tpl.assetClass).toBe('stock')
    expect(tpl.timeframe).toBe('1h')
    expect(tpl.difficulty).toBe('beginner')
  })
})

describe('breakout-retest template', () => {
  const tpl = getTemplateById('breakout-retest')!

  it('is tagged as stock / 1h / beginner', () => {
    expect(tpl.assetClass).toBe('stock')
    expect(tpl.timeframe).toBe('1h')
    expect(tpl.difficulty).toBe('beginner')
  })
})

describe('mean-reversion template', () => {
  const tpl = getTemplateById('mean-reversion')!

  it('is tagged as intermediate difficulty', () => {
    expect(tpl.difficulty).toBe('intermediate')
  })
})

describe('momentum-continuation template', () => {
  const tpl = getTemplateById('momentum-continuation')!

  it('is tagged as advanced difficulty', () => {
    expect(tpl.difficulty).toBe('advanced')
  })

  it('targets the daily timeframe', () => {
    expect(tpl.timeframe).toBe('1d')
  })
})

describe('opening-range-breakout template', () => {
  const tpl = getTemplateById('opening-range-breakout')!

  it('targets the 5m timeframe', () => {
    expect(tpl.timeframe).toBe('5m')
  })
})

describe('vwap-reclaim template', () => {
  const tpl = getTemplateById('vwap-reclaim')!

  it('targets the 15m timeframe', () => {
    expect(tpl.timeframe).toBe('15m')
  })
})
