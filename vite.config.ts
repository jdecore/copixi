import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Force `font-display: swap` on the pixelarticons @font-face so the browser
// shows the fallback immediately instead of triggering Chrome's slow-network
// "Fallback font will be used" intervention.
function swapIconFontDisplay(): Plugin {
  return {
    name: 'swap-icon-font-display',
    transform(code, id) {
      if (id.includes('pixelart-icons-font') && code.includes('@font-face') && !/font-display/.test(code)) {
        return code.replace(/\n\s*src:/, '\n  font-display: swap;\n  src:')
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swapIconFontDisplay()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        // Keep icon font filenames stable so we can preload them in index.html.
        assetFileNames(info) {
          const n = info.name || ''
          if (/\.(woff2?|eot|ttf)$/i.test(n)) return `assets/[name][extname]`
          return `assets/[name].[hash][extname]`
        },
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react'
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/papaparse')) return 'papaparse'
          if (id.includes('node_modules/@google/generative-ai')) return 'gemini'
          if (id.includes('node_modules/xlsx')) return 'excel'
          if (id.includes('node_modules/pdfjs-dist')) return 'pdf'
          if (id.includes('node_modules/mammoth')) return 'docx'
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
})
