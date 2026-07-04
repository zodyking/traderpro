import { closeRedis, initRedis } from '../utils/redis'

export default defineNitroPlugin((nitroApp) => {
  const { redisUrl } = useRuntimeConfig()

  if (!redisUrl) {
    console.warn('[redis] REDIS_URL is not configured')
    return
  }

  initRedis(redisUrl)

  nitroApp.hooks.hook('close', async () => {
    await closeRedis()
  })
})
