import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'node:path'

// Prerender support (SSR build only): records which lazy-loaded modules a page rendered, so scripts/prerender.mjs
// can add their CSS and modulepreload links to that page's HTML (otherwise the server markup is unstyled until
// the route chunk arrives). Wraps lazy(() => import('x')) so the module path is added to globalThis.__ssrLazy.
function trackLazyImports() {
  const root = process.cwd()
  const lazyImport = /lazy\(\s*\(\)\s*=>\s*import\(\s*(['"])((?:(?!\1).)+)\1\s*\)\s*,?\s*\)/g
  return {
    name: 'track-lazy-imports',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split(path.sep).join('/').includes('/src/')) return null
      if (!/\.(jsx?|tsx?)$/.test(id.split('?')[0]) || !code.includes('lazy(')) return null
      let changed = false
      const out = code.replace(lazyImport, (match, quote, spec) => {
        if (!spec.startsWith('.')) return match
        const abs = path.resolve(path.dirname(id), spec)
        const rel = path.relative(root, abs).split(path.sep).join('/')
        changed = true
        return `lazy(() => import(${quote}${spec}${quote}).then((m) => { (globalThis.__ssrLazy ||= new Set()).add(${JSON.stringify(rel)}); return m; }))`
      })
      return changed ? { code: out, map: null } : null
    },
  }
}

export default ({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiUrl = env.VITE_API_URL || 'http://localhost:5000'

  return defineConfig({
    plugins: [react(), tailwindcss(), ...(isSsrBuild ? [trackLazyImports()] : [])],
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
      // Client build writes dist/.vite/manifest.json; the prerender step reads it and deletes it.
      manifest: !isSsrBuild,
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
