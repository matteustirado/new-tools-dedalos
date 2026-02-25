import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.dedalosbar.com';

const ConnectionGuardian = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    socket.on('connect', () => {
      setIsOffline(false);
      setRetryAttempt(0);
      
      window.dispatchEvent(new Event('trigger-sw-update'));
    });

    socket.on('system:forceUpdate', () => {
      window.dispatchEvent(new Event('trigger-sw-update'));
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
        setIsOffline(true);
      }
    });

    socket.on('connect_error', () => {
      setIsOffline(true);
      setRetryAttempt(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <>
      {children}
      
      {isOffline && (
        <div style={styles.overlay}>
          <div style={styles.content}>
            <div className="guardian-spinner"></div>
            <h1 style={styles.title}>Conexão Perdida</h1>
            <p style={styles.text}>Tentando reconectar ao servidor Dedalos...</p>
            <p style={styles.subtext}>Tentativa #{retryAttempt}</p>
            <p style={styles.subtext}>O sistema voltará automaticamente.</p>
          </div>

          <style>{`
            .guardian-spinner {
              width: 50px;
              height: 50px;
              border: 4px solid rgba(255, 255, 255, 0.1);
              border-radius: 50%;
              border-top-color: #ef4444;
              animation: guardianSpin 1s ease-in-out infinite;
              margin-bottom: 20px;
            }
            @keyframes guardianSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.90)',
    backdropFilter: 'blur(10px)',
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
    background: '#1a1a1a',
    padding: '40px',
    borderRadius: '20px',
    border: '1px solid #333',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 10px 0',
    color: '#ef4444'
  },
  text: {
    fontSize: '16px',
    opacity: 0.9,
    marginBottom: '5px'
  },
  subtext: {
    fontSize: '13px',
    color: '#888',
    marginTop: '5px',
  }
};

export default ConnectionGuardian;