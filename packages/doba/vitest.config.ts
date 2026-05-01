import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.test-d.ts', 'tests/**/*.bench.ts'],
    typecheck: {
      include: ['tests/**/*.test-d.ts'],
    },
  },
})
