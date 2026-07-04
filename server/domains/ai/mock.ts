import type { AICompletionOptions, AICompletionResult, AIProvider } from './provider'

const MOCK_RESPONSE = JSON.stringify({
  observations: [
    'Strategy uses a momentum-based entry with RSI confirmation.',
    'Win rate of 52% is marginally above break-even for a 1:1.5 reward-risk setup.',
    'Exposure averages 68%, leaving capital idle during low-volatility regimes.',
  ],
  risks: [
    'Max drawdown of 14.2% is approaching the typical 15% threshold for professional risk limits.',
    'Small sample size (< 30 trades) limits statistical reliability of the metrics.',
  ],
  strengths: [
    'Profit factor of 1.8 indicates gross wins exceed gross losses by a healthy margin.',
    'Consistent signal logic with clear entry and exit criteria reduces ambiguity.',
  ],
  actions: [
    'Increase sample size by extending backtest window to at least 3 years.',
    'Consider adding a regime filter to reduce exposure during trending bear markets.',
    'Backtest on at least 3 uncorrelated symbols to test strategy robustness.',
  ],
})

export function createMockProvider(): AIProvider {
  return {
    modelName: 'mock-v1',

    async completeReview(
      _prompt: string,
      _options: AICompletionOptions = {},
    ): Promise<AICompletionResult> {
      await new Promise(resolve => setTimeout(resolve, 120))

      return {
        text: MOCK_RESPONSE,
        tokensIn: 512,
        tokensOut: 256,
        model: 'mock-v1',
        costUsd: 0,
      }
    },
  }
}
