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
    return { text: 'COMERCIAL', color: 'bg-orange-500/20 text-orange-400' };
  }

  if (item.tipo === 'DJ_PEDIDO' || item.tipo === 'DJ') {
    return { text: 'DJ', color: 'bg-blue-500/20 text-blue-400' };
  }

  if (item.unidade || item.tipo === 'JUKEBOX') {
    const u = (item.unidade || '').toUpperCase();
    if (u === 'BH') return { text: 'BH', color: 'bg-yellow-500/20 text-yellow-400' };
    return { text: u || 'SP', color: 'bg-green-500/20 text-green-400' };
  }

  return { text: 'PLAYLIST', color: 'bg-purple-500/20 text-purple-400' };
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

export default function Jukebox() {
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
      setRefusalReason(`Música enviada para a posição ${posicao} da fila! \nLembre-se: Você tem até 5 pedidos por ciclo de 30 minutos.`);
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

  if (isOffHours && !isUnlocked) {
    return (
      <div className="h-screen w-screen bg-gradient-warm flex flex-col items-center justify-center p-8 text-center animate-fade-in select-none">
        <div className="flex justify-center mb-6">
          <svg className="w-44 h-44 drop-shadow-2xl" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z" fill="url(#gradient1)"/>
            <path d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z" fill="url(#gradient1)"/>
            <defs>
              <linearGradient id="gradient1" x1="0" y1="0" x2="600" y2="600">
                <stop offset="0%" stopColor="#ff4d00" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <p className="text-lg text-white/80 max-w-xl leading-relaxed mb-4">
          Olá players, o horário para pedidos de músicas é de <br/>
          <span className="text-primary font-black text-3xl tracking-widest bg-black/40 px-6 py-2 rounded-xl inline-block mt-4 mb-2 border border-primary/30 shadow-lg">16:00 ATÉ 06:00</span>
        </p>
        <p className="text-sm text-white/60 mb-10 max-w-lg">
          Você pode conhecer nosso acervo de músicas e enviar sugestões clicando abaixo.
        </p>
        
        <button
          onClick={() => setIsUnlocked(true)}
          className="bg-primary hover:bg-red-600 text-white px-8 py-4 rounded-xl transition-all font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-[1.02]"
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
        colorClass = 'text-green-500 shadow-green-500/50';
        title = 'Pedido Confirmado!';
        message = refusalReason;
        break;
      case 'SUCCESS_SUGGESTION':
        icon = 'lightbulb';
        colorClass = 'text-yellow-400 shadow-yellow-400/50';
        title = 'Sugestão Enviada!';
        message = 'Obrigado! A sugestão foi enviada aos DJs e não consumiu seus pedidos.';
        break;
      case 'RATE_LIMIT':
        icon = 'hourglass_empty';
        colorClass = 'text-orange-500 shadow-orange-500/50';
        title = 'Tempo de Espera';
        message = refusalReason;
        buttonText = 'Entendi';
        break;
      case 'ERROR_REFUSED':
        icon = 'cancel';
        colorClass = 'text-red-500 shadow-red-500/50';
        title = 'Pedido Não Aceito';
        message = refusalReason || 'Não foi possível adicionar esta música no momento.';
        buttonText = 'Tentar Outra';
        break;
      default:
        break;
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="liquid-glass border border-white/20 p-10 rounded-[2.5rem] flex flex-col items-center text-center max-w-lg mx-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform scale-100 transition-all">
          
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg bg-black/30 border border-white/10 ${colorClass.split(' ')[1]}`}>
            <span className={`material-symbols-outlined text-5xl ${colorClass.split(' ')[0]} drop-shadow-md`}>{icon}</span>
          </div>
          
          <h1 className="text-3xl font-black text-white mb-3 tracking-wide drop-shadow-sm">
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
                    className="w-full bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-[1.02]"
                  >
                    <span className="material-symbols-outlined align-middle mr-2 text-xl">notifications_active</span>
                    Avise-me por WhatsApp
                  </button>
                  <button
                    onClick={resetForm}
                    className="w-full bg-white/5 text-white/50 px-8 py-3 rounded-2xl hover:bg-white/10 hover:text-white transition-colors font-bold uppercase tracking-wider text-xs border border-white/10"
                  >
                    Não, obrigado
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full animate-fade-in bg-black/30 p-5 rounded-2xl border border-white/10">
                  <label className="text-left text-xs font-bold text-white/60 uppercase tracking-widest ml-1">
                    Seu WhatsApp
                  </label>
                  <input 
                    type="tel"
                    className="w-full bg-black/50 border border-white/20 rounded-xl py-3 px-4 text-xl text-white placeholder:text-white/30 focus:outline-none focus:border-green-500 transition-colors text-center font-mono tracking-widest"
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
                      className="flex-[2] bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-500 transition-colors font-black uppercase tracking-wider text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="mt-8 bg-white/10 text-white px-10 py-3 rounded-2xl hover:bg-white/20 transition-all font-bold uppercase tracking-widest text-sm border border-white/20 hover:scale-105 active:scale-95"
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-gradient-warm p-8 flex flex-col overflow-hidden select-none text-white animate-fade-in relative">
      
      {renderFeedbackModal()}

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        <div className="col-span-5 flex flex-col gap-6 h-full min-h-0">
          <div className="liquid-glass p-4 rounded-3xl relative overflow-hidden group flex-shrink-0">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1">
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${unitLabel === 'SP' ? 'bg-primary text-white shadow-lg' : 'text-white/30'}`}>SP</div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${unitLabel === 'BH' ? 'bg-primary text-white shadow-lg' : 'text-white/30'}`}>BH</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-green-400 tracking-wider uppercase opacity-80">No Ar</span>
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_8px_#4ade80]"></span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div className="w-14 h-14 rounded-full border-2 border-white/10 shadow-xl overflow-hidden flex-shrink-0 bg-black relative flex items-center justify-center">
                <div className="w-full h-full animate-spin-slow flex items-center justify-center">
                  <img
                    src={musicaAtual?.thumbnail_url || 'https://placehold.co/150/111/333'}
                    className="w-full h-full object-cover scale-[1.7]"
                    alt="Vinil"
                  />
                </div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-10"></div>
                <div className="absolute w-1.5 h-1.5 bg-black rounded-full z-20 border border-white/20"></div>
              </div>
              <div className="min-w-0 pr-1">
                <p className="text-white text-base font-bold leading-tight line-clamp-2 drop-shadow-md">
                  {musicaAtual?.titulo || 'Rádio Dedalos'}
                </p>
                <p className="text-primary text-xs font-bold mt-0.5 truncate">
                  {musicaAtual?.artista || 'Conectado'}
                </p>
              </div>
            </div>
          </div>

          <div className="liquid-glass p-4 rounded-3xl flex-1 flex flex-col min-h-0">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">queue_music</span> Próximas
            </h3>

            <div className="flex-1 overflow-hidden space-y-2">
              {fila.slice(0, 5).map((item, idx) => {
                const tag = getTagInfo(item);
                return (
                  <div key={`${item.id}-${idx}`} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5 shadow-sm">
                    <span className="text-white/20 font-mono text-xs w-3 text-center">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-xs truncate">{item.titulo}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-white/40 text-[9px] truncate max-w-[60%]">{item.artista || 'Desconhecido'}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${tag.color}`}>
                          {tag.text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {fila.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <span className="material-symbols-outlined text-3xl mb-1">playlist_add</span>
                  <p className="text-[10px] text-center">Fila vazia.<br />Peça sua música!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-7 flex flex-col gap-6 h-full min-h-0">
          <div className="liquid-glass p-5 rounded-3xl shadow-lg flex-shrink-0 relative z-50">
            
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">search</span> Pedir Música
              </h2>
              <span className="text-[10px] font-bold bg-white/10 text-white/50 px-2 py-1 rounded-lg border border-white/5">
                {searchTerm 
                  ? `${availableTracks.length} resultados` 
                  : `${tracks.length} no acervo`}
              </span>
            </div>

            <div ref={searchContainerRef} className="relative mb-3">
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-black/30 border border-white/10 rounded-xl py-2 pl-4 pr-3 text-base text-white placeholder:text-white/30 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="Buscar música ou artista..."
                value={searchTerm}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                  if (selectedTrack) setSelectedTrack(null);
                }}
              />

              {searchTerm && !selectedTrack && showDropdown && availableTracks.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                    {availableTracks.map(track => {
                      const isAvailableToday = Array.isArray(track.dias_semana) && track.dias_semana.includes(currentDayIndex) && !isOffHours;

                      return (
                        <div
                          key={track.id}
                          onClick={() => handleSelectTrack(track)}
                          className={`flex items-center gap-3 p-3 border-b border-white/5 last:border-0 transition-all ${isAvailableToday ? 'hover:bg-white/10 cursor-pointer' : 'opacity-40 cursor-not-allowed grayscale-[0.5]'}`}
                        >
                          <div className="w-8 h-8 rounded-md bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            <img src={track.thumbnail_url} className="w-full h-full object-cover scale-[1.7]" alt="" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate">{track.titulo}</p>
                            <p className="text-white/40 text-[10px] truncate">{track.artista}</p>
                          </div>

                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            {SHORT_DAYS.map((dayName, idx) => {
                              const isDayActive = Array.isArray(track.dias_semana) && track.dias_semana.includes(idx);
                              if (!isDayActive) return null;
                              const isToday = idx === currentDayIndex;
                              return (
                                <span
                                  key={idx}
                                  className={`text-[8px] font-bold px-1 py-0.5 rounded border ${isToday ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(74,222,128,0.2)]' : 'bg-white/5 text-white/30 border-white/10'}`}
                                >
                                  {dayName}
                                </span>
                              );
                            })}
                          </div>

                          {isAvailableToday && (
                            <span className="material-symbols-outlined text-primary ml-2 text-sm">add</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <div className="w-32">
                <input
                  type="text"
                  inputMode="numeric"
                  className={`w-full bg-black/30 border rounded-xl py-2 px-2 text-lg text-white placeholder:text-white/20 focus:outline-none text-center font-mono tracking-widest ${isCodeError ? 'border-red-500 animate-shake' : 'border-white/10 focus:border-primary'}`}
                  placeholder="CÓDIGO"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!customerCode || isValidating}
                className={`flex-1 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedTrack ? 'bg-gradient-to-r from-primary to-orange-600 text-white hover:shadow-primary/40' : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isValidating ? (
                  <span className="material-symbols-outlined animate-spin text-xl">refresh</span>
                ) : selectedTrack ? 'PEDIR MÚSICA' : 'ENVIAR SUGESTÃO'}
              </button>
            </div>
          </div>

          <div className="liquid-glass p-0 rounded-3xl flex-1 flex min-h-0 h-40 lg:h-auto bg-[#0e0e0e] border border-white/5 overflow-hidden relative">
            <div className="absolute top-0 right-0 h-full aspect-square z-0 max-w-[50%] lg:max-w-none">
              <img
                src={playlistCoverUrl}
                alt="Capa da Playlist"
                className="w-full h-full object-cover object-center"
                style={{
                  maskImage: 'linear-gradient(to right, transparent 0%, black 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 100%)',
                  aspectRatio: '1/1'
                }}
              />
            </div>
            <div className="relative z-20 flex-1 p-5 flex flex-col justify-center max-w-[70%]">
              <span className="inline-block px-2 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-bold uppercase tracking-widest self-start mb-2 border border-primary/20">
                {currentDayName}
              </span>
              <h2 className="text-xl font-bold text-white leading-tight mb-2 drop-shadow-lg truncate">
                {playlistDoDia ? playlistDoDia.nome : 'Seleção Especial'}
              </h2>
              <p className="text-white/80 text-[10px] leading-relaxed line-clamp-2 mb-3 drop-shadow-md">
                {playlistDoDia ? playlistDoDia.descricao : 'Curadoria exclusiva para sua noite.'}
              </p>
              {topArtistasPlaylist.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {topArtistasPlaylist.map((artista, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-white/90 text-[8px] font-bold uppercase tracking-wide shadow-sm">
                      {artista}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-[10px] text-text-muted pb-0">
        <p>© Developed by: <span className="text-primary font-semibold">Matteus Tirado</span></p>
      </div>

      <style>{`
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}