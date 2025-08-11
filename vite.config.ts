import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // For custom domain deployment
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173, // Default port
  }
})
