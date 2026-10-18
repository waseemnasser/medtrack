import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// المسار الأساسي «/» محلياً. للنشر على GitHub Pages: npm run build:pages
// (يبني بمسار /medtrack/ عبر --base).
export default defineConfig({
  plugins: [react()],
})
