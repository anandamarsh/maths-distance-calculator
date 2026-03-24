import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/maths-distance-calculator/',
  plugins: [react()],
})
