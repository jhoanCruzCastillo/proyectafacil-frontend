import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.CI4_BACKEND_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    // Mismo proxy que server, pero para `vite preview` (build de producción) — Vite no comparte
    // la config de `server.proxy` con `preview`, hay que declararla aparte.
    preview: {
      proxy: {
        '/api': {
          target: env.CI4_BACKEND_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
