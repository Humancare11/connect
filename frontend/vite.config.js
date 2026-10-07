import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'

export default ({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiUrl = env.VITE_API_URL || 'http://localhost:5000'

  return defineConfig({
    plugins: [react(), tailwindcss()],    
    publicDir: 'public',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      __API_URL__: JSON.stringify(apiUrl)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      copyPublicDir: !isSsrBuild,
      target: 'es2020',
      cssCodeSplit: true,
      cssMinify: true,
      sourcemap: env.VITE_BUILD_SOURCEMAP === 'true',
      modulePreload: {
        polyfill: false,
      },
      rollupOptions: {
        // The prerender bundle (vite build --ssr) is run by Node, not shipped: no manual chunking.
        output: isSsrBuild ? {} : {
          // Only the framework core is pinned to a shared vendor chunk. Everything else (icons, animation,
          // payments, sockets, PDF, country data...) is split by the routes that import it, so a page
          // only downloads what it uses.
          manualChunks(id) {
            const bs = String.fromCharCode(92)
            const p = id.split(bs).join('/')
            if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(p)) return 'vendor-react'
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
        },
        '/socket.io': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        }
      }
    }
  })
}
