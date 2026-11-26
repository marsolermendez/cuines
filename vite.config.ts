import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages sirve el sitio en /<repo>/; el workflow fija VITE_BASE con el nombre real del repo.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE ?? '/cuines/') : '/',
  plugins: [react(), tailwindcss()],
}))
