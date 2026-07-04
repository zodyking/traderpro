import Redis from 'ioredis'

const holder: { client?: Redis } = {}

export function useRedis() {
  if (!holder.client) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Redis client not initialized',
    })
  }
  return holder.client
}

export function useRedisSubscriber() {
  return useRedis().duplicate()
}

export function initRedis(url: string) {
  if (holder.client) return holder.client

  holder.client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

  holder.client.connect().catch((error) => {
    console.warn('[redis] connection failed:', error)
  })

  return holder.client
}

export async function closeRedis() {
  await holder.client?.quit()
  holder.client = undefined
}
