import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En GitHub Pages el sitio vive en https://USUARIO.github.io/NOMBRE-REPO/
// El workflow de despliegue define VITE_BASE=/NOMBRE-REPO/ automáticamente.
// En desarrollo local queda en "/".
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: { sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
