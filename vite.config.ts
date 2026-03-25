import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/maths-distance-calculator/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 4001,
  },
}))
