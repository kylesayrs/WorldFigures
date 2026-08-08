import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/worldfigures',
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      // allow reading ../topics and ../data (siblings of this app) at dev time
      allow: ['..'],
    },
    allowedHosts: ['competitivedrawing.com'],
  },
})
