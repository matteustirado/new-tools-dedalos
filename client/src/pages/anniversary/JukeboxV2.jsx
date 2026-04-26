import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const INACTIVITY_TIMEOUT_MS = 20000;
const MASTER_CODE = '0108';

const DAYS_TRANSLATION = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const SHORT_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const VALIDATION_API = {
  SP: import.meta.env.VITE_API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/",
  BH: import.meta.env.VITE_API_URL_BH || "https://dedalosadm2bh-09d55dca461e.herokuapp.com/"
};

const getTagInfo = (item) => {
  if (item.tipo === 'COMERCIAL_MANUAL' || item.is_commercial) {
    return { text: 'COMERCIAL', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' };
  }

  if (item.tipo === 'DJ_PEDIDO' || item.tipo === 'DJ') {
    return { text: 'DJ', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
  }

  if (item.unidade || item.tipo === 'JUKEBOX') {
    const u = (item.unidade || '').toUpperCase();
    if (u === 'BH') return { text: 'BH', color: 'bg-yellow-600/20 text-yellow-500 border border-yellow-600/30' };
    return { text: u || 'SP', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
  }

  return { text: 'PLAYLIST', color: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30' };
};

const getLogicalDayIndex = () => {
  const now = new Date();
  const hour = now.getHours();
  let day = now.getDay();
  if (hour < 6) {
    day = day === 0 ? 6 : day - 1;
  }
  return day;
};

const checkIsOffHours = () => {
  const h = new Date().getHours();
  return h >= 6 && h < 16;
};

const maskPhone = (value) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
  return v;
};

// CONSTANTES VISUAIS - GOLDEN ERA
const GOLDEN_GLASS = "bg-[#0a0a0a]/80 backdrop-blur-2xl border border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.1)]";
const GOLDEN_TEXT_GRADIENT = "bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600";

export default function JukeboxV2() {
  const { unidade } = useParams();
  const unitLabel = unidade ? unidade.toUpperCase() : 'SP';

  const [socket, setSocket] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [todasPlaylists, setTodasPlaylists] = useState([]);
  const [musicaAtual, setMusicaAtual] = useState(null);
  const [fila, setFila] = useState([]);
  const [activePlaylistId, setActivePlaylistId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isCodeError, setIsCodeError] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const [requestStatus, setRequestStatus] = useState('IDLE');
  const [refusalReason, setRefusalReason] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(getLogicalDayIndex());

  const [isOffHours, setIsOffHours] = useState(checkIsOffHours());
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [suggestionId, setSuggestionId] = useState(null);
  const [wantsNotification, setWantsNotification] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  const currentDayName = useMemo(() => DAYS_TRANSLATION[currentDayIndex], [currentDayIndex]);

  const playlistDoDia = useMemo(() => {
    if (!activePlaylistId || todasPlaylists.length === 0) return null;
    return todasPlaylists.find(p => p.id === activePlaylistId) || null;
  }, [activePlaylistId, todasPlaylists]);

  const validateCustomer = async (code) => {
    if (!code) return false;
    const cleanCode = code.toString().trim();

    if (cleanCode === MASTER_CODE) return true;

    const baseUrl = VALIDATION_API[unitLabel] || VALIDATION_API.SP;
    const rootUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const url = `${rootUrl}pesquisa/api/verificar_pulseira/?id=${cleanCode.toUpperCase()}`;

    try {
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      console.error(`Erro ao validar código na unidade ${unitLabel}:`, error);
      return false;
    }
  };

  const fetchTracks = () => {
    axios.get(`${API_URL}/api/tracks`)
      .then(res => {
        const validTracks = res.data.filter(t => t.status_processamento === 'PROCESSADO' && !t.is_commercial);
        setTracks(validTracks);
      })
      .catch(err => console.error("Erro ao atualizar lista de músicas:", err));
  };

  const resetForm = () => {
    setSearchTerm('');
    setCustomerCode('');
    setSelectedTrack(null);
    setIsCodeError(false);
    setRequestStatus('IDLE');
    setRefusalReason('');
    setShowDropdown(false);
    setSuggestionId(null);
    setWantsNotification(false);
    setPhoneNumber('');
    setPhoneSubmitted(false);

    if (checkIsOffHours()) {
      setIsUnlocked(false);
    }

    if (searchInputRef.current) searchInputRef.current.blur();
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      if (searchTerm || customerCode || selectedTrack || requestStatus !== 'IDLE' || (isOffHours && isUnlocked)) {
        resetForm();
      }
    }, INACTIVITY_TIMEOUT_MS);
  };

  useEffect(() => {
    const dayInterval = setInterval(() => {
      const newLogicalDay = getLogicalDayIndex();
      if (newLogicalDay !== currentDayIndex) {
        setCurrentDayIndex(newLogicalDay);
      }

      const currentOffHours = checkIsOffHours();
      if (currentOffHours !== isOffHours) {
        setIsOffHours(currentOffHours);
        if (currentOffHours) setIsUnlocked(false);
      }
    }, 60000);
    
    return () => clearInterval(dayInterval);
  }, [currentDayIndex, isOffHours]);

  useEffect(() => {
    const handleClickOrFocusOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOrFocusOutside);
    document.addEventListener('focusin', handleClickOrFocusOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOrFocusOutside);
      document.removeEventListener('focusin', handleClickOrFocusOutside);
    };
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    const handleActivity = () => resetInactivityTimer();
    
    events.forEach(event => window.addEventListener(event, handleActivity));
    resetInactivityTimer();
    
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [searchTerm, customerCode, selectedTrack, requestStatus, wantsNotification, isUnlocked, isOffHours]);

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    fetchTracks();

    axios.get(`${API_URL}/api/playlists`)
      .then(res => setTodasPlaylists(res.data || []))
      .catch(err => console.error("Erro ao carregar playlists:", err));

    newSocket.on('maestro:estadoCompleto', (estado) => {
      setMusicaAtual(estado.musicaAtual);
      setActivePlaylistId(estado.playlistAtualId || null);
    });

    newSocket.on('maestro:playlistAtualizada', (playlistId) => setActivePlaylistId(playlistId));
    newSocket.on('maestro:tocarAgora', ({ musicaInfo }) => setMusicaAtual(musicaInfo));
    newSocket.on('maestro:filaAtualizada', (novaFila) => setFila(novaFila || []));
    newSocket.on('acervo:atualizado', () => fetchTracks());

    newSocket.on('jukebox:pedidoAceito', ({ posicao }) => {
      setIsValidating(false);
      setRefusalReason(`Música enviada para a posição ${posicao} da fila! \nLembre-se: Você tem até 5 pedidos por ciclo.`);
      setRequestStatus('SUCCESS_REQUEST');
      setTimeout(() => resetForm(), 6000);
    });

    newSocket.on('jukebox:sugestaoAceita', (data) => {
      setIsValidating(false);
      setSuggestionId(data?.suggestionId || null);
      setRequestStatus('SUCCESS_SUGGESTION');
    });

    newSocket.on('jukebox:telefoneAtualizadoSucesso', () => {
      setPhoneSubmitted(true);
      setTimeout(() => resetForm(), 4000);
    });

    newSocket.on('jukebox:pedidoRecusado', ({ motivo }) => {
      setIsValidating(false);
      setRefusalReason(motivo || 'Pedido não pôde ser processado.');
      setRequestStatus('ERROR_REFUSED');
      setTimeout(() => resetForm(), 6000);
    });

    newSocket.on('jukebox:erroPedido', ({ message, isRateLimit }) => {
      setIsValidating(false);
      setRefusalReason(message || 'Erro desconhecido.');
      setRequestStatus(isRateLimit ? 'RATE_LIMIT' : 'ERROR_REFUSED');
      setTimeout(() => resetForm(), 8000);
    });

    return () => newSocket.disconnect();
  }, []);

  const availableTracks = useMemo(() => {
    let filtered = tracks;
    
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = tracks.filter(track =>
        track.titulo.toLowerCase().includes(lowerTerm) ||
        (track.artista && track.artista.toLowerCase().includes(lowerTerm))
      );
    }
    
    return filtered.sort((a, b) => {
      const aAvailable = Array.isArray(a.dias_semana) && a.dias_semana.includes(currentDayIndex) && !isOffHours;
      const bAvailable = Array.isArray(b.dias_semana) && b.dias_semana.includes(currentDayIndex) && !isOffHours;
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      return 0;
    });
  }, [tracks, searchTerm, currentDayIndex, isOffHours]);

  const topArtistasPlaylist = useMemo(() => {
    if (!playlistDoDia || !tracks.length) return [];
    let playlistTrackIds = playlistDoDia.tracks_ids;

    if (typeof playlistTrackIds === 'string') {
      try {
        playlistTrackIds = JSON.parse(playlistTrackIds);
      } catch (e) {
        playlistTrackIds = [];
      }
    }

    if (!Array.isArray(playlistTrackIds) || playlistTrackIds.length === 0) return [];

    const artistCount = {};
    playlistTrackIds.forEach(id => {
      const track = tracks.find(t => t.id == id);
      if (track && track.artista) {
        const mainArtist = track.artista.split(/,| feat\.|&/)[0].trim();
        if (mainArtist) artistCount[mainArtist] = (artistCount[mainArtist] || 0) + 1;
      }
    });

    return Object.entries(artistCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  }, [playlistDoDia, tracks]);

  const handleSelectTrack = (track) => {
    const isAvailableToday = Array.isArray(track.dias_semana) && track.dias_semana.includes(currentDayIndex) && !isOffHours;
    if (!isAvailableToday) return;

    setSelectedTrack(track);
    setSearchTerm(`${track.titulo} - ${track.artista}`);
    setIsCodeError(false);
    setShowDropdown(false);
  };

  const handleSubmit = async () => {
    setIsCodeError(false);
    setIsValidating(true);

    try {
      const isValid = await validateCustomer(customerCode);

      if (!isValid) {
        setIsCodeError(true);
        setIsValidating(false);
        return;
      }

      if (socket) {
        if (selectedTrack) {
          socket.emit('jukebox:adicionarPedido', {
            trackId: selectedTrack.id,
            pulseiraId: customerCode,
            unidade: unitLabel,
            titulo: selectedTrack.titulo,
            tipo: 'JUKEBOX'
          });
        } else {
          socket.emit('jukebox:enviarSugestao', {
            termo: searchTerm,
            pulseiraId: customerCode,
            unidade: unitLabel
          });
        }
      }
    } catch (error) {
      console.error(error);
      setIsValidating(false);
    }
  };

  const handleSavePhone = () => {
    if (socket && suggestionId && phoneNumber.length >= 14) {
      socket.emit('jukebox:atualizarTelefoneSugestao', {
        id: suggestionId,
        telefone: phoneNumber
      });
    } else {
      if (toast && toast.warning) toast.warning("Preencha o WhatsApp corretamente.");
    }
  };

  const playlistCoverUrl = useMemo(() => {
    if (!playlistDoDia?.imagem) return 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=2070&auto=format&fit=crop';
    return playlistDoDia.imagem.startsWith('http')
      ? playlistDoDia.imagem
      : `${API_URL}${playlistDoDia.imagem}`;
  }, [playlistDoDia]);

  // TELA DE HORÁRIO BLOQUEADO (GOLDEN ERA)
  if (isOffHours && !isUnlocked) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center animate-fade-in select-none relative overflow-hidden">
        {/* Glow de Fundo */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_rgba(234,179,8,0.15),_transparent_60%)] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[45vh] font-black text-yellow-500/[0.03] pointer-events-none z-0 tracking-tighter">7</div>

        <div className="flex justify-center mb-6 relative z-10">
          <svg className="w-44 h-44 drop-shadow-[0_0_30px_rgba(234,179,8,0.3)]" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z" fill="url(#gradient1)"/>
            <path d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z" fill="url(#gradient1)"/>
            <defs>
              <linearGradient id="gradient1" x1="0" y1="0" x2="600" y2="600">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <p className="text-lg text-white/80 max-w-xl leading-relaxed mb-4 relative z-10">
          Olá players, o horário para pedidos de músicas é de <br/>
          <span className="font-black text-3xl tracking-widest bg-black/60 px-6 py-2 rounded-xl inline-block mt-4 mb-2 border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600">16:00 ATÉ 06:00</span>
        </p>
        <p className="text-sm text-yellow-500/60 mb-10 max-w-lg relative z-10">
          Você pode conhecer nosso acervo de músicas e enviar sugestões clicando abaixo.
        </p>
        
        <button
          onClick={() => setIsUnlocked(true)}
          className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-400 text-black px-8 py-4 rounded-xl transition-all font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] relative z-10"
        >
          ACESSAR ACERVO E ENVIAR SUGESTÕES
        </button>
      </div>
    );
  }

  const renderFeedbackModal = () => {
    if (requestStatus === 'IDLE') return null;

    let icon = '';
    let colorClass = '';
    let title = '';
    let message = '';
    let buttonText = 'Voltar';

    switch (requestStatus) {
      case 'SUCCESS_REQUEST':
        icon = 'check_circle';
        colorClass = 'text-yellow-400 shadow-yellow-500/50 border-yellow-500/30';
        title = 'Pedido Confirmado!';
        message = refusalReason;
        break;
      case 'SUCCESS_SUGGESTION':
        icon = 'lightbulb';
        colorClass = 'text-yellow-300 shadow-yellow-300/50 border-yellow-300/30';
        title = 'Sugestão Enviada!';
        message = 'Obrigado! A sugestão foi enviada aos DJs e não consumiu seus pedidos.';
        break;
      case 'RATE_LIMIT':
        icon = 'hourglass_empty';
        colorClass = 'text-orange-400 shadow-orange-500/50 border-orange-500/30';
        title = 'Tempo de Espera';
        message = refusalReason;
        buttonText = 'Entendi';
        break;
      case 'ERROR_REFUSED':
        icon = 'cancel';
        colorClass = 'text-red-500 shadow-red-500/50 border-red-500/30';
        title = 'Pedido Não Aceito';
        message = refusalReason || 'Não foi possível adicionar esta música no momento.';
        buttonText = 'Tentar Outra';
        break;
      default:
        break;
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-lg animate-in fade-in duration-300">
        <div className={`${GOLDEN_GLASS} p-10 flex flex-col items-center text-center max-w-lg mx-4 transform scale-100 transition-all`}>
          
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-black/60 border ${colorClass.split(' ')[2]}`}>
            <span className={`material-symbols-outlined text-5xl ${colorClass.split(' ')[0]} drop-shadow-md`}>{icon}</span>
          </div>
          
          <h1 className={`text-3xl font-black mb-3 tracking-wide drop-shadow-sm ${requestStatus === 'ERROR_REFUSED' ? 'text-red-500' : GOLDEN_TEXT_GRADIENT}`}>
            {title}
          </h1>
          
          <p className="text-lg text-white/90 leading-relaxed font-medium whitespace-pre-line">
            {phoneSubmitted ? "Telefone salvo com sucesso!" : message}
          </p>

          {requestStatus === 'SUCCESS_SUGGESTION' && !phoneSubmitted && (
            <div className="mt-8 flex flex-col items-center w-full">
              {!wantsNotification ? (
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => setWantsNotification(true)}
                    className="w-full bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-400 text-black px-8 py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:scale-[1.02]"
                  >
                    <span className="material-symbols-outlined align-middle mr-2 text-xl">notifications_active</span>
                    Avise-me por WhatsApp
                  </button>
                  <button
                    onClick={resetForm}
                    className="w-full bg-black/40 text-yellow-500/50 px-8 py-3 rounded-2xl hover:bg-black/60 hover:text-yellow-500 transition-colors font-bold uppercase tracking-wider text-xs border border-yellow-500/20"
                  >
                    Não, obrigado
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full animate-fade-in bg-black/50 p-5 rounded-2xl border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
                  <label className="text-left text-xs font-bold text-yellow-500/60 uppercase tracking-widest ml-1">
                    Seu WhatsApp
                  </label>
                  <input 
                    type="tel"
                    className="w-full bg-black border border-yellow-500/30 rounded-xl py-3 px-4 text-xl text-yellow-400 placeholder:text-yellow-500/30 focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all text-center font-mono tracking-widest"
                    placeholder="(11) 99999-9999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(maskPhone(e.target.value))}
                    autoFocus
                  />
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => setWantsNotification(false)}
                      className="flex-1 bg-white/5 text-white/50 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors font-bold uppercase text-xs border border-transparent"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePhone}
                      disabled={phoneNumber.length < 14}
                      className="flex-[2] bg-gradient-to-r from-yellow-600 to-yellow-400 text-black px-4 py-3 rounded-xl transition-all font-black uppercase tracking-wider text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-600 disabled:text-zinc-400"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {requestStatus !== 'SUCCESS_SUGGESTION' && (
            <button
              onClick={resetForm}
              className="mt-8 bg-black/40 text-yellow-500 px-10 py-3 rounded-2xl hover:bg-black/60 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all font-bold uppercase tracking-widest text-sm border border-yellow-500/30 hover:scale-105 active:scale-95"
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-[#050505] p-8 flex flex-col overflow-hidden select-none text-white animate-fade-in relative">
      
      {/* EFEITOS DE FUNDO GOLDEN ERA */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(234,179,8,0.1),_transparent_70%)] pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-yellow-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/2 right-10 -translate-y-1/2 text-[45vh] font-black text-yellow-500/[0.02] pointer-events-none z-0 tracking-tighter">7</div>

      {renderFeedbackModal()}

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 relative z-10">
        <div className="col-span-5 flex flex-col gap-6 h-full min-h-0">
          
          {/* CARD DA MÚSICA ATUAL */}
          <div className={`${GOLDEN_GLASS} p-4 rounded-3xl relative overflow-hidden group flex-shrink-0`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 bg-black/60 border border-yellow-500/20 rounded-lg p-1">
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${unitLabel === 'SP' ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'text-yellow-500/30'}`}>SP</div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${unitLabel === 'BH' ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'text-yellow-500/30'}`}>BH</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-yellow-400 tracking-wider uppercase opacity-80">No Ar</span>
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 rounded-full border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.3)] overflow-hidden flex-shrink-0 bg-black relative flex items-center justify-center">
                <div className="w-full h-full animate-spin-slow flex items-center justify-center">
                  <img
                    src={musicaAtual?.thumbnail_url || 'https://placehold.co/150/111/333'}
                    className="w-full h-full object-cover scale-[1.7]"
                    alt="Vinil"
                  />
                </div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-500/20 to-transparent pointer-events-none z-10"></div>
                <div className="absolute w-2 h-2 bg-black rounded-full z-20 border border-yellow-500/40 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
              </div>
              <div className="min-w-0 pr-1">
                <p className={`text-xl font-black leading-tight line-clamp-2 drop-shadow-md ${GOLDEN_TEXT_GRADIENT}`}>
                  {musicaAtual?.titulo || 'Rádio Dedalos'}
                </p>
                <p className="text-yellow-500/80 text-xs font-bold mt-1 truncate tracking-wide">
                  {musicaAtual?.artista || 'Conectado'}
                </p>
              </div>
            </div>
          </div>

          {/* FILA DE PRÓXIMAS */}
          <div className={`${GOLDEN_GLASS} p-5 rounded-3xl flex-1 flex flex-col min-h-0`}>
            <h3 className="text-[10px] font-black text-yellow-500/50 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 border-b border-yellow-500/10 pb-2">
              <span className="material-symbols-outlined text-sm text-yellow-500/80">queue_music</span> Próximas na Fila
            </h3>

            <div className="flex-1 overflow-hidden space-y-2.5">
              {fila.slice(0, 5).map((item, idx) => {
                const tag = getTagInfo(item);
                return (
                  <div key={`${item.id}-${idx}`} className="flex items-center gap-3 p-2 bg-black/40 rounded-lg border border-yellow-500/10 hover:border-yellow-500/30 transition-colors">
                    <span className="text-yellow-500/40 font-black font-mono text-sm w-4 text-center">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white/90 font-bold text-sm truncate">{item.titulo}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-yellow-500/60 text-[10px] truncate max-w-[60%] font-medium">{item.artista || 'Desconhecido'}</p>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${tag.color}`}>
                          {tag.text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {fila.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-yellow-500">
                  <span className="material-symbols-outlined text-4xl mb-2">album</span>
                  <p className="text-xs text-center font-bold tracking-widest uppercase">Fila vazia.<br />O Palco é seu!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-7 flex flex-col gap-6 h-full min-h-0">
          
          {/* BUSCA E PEDIDO */}
          <div className={`${GOLDEN_GLASS} p-6 rounded-3xl flex-shrink-0 relative z-50`}>
            
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-2xl font-black flex items-center gap-2 ${GOLDEN_TEXT_GRADIENT}`}>
                <span className="material-symbols-outlined text-yellow-500 text-3xl">search</span> O que vamos ouvir?
              </h2>
              <span className="text-xs font-black bg-black/60 text-yellow-500/60 px-3 py-1 rounded-lg border border-yellow-500/20 tracking-widest uppercase">
                {searchTerm 
                  ? `${availableTracks.length} encontrados` 
                  : `${tracks.length} no acervo`}
              </span>
            </div>

            <div ref={searchContainerRef} className="relative mb-4">
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-black/50 border border-yellow-500/20 rounded-xl py-3 pl-5 pr-3 text-lg text-white placeholder:text-yellow-500/20 focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all shadow-inner"
                placeholder="Busque por música ou artista..."
                value={searchTerm}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                  if (selectedTrack) setSelectedTrack(null);
                }}
              />

              {searchTerm && !selectedTrack && showDropdown && availableTracks.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-yellow-500/30 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] z-20 overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                    {availableTracks.map(track => {
                      const isAvailableToday = Array.isArray(track.dias_semana) && track.dias_semana.includes(currentDayIndex) && !isOffHours;

                      return (
                        <div
                          key={track.id}
                          onClick={() => handleSelectTrack(track)}
                          className={`flex items-center gap-3 p-3 border-b border-yellow-500/10 last:border-0 transition-all ${isAvailableToday ? 'hover:bg-yellow-500/10 cursor-pointer' : 'opacity-30 cursor-not-allowed grayscale'}`}
                        >
                          <div className="w-10 h-10 rounded-md bg-black/50 border border-yellow-500/20 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            <img src={track.thumbnail_url} className="w-full h-full object-cover scale-[1.7]" alt="" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-bold truncate">{track.titulo}</p>
                            <p className="text-yellow-500/60 text-[11px] font-medium truncate">{track.artista}</p>
                          </div>

                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            {SHORT_DAYS.map((dayName, idx) => {
                              const isDayActive = Array.isArray(track.dias_semana) && track.dias_semana.includes(idx);
                              if (!isDayActive) return null;
                              const isToday = idx === currentDayIndex;
                              return (
                                <span
                                  key={idx}
                                  className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${isToday ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.2)]' : 'bg-black text-zinc-500 border-zinc-800'}`}
                                >
                                  {dayName}
                                </span>
                              );
                            })}
                          </div>

                          {isAvailableToday && (
                            <span className="material-symbols-outlined text-yellow-500 ml-3 text-lg font-bold">add_circle</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="w-36">
                <input
                  type="text"
                  inputMode="numeric"
                  className={`w-full bg-black/50 border rounded-xl py-3 px-2 text-xl text-white placeholder:text-yellow-500/20 focus:outline-none text-center font-mono font-black tracking-widest shadow-inner ${isCodeError ? 'border-red-500 animate-shake text-red-500' : 'border-yellow-500/20 focus:border-yellow-500 focus:shadow-[0_0_15px_rgba(234,179,8,0.2)]'}`}
                  placeholder="CÓDIGO"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!customerCode || isValidating}
                className={`flex-1 rounded-xl font-black tracking-widest uppercase text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedTrack ? 'bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)]' : 'bg-black/60 text-yellow-500 hover:bg-black/80 border border-yellow-500/30'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isValidating ? (
                  <span className="material-symbols-outlined animate-spin text-2xl">autorenew</span>
                ) : selectedTrack ? 'CONFIRMAR PEDIDO' : 'ENVIAR SUGESTÃO'}
              </button>
            </div>
          </div>

          {/* PLAYLIST DO DIA */}
          <div className={`${GOLDEN_GLASS} p-0 rounded-3xl flex-1 flex min-h-0 bg-black/40 overflow-hidden relative`}>
            <div className="absolute top-0 right-0 h-full aspect-square z-0 max-w-[50%] lg:max-w-none opacity-60 mix-blend-luminosity">
              <img
                src={playlistCoverUrl}
                alt="Capa da Playlist"
                className="w-full h-full object-cover object-center grayscale-[0.3] contrast-125 sepia-[0.3]"
                style={{
                  maskImage: 'linear-gradient(to right, transparent 0%, black 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 100%)',
                  aspectRatio: '1/1'
                }}
              />
            </div>
            <div className="relative z-20 flex-1 p-6 flex flex-col justify-center max-w-[70%]">
              <span className="inline-block px-3 py-1 rounded bg-black/80 text-yellow-500 text-[10px] font-black uppercase tracking-[0.2em] self-start mb-3 border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                PLAYLIST {currentDayName}
              </span>
              <h2 className={`text-3xl font-black leading-tight mb-2 drop-shadow-2xl truncate ${GOLDEN_TEXT_GRADIENT}`}>
                {playlistDoDia ? playlistDoDia.nome : 'Seleção Dédalos'}
              </h2>
              <p className="text-white/70 text-xs leading-relaxed line-clamp-2 mb-4 font-medium max-w-sm">
                {playlistDoDia ? playlistDoDia.descricao : 'Curadoria exclusiva em celebração à Era de Ouro.'}
              </p>
              {topArtistasPlaylist.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {topArtistasPlaylist.map((artista, i) => (
                    <span key={i} className="px-2 py-1 rounded bg-black border border-yellow-500/20 text-yellow-500/80 text-[9px] font-black uppercase tracking-wider shadow-md">
                      {artista}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-[10px] text-yellow-500/30 pb-0 tracking-widest font-medium uppercase relative z-10">
        <p>© 7 YEARS OF DEDALOS • DEVELOPED BY <span className="text-yellow-500/60 font-black">MATTEUS TIRADO</span></p>
      </div>

      <style>{`
        .animate-spin-slow { animation: spin 10s linear infinite; }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(234,179,8,0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(234,179,8,0.5); }
      `}</style>
    </div>
  );
}