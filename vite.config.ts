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
          // Llenado IA: N secciones × ~hasta 120 s c/u en el backend.
          timeout: 600_000,
          proxyTimeout: 600_000,
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
          timeout: 600_000,
          proxyTimeout: 600_000,
        },
      },
    },
  }
})
