import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/maths-distance-calculator/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 4001,
  },
})
