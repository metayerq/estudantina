import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (no prefix filter) so REVOLUT_SECRET_KEY stays server-side only
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5174,
      host: '127.0.0.1',
      proxy: {
        '/api/revolut': {
          target: 'https://merchant.revolut.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/revolut/, '/api/1.0'),
          headers: {
            Authorization: `Bearer ${env.REVOLUT_SECRET_KEY}`,
            Accept: 'application/json',
          },
        },
      },
    },
  }
})
