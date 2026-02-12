import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const CROSSFADE_DURATION_MS = 4000; // Sincronizado com o Backend

// Configurações otimizadas para "TV Mode"
const playerOptions = {
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
    mute: 1, // Começa mutado para evitar bloqueio de autoplay, o script desmuta
  },
};

export default function WatchVideo() {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [radioState, setRadioState] = useState(null);
  const [currentTrackInfo, setCurrentTrackInfo] = useState(null);
  
  // Controle visual
  const [opacityA, setOpacityA] = useState(0);
  const [opacityB, setOpacityB] = useState(0);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [showTrackInfo, setShowTrackInfo] = useState(false);

  // Refs de Controle (Evita re-renders desnecessários)
  const playerARef = useRef(null);
  const playerBRef = useRef(null);
  const activePlayerIdRef = useRef(null); // 'A' ou 'B'
  const fadeFrameRef = useRef(null); // ID do requestAnimationFrame
  const socketRef = useRef(null);

  // ==========================================
  // ENGINE DE ÁUDIO (VOLUME FADER)
  // ==========================================
  
  // Interpolação linear suave usando requestAnimationFrame (60fps)
  const smoothFade = (playerOut, playerIn, duration) => {
    if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current);

    const startTime = performance.now();
    const startVolOut = playerOut ? playerOut.getVolume() : 0;
    const startVolIn = playerIn ? playerIn.getVolume() : 0;
    
    // Alvo: Out -> 0, In -> 100
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Curva Ease-In-Out para áudio mais natural
      // const ease = progress < .5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress; 
      // Linear é mais seguro para crossfade de DJ
      const ease = progress;

      if (playerOut && typeof playerOut.setVolume === 'function') {
        playerOut.setVolume(Math.max(0, startVolOut * (1 - ease)));
      }
      if (playerIn && typeof playerIn.setVolume === 'function') {
        playerIn.setVolume(Math.min(100, startVolIn + ((100 - startVolIn) * ease)));
      }

      if (progress < 1) {
        fadeFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Fim da transição
        if (playerOut) {
          playerOut.pauseVideo();
          playerOut.setVolume(0);
        }
        if (playerIn) {
          playerIn.setVolume(100);
        }
      }
    };

    fadeFrameRef.current = requestAnimationFrame(animate);
  };

  // ==========================================
  // LÓGICA DE EVENTOS (SOCKET)
  // ==========================================

  useEffect(() => {
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => console.log('[Watch] Conectado ao Maestro.'));

    socket.on('maestro:estadoCompleto', (estado) => {
      setRadioState(estado);
      syncState(estado);
      if (estado.overlayUrl) setOverlayUrl(`${API_URL}${estado.overlayUrl}`);
    });

    socket.on('maestro:tocarAgora', ({ player, musicaInfo }) => {
      console.log(`[Watch] Tocar Agora: ${musicaInfo.titulo} no Player ${player}`);
      setCurrentTrackInfo(musicaInfo);
      activePlayerIdRef.current = player;
      
      // Hard Cut (Troca imediata, sem fade lento)
      const targetPlayer = player === 'A' ? playerARef.current : playerBRef.current;
      const otherPlayer = player === 'A' ? playerBRef.current : playerARef.current;

      loadAndPlay(targetPlayer, musicaInfo, 0, false); // false = sem fade in
      if (otherPlayer) {
        otherPlayer.setVolume(0);
        otherPlayer.stopVideo();
      }

      // Visual
      if (player === 'A') { setOpacityA(1); setOpacityB(0); }
      else { setOpacityA(0); setOpacityB(1); }
    });

    socket.on('maestro:iniciarCrossfade', ({ playerAtivo, proximoPlayer, proximaMusica }) => {
      console.log(`[Watch] Iniciando Crossfade para: ${proximaMusica.titulo}`);
      setCurrentTrackInfo(proximaMusica); // Atualiza info visual antecipadamente
      
      const pOut = playerAtivo === 'A' ? playerARef.current : playerBRef.current;
      const pIn = proximoPlayer === 'A' ? playerARef.current : playerBRef.current;

      // Carrega o próximo já tocando (mute inicial é controlado no loadAndPlay)
      loadAndPlay(pIn, proximaMusica, 0, true); 
      
      // Inicia a transição de áudio
      smoothFade(pOut, pIn, CROSSFADE_DURATION_MS);

      // Inicia transição visual
      if (proximoPlayer === 'A') { setOpacityA(1); setOpacityB(0); }
      else { setOpacityA(0); setOpacityB(1); }
      
      activePlayerIdRef.current = proximoPlayer;
    });

    socket.on('maestro:pararTudo', () => {
      console.log('[Watch] Parar Tudo (Silêncio).');
      if (playerARef.current) playerARef.current.stopVideo();
      if (playerBRef.current) playerBRef.current.stopVideo();
      setOpacityA(0);
      setOpacityB(0);
      setCurrentTrackInfo(null);
    });

    socket.on('maestro:overlayAtualizado', (url) => setOverlayUrl(url ? `${API_URL}${url}` : null));

    return () => {
      if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current);
      socket.disconnect();
    };
  }, []);

  // ==========================================
  // CONTROLE DOS PLAYERS
  // ==========================================

  const loadAndPlay = (player, musica, startSeconds = 0, isCrossfading = false) => {
    if (!player || !musica) return;
    
    // Se o usuário ainda não interagiu, não podemos dar play com som
    if (!hasInteracted) {
        player.mute();
    }

    const videoId = musica.youtube_id;
    const start = musica.start_segundos || startSeconds;

    try {
      if (isCrossfading) {
        player.setVolume(0); // Garante que comece mudo para o fade in
      } else {
        player.setVolume(100);
      }
      
      player.loadVideoById({
        videoId: videoId,
        startSeconds: start
      });
      
      player.playVideo();
    } catch (e) {
      console.error("[Watch] Erro ao comandar player:", e);
    }
  };

  const syncState = (estado) => {
    if (!estado.musicaAtual) return;
    // Lógica para recuperar estado caso a TV seja recarregada no meio da música
    // (Implementação simplificada para focar na transição)
    setCurrentTrackInfo(estado.musicaAtual);
    activePlayerIdRef.current = estado.playerAtivo;

    const targetPlayer = estado.playerAtivo === 'A' ? playerARef.current : playerBRef.current;
    if (targetPlayer && hasInteracted) {
        // Se recarregou a página, retoma de onde o servidor diz
        const delayRede = 2; // Compensação de lag
        loadAndPlay(targetPlayer, estado.musicaAtual, estado.tempoAtualSegundos + delayRede);
        if (estado.playerAtivo === 'A') { setOpacityA(1); setOpacityB(0); }
        else { setOpacityA(0); setOpacityB(1); }
    }
  };

  // ==========================================
  // HANDLERS E TRATAMENTO DE ERRO
  // ==========================================

  const onPlayerReady = (evt, id) => {
    console.log(`[Watch] Player ${id} Pronto.`);
    if (id === 'A') playerARef.current = evt.target;
    else playerBRef.current = evt.target;
    
    // Se já tinha estado carregado antes do player estar pronto
    if (radioState && radioState.playerAtivo === id && hasInteracted) {
        syncState(radioState);
    }
  };

  const onPlayerError = (evt, id) => {
    console.error(`[Watch] ERRO CRÍTICO no Player ${id}. Código: ${evt.data}`);
    // Códigos: 2 (inválido), 100 (removido), 101/150 (não embedável)
    // Ação: Pular música imediatamente
    if (socketRef.current) {
        console.warn("[Watch] Solicitando pulo de emergência ao Maestro...");
        socketRef.current.emit('dj:pularMusica');
    }
  };

  const onStateChange = (evt) => {
    // 0 = Ended, 1 = Playing, 2 = Paused, 3 = Buffering
    if (evt.data === 1 && !hasInteracted) {
        // Se tentar tocar sem interação, o browser pode bloquear o som.
        // O mute inicial ajuda, mas aqui monitoramos.
    }
  };

  const handleInteraction = () => {
    setHasInteracted(true);
    // Destrava o áudio context do navegador tocando um silêncio
    const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA==");
    audio.play().catch(e => console.log("Audio unlock failed", e));
    
    // Se já havia música tentando tocar, força o play agora
    if (radioState && radioState.musicaAtual) {
        syncState(radioState);
    }
  };

  // ==========================================
  // INTERFACE VISUAL (OVERLAY)
  // ==========================================

  // Monitora tempo para mostrar Info da música (Intro/Outro)
  useEffect(() => {
    const infoInterval = setInterval(async () => {
        const active = activePlayerIdRef.current === 'A' ? playerARef.current : playerBRef.current;
        if (active && typeof active.getCurrentTime === 'function') {
            try {
                const t = await active.getCurrentTime();
                const total = await active.getDuration();
                // Mostra nos primeiros 15s e últimos 15s
                const show = t < 15 || (total > 0 && t > total - 15);
                setShowTrackInfo(show);
            } catch (e) {}
        }
    }, 1000);
    return () => clearInterval(infoInterval);
  }, []);

  const getArtistDisplay = () => {
    if (!currentTrackInfo) return '';
    let text = currentTrackInfo.artista || '';
    if (currentTrackInfo.artistas_participantes?.length > 0) text += ` feat. ${currentTrackInfo.artistas_participantes.join(', ')}`;
    return text;
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden cursor-none font-display">
      
      {/* Tela de Bloqueio / Interação Inicial */}
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

      {/* Marca D'água Global */}
      {overlayUrl && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center animate-fade-in">
          <img src={overlayUrl} alt="Overlay" className="w-full h-full object-contain opacity-90" />
        </div>
      )}

      {/* Info da Música (Lower Third) */}
      <div className={`absolute bottom-20 left-16 z-40 pointer-events-none transition-all duration-1000 ease-out transform ${showTrackInfo && currentTrackInfo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
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
            {/* Metadados Extras (Opcional) */}
            {(currentTrackInfo.album || currentTrackInfo.gravadora) && (
               <div className="flex gap-2 mt-1 ml-1 opacity-80">
                  {currentTrackInfo.album && <span className="bg-black/50 text-white/80 text-xs px-2 py-0.5 rounded uppercase font-bold tracking-widest">{currentTrackInfo.album}</span>}
                  {currentTrackInfo.gravadora && <span className="bg-primary/50 text-white/90 text-xs px-2 py-0.5 rounded uppercase font-bold tracking-widest">{currentTrackInfo.gravadora}</span>}
               </div>
            )}
          </div>
        )}
      </div>

      {/* Players do YouTube (Double Buffering) */}
      <div className="absolute inset-0 w-full h-full bg-black">
        {/* Player A */}
        <div className="absolute inset-0 w-full h-full transition-opacity duration-1000" style={{ opacity: opacityA, zIndex: opacityA > 0 ? 10 : 0 }}>
            <YouTube 
                videoId={null} // Carregado via API
                opts={playerOptions} 
                onReady={(e) => onPlayerReady(e, 'A')} 
                onError={(e) => onPlayerError(e, 'A')}
                onStateChange={onStateChange}
                className="w-full h-full"
            />
        </div>

        {/* Player B */}
        <div className="absolute inset-0 w-full h-full transition-opacity duration-1000" style={{ opacity: opacityB, zIndex: opacityB > 0 ? 10 : 0 }}>
            <YouTube 
                videoId={null} 
                opts={playerOptions} 
                onReady={(e) => onPlayerReady(e, 'B')} 
                onError={(e) => onPlayerError(e, 'B')}
                onStateChange={onStateChange}
                className="w-full h-full"
            />
        </div>
      </div>

    </div>
  );
}