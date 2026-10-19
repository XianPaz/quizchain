import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedContract = path.resolve(__dirname, '../shared/gameContract.js')

// shared/gameContract.js is CommonJS, because the backend requires it. Vite only
// converts CommonJS for pre-bundled dependencies, so the alias is listed in
// optimizeDeps.include. That pre-bundle is cached, and the cache does not notice
// when the shared file changes, so this plugin restarts the dev server instead of
// serving stale game rules.
function reloadSharedContract() {
  return {
    name: 'quizchain-shared-contract-reload',
    configureServer(server) {
      server.watcher.add(sharedContract)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === sharedContract) {
          server.config.logger.info('shared/gameContract.js cambió, reiniciando Vite')
          server.restart(true)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), reloadSharedContract()],
  resolve: {
    alias: {
      '@quizchain/contract': sharedContract,
    },
  },
  server: {
    // The shared contract lives above the frontend root.
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
  optimizeDeps: {
    include: ['@quizchain/contract'],
  },
  build: {
    commonjsOptions: {
      include: [/shared[\\/]gameContract\.js$/, /node_modules/],
    },
  },
})
