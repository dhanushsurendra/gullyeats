
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      'import.meta.env.API_URL': JSON.stringify(env.API_URL),
      'import.meta.env.ADMIN_PATH': JSON.stringify(env.ADMIN_PATH),
      'import.meta.env.CART_PATH': JSON.stringify(env.CART_PATH),
    },
    server: {
      port: 5173,
    },
  }
})
