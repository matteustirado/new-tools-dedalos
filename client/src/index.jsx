import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

const isProduction = window.location.hostname !== 'localhost';
const apiUrl = import.meta.env.VITE_API_URL;

if (isProduction && (!apiUrl || apiUrl.includes('localhost'))) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
  }

  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }

  window.location.reload(true);
}

const updateSW = registerSW({
  onNeedRefresh() {
    console.log("[PWA] Nova versão do sistema detectada. Atualizando interface...");
    updateSW(true); 
  },
  onOfflineReady() {
    console.log("[PWA] Dedalos Tools pronto para uso offline.");
  },
  onRegisteredSW(swUrl, r) {
    console.log(`[PWA] Service Worker registrado em: ${swUrl}`);
    
    window.addEventListener('trigger-sw-update', async () => {
      if (r && !r.installing && !r.waiting) {
        console.log("[PWA] Verificando nova versão via Gatilho (Reconexão/Socket)...");
        try {
          await r.update();
        } catch (e) {
          console.warn("[PWA] Falha ao verificar update:", e);
        }
      }
    });
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)