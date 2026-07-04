/**
 * Additional edge-case tests for parseAIResult not already covered in ai-packet.test.ts.
 * Covers: non-array field values, raw-prose fallback, markdown code fences,
 * extra unknown keys, whitespace-only input, and large payloads.
 */
import { describe, expect, it } from 'vitest'
import { parseAIResult } from '../server/domains/ai/prompt'

describe('parseAIResult - additional edge cases', () => {
  it('returns raw text as first observation when no JSON braces are present', () => {
    const text = 'The strategy looks solid overall.'
    const result = parseAIResult(text)
    expect(result.observations).toBeDefined()
    expect(result.observations![0]).toBe(text)
    expect(result.risks).toHaveLength(0)
    expect(result.strengths).toHaveLength(0)
    expect(result.actions).toHaveLength(0)
  })

  it('trims surrounding whitespace before treating text as raw prose', () => {
    const text = '  No JSON here.  '
    const result = parseAIResult(text)
    expect(result.observations![0]).toBe('No JSON here.')
  })

  it('returns observations=[empty string] when input is only whitespace', () => {
    const result = parseAIResult('   ')
    expect(result.observations).toBeDefined()
    expect(result.observations![0]).toBe('')
  })

  it('extracts JSON wrapped in markdown ```json code fence', () => {
    const json = JSON.stringify({
      observations: ['Win rate is above 50%.'],
      risks: ['Drawdown exceeded 10%.'],
      strengths: ['Consistent risk sizing.'],
      actions: ['Increase backtest window.'],
    })
    const input = `\`\`\`json\n${json}\n\`\`\``
    const result = parseAIResult(input)
    expect(result.observations?.[0]).toBe('Win rate is above 50%.')
    expect(result.risks?.[0]).toBe('Drawdown exceeded 10%.')
  })

  it('extracts JSON wrapped in plain ``` code fence', () => {
    const json = JSON.stringify({ observations: ['Good profit factor.'], risks: [], strengths: [], actions: [] })
    const input = `\`\`\`\n${json}\n\`\`\``
    const result = parseAIResult(input)
    expect(result.observations?.[0]).toBe('Good profit factor.')
  })

  it('returns empty array when "observations" value is a string, not an array', () => {
    const input = JSON.stringify({ observations: 'Not an array', risks: [], strengths: [], actions: [] })
    const result = parseAIResult(input)
    expect(result.observations).toHaveLength(0)
  })

  it('returns empty array when "risks" value is an object, not an array', () => {
    const input = JSON.stringify({ observations: [], risks: { note: 'object' }, strengths: [], actions: [] })
    const result = parseAIResult(input)
    expect(result.risks).toHaveLength(0)
  })

  it('returns empty array when "strengths" value is null', () => {
    const input = JSON.stringify({ observations: [], risks: [], strengths: null, actions: [] })
    const result = parseAIResult(input)
    expect(result.strengths).toHaveLength(0)
  })

  it('returns empty array when "actions" value is a number', () => {
    const input = JSON.stringify({ observations: [], risks: [], strengths: [], actions: 42 })
    const result = parseAIResult(input)
    expect(result.actions).toHaveLength(0)
  })

  it('ignores extra unknown keys in the JSON object', () => {
    const input = JSON.stringify({
      observations: ['Sample observation.'],
      risks: [],
      strengths: [],
      actions: [],
      extraKey: 'ignored',
      anotherField: [1, 2, 3],
    })
    const result = parseAIResult(input)
    expect(result.observations?.[0]).toBe('Sample observation.')
    expect((result as Record<string, unknown>).extraKey).toBeUndefined()
  })

  it('preserves all items in large arrays', () => {
    const items = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
    const input = JSON.stringify({ observations: items, risks: [], strengths: [], actions: [] })
    const result = parseAIResult(input)
    expect(result.observations).toHaveLength(20)
    expect(result.observations![19]).toBe('Item 20')
  })

  it('handles JSON with all four arrays populated', () => {
    const input = JSON.stringify({
      observations: ['obs1', 'obs2'],
      risks: ['risk1'],
      strengths: ['str1', 'str2', 'str3'],
      actions: ['act1'],
    })
    const result = parseAIResult(input)
    expect(result.observations).toHaveLength(2)
    expect(result.risks).toHaveLength(1)
    expect(result.strengths).toHaveLength(3)
    expect(result.actions).toHaveLength(1)
  })

  it('handles a JSON object with no known keys at all', () => {
    const input = JSON.stringify({ foo: 'bar', baz: 123 })
    const result = parseAIResult(input)
    expect(result.observations).toHaveLength(0)
    expect(result.risks).toHaveLength(0)
    expect(result.strengths).toHaveLength(0)
    expect(result.actions).toHaveLength(0)
  })

  it('returns fallback when JSON is syntactically broken mid-object', () => {
    const input = '{"observations": ["Incomplete'
    const result = parseAIResult(input)
    expect(result.observations).toBeDefined()
    expect(result.observations!.length).toBeGreaterThan(0)
  })

  it('handles JSON embedded after a long prose introduction', () => {
    const prose = 'I have reviewed your strategy carefully. Here are my thoughts:\n\n'
    const json = JSON.stringify({
      observations: ['Trade count is sufficient.'],
      risks: ['Correlated positions.'],
      strengths: ['Clear stop levels.'],
      actions: ['Test on crypto assets.'],
    })
    const result = parseAIResult(prose + json)
    expect(result.observations?.[0]).toBe('Trade count is sufficient.')
    expect(result.actions?.[0]).toBe('Test on crypto assets.')
  })
})
