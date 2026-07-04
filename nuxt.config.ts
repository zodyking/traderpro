import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
  ],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    public: {
      appName: 'AxiomEdge',
      tagline: 'Evidence over instinct.',
    },
  },
})
