import type { ApiKeyContext } from '../server/utils/api-key-context'

declare module 'h3' {
  interface H3EventContext {
    apiKeyUser?: ApiKeyContext
  }
}

export {}
