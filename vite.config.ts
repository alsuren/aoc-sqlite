import process from 'node:process'

import { livestoreDevtoolsPlugin } from '@livestore/devtools-vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    fs: { strict: false },
  },
  build: {
    target: 'esnext',
  },
  base: './', // For GitHub Pages
  worker: { format: 'es' },
  optimizeDeps: {
    // TODO remove once fixed https://github.com/vitejs/vite/issues/8427
    exclude: ['@livestore/wa-sqlite'],
  },
  plugins: [
    solidPlugin({ exclude: ['@livestore/**devtools**', 'react-dom/**'] }),
    livestoreDevtoolsPlugin({ schemaPath: './src/livestore/schema.ts' }),
  ],
})
