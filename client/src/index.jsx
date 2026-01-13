import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

const updateSW = registerSW({
  onNeedRefresh() {
    console.log("Nova versão disponível! Atualizando...")
  },
  onOfflineReady() {
    console.log("App pronto para rodar offline/sem servidor!")
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)