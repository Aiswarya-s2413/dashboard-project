import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Force Vite to run on port 3000
    // If you want to use proxying instead of absolute URLs in axios:
    // proxy: {
    //   '/api': {
    //     target: 'http://127.0.0.1:8000',
    //     changeOrigin: true,
    //     secure: false,
    //   }
    // }
  },
  build: {
    chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB to suppress warning
  }
})