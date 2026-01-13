import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['favicon.png', 'robots.txt'],
      manifest: {
        name: 'Dedalos Tools',
        short_name: 'Dedalos',
        description: 'Ferramentas Dedalos Bar',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        
        // 1. O Paraquedas: Se tudo der errado, entrega o index.html
        navigateFallback: '/index.html',
        
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        
        runtimeCaching: [
          // 2. A REGRA QUE FALTA NO SEU ARQUIVO ATUAL:
          // Essa regra diz: "Se for navegação (HTML), TENTE a rede."
          // "SE a rede der erro ou mandar código 502, RECUSE e use o Cache."
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                // O SEGREDO: Só aceita status 0 (Opaque) ou 200 (OK).
                // Rejeita 502, 503, 504.
                statuses: [0, 200]
              }
            }
          },
          // Regra da API (mantida como estava)
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['tools.dedalosbar.com', 'localhost']
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: []
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  }
})