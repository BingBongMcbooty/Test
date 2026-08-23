/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo's project site from /Test/, not the domain root;
  // only apply that base when actually building for Pages so local dev/preview stay at /.
  base: process.env.GITHUB_PAGES ? '/Test/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
