import type { H3Event } from 'h3'

export type ApiKeyContext = {
  userId: string
  apiKeyId: string
}

export function setApiKeyUser(event: H3Event, context: ApiKeyContext): void {
  event.context.apiKeyUser = context
}

export function getApiKeyUser(event: H3Event): ApiKeyContext | null {
  return event.context.apiKeyUser ?? null
}
