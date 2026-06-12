import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiUrl = env.VITE_API_URL || 'http://localhost:5000'

  return defineConfig({
    plugins: [react(), tailwindcss()],
    publicDir: 'public',
    define: {
      __API_URL__: JSON.stringify(apiUrl)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2020',
      cssCodeSplit: true,
      sourcemap: env.VITE_BUILD_SOURCEMAP === 'true',
      modulePreload: {
        polyfill: false,
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('react') || id.includes('react-router-dom')) return 'vendor-react'
            if (id.includes('socket.io-client')) return 'vendor-realtime'
            if (id.includes('gsap') || id.includes('framer-motion') || id.includes('swiper') || id.includes('lenis')) {
              return 'vendor-animation'
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
            if (id.includes('@stripe') || id.includes('@paypal')) return 'vendor-payments'
            return undefined
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  })
}
