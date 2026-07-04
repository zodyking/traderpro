import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', '.nuxt', '.output', 'dist'],
    passWithNoTests: true,
  },
})
