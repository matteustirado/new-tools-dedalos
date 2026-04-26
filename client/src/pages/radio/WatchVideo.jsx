import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TARGET_LUFS = -14;

const getPlayerOptions = () => ({
  height: '100%',
  width: '100%',
  playerVars: {
    autoplay: 1,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    mute: 1,
    enablejsapi: 1,
    origin: window.location.origin,
  },
});

const calculateTargetVolume = (lufsValue) => {
  if (lufsValue == null || isNaN(lufsValue)) return 100;
  
  const gainDb = TARGET_LUFS - lufsValue;
  const targetVolume = Math.pow(10, gainDb / 20) * 100;
  
  return Math.round(Math.min(100, Math.max(0, targetVolume)));
};

export default function WatchVideo() {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [radioState, setRadioState] = useState(null);
  const [currentTrackInfo, setCurrentTrackInfo] = useState(null);
  const [opacityA, setOpacityA] = useState(0);
  const [opacityB, setOpacityB] = useState(0);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [showTrackInfo, setShowTrackInfo] = useState(false);

  const hasInteractedRef = useRef(false);
  const playerARef = useRef(null);
  const playerBRef = useRef(null);
  const activePlayerIdRef = useRef(null);
  const socketRef = useRef(null);
  const cuedVideoRefA = useRef(null);
  const cuedVideoRefB = useRef(null);

  useEffect(() => {
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
    });
    
    socketRef.current = socket;

    socket.on('maestro:estadoCompleto', (estado) => {
      setRadioState(estado);
      syncState(estado);
      if (estado.overlayUrl) setOverlayUrl(`${API_URL}${estado.overlayUrl}`);
    });

    socket.on('maestro:prepararProxima', ({ playerBackground, proximaMusica }) => {
      const pBg = playerBackground === 'A' ? playerARef.current : playerBRef.current;
      const targetCuedRef = playerBackground === 'A' ? cuedVideoRefA : cuedVideoRefB;

      if (pBg && proximaMusica?.youtube_id) {
        pBg.mute();
        pBg.cueVideoById({
          videoId: proximaMusica.youtube_id,
          startSeconds: proximaMusica.start_segundos || 0
        });
        targetCuedRef.current = proximaMusica.youtube_id;
      }
    });

    socket.on('maestro:tocarAgora', ({ player, musicaInfo }) => {
      setCurrentTrackInfo(musicaInfo);
      activePlayerIdRef.current = player;

      const targetPlayer = player === 'A' ? playerARef.current : playerBRef.current;
      const otherPlayer = player === 'A' ? playerBRef.current : playerARef.current;
      const targetCuedRef = player === 'A' ? cuedVideoRefA : cuedVideoRefB;

      if (otherPlayer) {
        otherPlayer.setVolume(0);
        otherPlayer.stopVideo();
      }

      if (targetPlayer) {
        if (hasInteractedRef.current) targetPlayer.unMute();
        targetPlayer.setVolume(calculateTargetVolume(musicaInfo.loudness_lufs));

        if (targetCuedRef.current === musicaInfo.youtube_id) {
            targetPlayer.playVideo();
        } else {
            targetPlayer.loadVideoById({
                videoId: musicaInfo.youtube_id,
                startSeconds: musicaInfo.start_segundos || 0
            });
            targetPlayer.playVideo();
        }
        
        targetCuedRef.current = null;
      }

      setOpacityA(player === 'A' ? 1 : 0);
      setOpacityB(player === 'B' ? 1 : 0);
    });

    socket.on('maestro:pararTudo', () => {
      if (playerARef.current) playerARef.current.stopVideo();
      if (playerBRef.current) playerBRef.current.stopVideo();
      
      setOpacityA(0);
      setOpacityB(0);
      setCurrentTrackInfo(null);
    });

    socket.on('maestro:overlayAtualizado', (url) =>
      setOverlayUrl(url ? `${API_URL}${url}` : null)
    );

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const infoInterval = setInterval(async () => {
      const active = activePlayerIdRef.current === 'A' ? playerARef.current : playerBRef.current;

      if (active && typeof active.getCurrentTime === 'function') {
        try {
          const t = await active.getCurrentTime();
          const total = await active.getDuration();
          const show = t < 15 || (total > 0 && t > total - 15);
          setShowTrackInfo(show);
        } catch (e) {}
      }
    }, 1000);

    return () => clearInterval(infoInterval);
  }, []);

  const syncState = (estado) => {
    if (!estado.musicaAtual) return;

    setCurrentTrackInfo(estado.musicaAtual);
    activePlayerIdRef.current = estado.playerAtivo;

    const targetPlayer = estado.playerAtivo === 'A' ? playerARef.current : playerBRef.current;

    if (targetPlayer && hasInteractedRef.current) {
      const delayRede = 2;
      
      targetPlayer.unMute();
      targetPlayer.setVolume(calculateTargetVolume(estado.musicaAtual.loudness_lufs));
      targetPlayer.loadVideoById({
        videoId: estado.musicaAtual.youtube_id,
        startSeconds: (estado.musicaAtual.start_segundos || 0) + estado.tempoAtualSegundos + delayRede,
      });
      targetPlayer.playVideo();

      if (estado.playerAtivo === 'A') {
        setOpacityA(1);
        setOpacityB(0);
      } else {
        setOpacityA(0);
        setOpacityB(1);
      }
    }
  };

  const onPlayerReady = (evt, id) => {
    if (id === 'A') playerARef.current = evt.target;
    else playerBRef.current = evt.target;

    if (radioState && radioState.playerAtivo === id && hasInteractedRef.current) {
      syncState(radioState);
    }
  };

  const onPlayerError = (evt, id) => {
    console.error(`[Watch] ERRO CRÍTICO no Player ${id}. Código: ${evt.data}`);
    if (socketRef.current) socketRef.current.emit('dj:pularMusica');
  };

  const handleInteraction = () => {
    hasInteractedRef.current = true; 
    setHasInteracted(true);

    const audio = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA=='
    );
    audio.play().catch(() => {});

    if (radioState && radioState.musicaAtual) {
      syncState(radioState);
    }
  };

  const getArtistDisplay = () => {
    if (!currentTrackInfo) return '';
    
    let text = currentTrackInfo.artista || '';
    
    if (currentTrackInfo.artistas_participantes?.length > 0) {
      text += ` feat. ${currentTrackInfo.artistas_participantes.join(', ')}`;
    }
    
    return text;
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden cursor-none font-display">
      {!hasInteracted && (
        <div
          onClick={handleInteraction}
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 cursor-pointer transition-all duration-700 backdrop-blur-md"
        >
          <div className="animate-pulse flex flex-col items-center">
            <span className="material-symbols-outlined text-9xl text-primary mb-6">play_circle</span>
            <h1 className="text-4xl font-bold text-white tracking-widest uppercase">Toque para Iniciar</h1>
            <p className="text-white/50 mt-4 text-sm font-mono">Sincronizando com Rádio Dedalos...</p>
          </div>
        </div>
      )}

      {overlayUrl && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center animate-fade-in">
          <img src={overlayUrl} alt="Overlay" className="w-full h-full object-contain opacity-90" />
        </div>
      )}

      <div
        className={`absolute bottom-20 left-16 z-40 pointer-events-none transition-all duration-1000 ease-out transform ${
          showTrackInfo && currentTrackInfo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
      >
        {currentTrackInfo && (
          <div className="flex flex-col items-start space-y-1">
            <div className="bg-black/80 backdrop-blur-md px-8 py-3 rounded-r-full border-l-4 border-primary shadow-2xl">
              <h1 className="text-white text-4xl font-black font-display uppercase tracking-wider drop-shadow-lg leading-none">
                {currentTrackInfo.titulo}
              </h1>
            </div>

            {(currentTrackInfo.artista || currentTrackInfo.artistas_participantes) && (
              <div className="bg-white/90 backdrop-blur-md px-6 py-2 rounded-r-full border-l-4 border-black shadow-xl mt-2">
                <p className="text-black text-2xl font-bold uppercase tracking-wide">
                  {getArtistDisplay()}
                </p>
              </div>
            )}

            {(currentTrackInfo.album || currentTrackInfo.gravadora) && (
              <div className="flex gap-2 mt-1 ml-1 opacity-80">
                {currentTrackInfo.album && (
                  <span className="bg-black/50 text-white/80 text-xs px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                    {currentTrackInfo.album}
                  </span>
                )}
                {currentTrackInfo.gravadora && (
                  <span className="bg-primary/50 text-white/90 text-xs px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                    {currentTrackInfo.gravadora}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute inset-0 w-full h-full bg-black pointer-events-none">
        <div
          className="absolute inset-0 w-full h-full transition-opacity duration-300 pointer-events-none"
          style={{ opacity: opacityA, zIndex: opacityA > 0 ? 10 : 0 }}
        >
          <YouTube
            videoId="M7lc1UVf-VE"
            opts={getPlayerOptions()}
            onReady={(e) => onPlayerReady(e, 'A')}
            onError={(e) => onPlayerError(e, 'A')}
            className="w-full h-full pointer-events-none"
          />
        </div>

        <div
          className="absolute inset-0 w-full h-full transition-opacity duration-300 pointer-events-none"
          style={{ opacity: opacityB, zIndex: opacityB > 0 ? 10 : 0 }}
        >
          <YouTube
            videoId="M7lc1UVf-VE"
            opts={getPlayerOptions()}
            onReady={(e) => onPlayerReady(e, 'B')}
            onError={(e) => onPlayerError(e, 'B')}
            className="w-full h-full pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}