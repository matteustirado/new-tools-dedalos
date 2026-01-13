import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true, // Habilita PWA mesmo em modo Dev
        type: 'module', // Importante para versões novas do Vite
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
        // --- AQUI ESTÁ A MÁGICA DA AGRESSIVIDADE ---
        // Força o PWA a assumir o controle da página IMEDIATAMENTE,
        // sem esperar o usuário fechar e abrir a aba.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
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