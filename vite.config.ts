import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

function copyLogoPlugin(): Plugin {
  return {
    name: 'copy-logo-plugin',
    closeBundle() {
      const src = path.resolve(import.meta.dirname, 'dist/Logo.svg')
      const dest = path.resolve(import.meta.dirname, 'dist/logo.svg')
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        try {
          fs.copyFileSync(src, dest)
        } catch {}
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyLogoPlugin()],
  base: './',
})
