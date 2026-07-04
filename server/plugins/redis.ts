import { closeRedis, initRedis } from '../utils/redis'

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const redisUrl = config.redisUrl || process.env.REDIS_URL || ''

  if (!redisUrl) {
    console.warn('[redis] REDIS_URL is not configured')
    return
  }

  initRedis(redisUrl)

  nitroApp.hooks.hook('close', async () => {
    await closeRedis()
  })
})
