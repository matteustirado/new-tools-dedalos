import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ConnectionGuardian = ({ onConnectionRestored }) => {
  const [isOffline, setIsOffline] = useState(false);
  const failureCount = useRef(0); 
  const apiUrl = import.meta.env.VITE_API_URL || 'https://api.dedalosbar.com';

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // ADICIONADO: Headers de bypass e timestamp para evitar cache do Service Worker
        await axios.get(`${apiUrl}/api/tracks`, { 
          timeout: 5000, 
          params: { 
              limit: 1,
              _: Date.now() // Força URL única a cada requisição (Cache Busting)
          },
          headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
          }
        });

        failureCount.current = 0;

        if (isOffline) {
          setIsOffline(false);
          if (onConnectionRestored) {
            onConnectionRestored();
          }
        }
      } catch (error) {
        // Logs para debug no console (pode remover depois)
        console.warn("[Guardian] Falha de conexão:", error.message);

        // Se for erro de rede, timeout ou resposta indefinida (erro do Workbox)
        if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response) {
            failureCount.current += 1; 

            // Tolerância: 3 falhas seguidas (aprox 9s)
            if (!isOffline && failureCount.current >= 3) {
                console.error("[Guardian] Sistema Offline detectado.");
                setIsOffline(true);
            }
        }
      }
    };

    const interval = setInterval(checkConnection, 3000);

    return () => clearInterval(interval);
  }, [isOffline, apiUrl, onConnectionRestored]);

  if (!isOffline) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <div className="guardian-spinner"></div>
        <h1 style={styles.title}>Reconectando...</h1>
        <p style={styles.text}>Aguardando o servidor voltar.</p>
        <p style={styles.subtext}>Não atualize a página.</p>
        {/* Botão de emergência caso o Service Worker trave tudo */}
        <button 
            onClick={() => window.location.reload()} 
            style={{marginTop: 20, padding: '10px 20px', background: 'transparent', border: '1px solid #fff', color: '#fff', borderRadius: 5, cursor: 'pointer'}}
        >
            Forçar Recarregamento
        </button>
      </div>

      <style>{`
        .guardian-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          border-top-color: #00d2ff;
          animation: guardianSpin 1s ease-in-out infinite;
          margin-bottom: 20px;
        }
        @keyframes guardianSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.3s ease',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: '"Poppins", sans-serif',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 10px 0',
  },
  text: {
    fontSize: '16px',
    opacity: 0.9,
  },
  subtext: {
    fontSize: '13px',
    color: '#666',
    marginTop: '10px',
  }
};

export default ConnectionGuardian;