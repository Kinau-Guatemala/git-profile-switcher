import { defineConfig } from 'vitest/config'

// Dedicated test config so the electron-renderer Vite plugins (which rewrite
// Node built-ins like `node:fs/promises`) don't apply during unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
