import { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { Disc3, Volume2, VolumeX, SkipForward, Play, Search, PlusCircle, Trash2, ListMusic, Mic, QrCode } from 'lucide-react';
import api from '../services/api';

const getLogicalDayIndex = () => {
  const now = new Date();
  const hour = now.getHours();
  let day = now.getDay();
  if (hour < 6) day = day === 0 ? 6 : day - 1;
  return day;
};

const formatDuration = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const AlbumArtVinyl = ({ musicaAtual }) => {
  const thumbnailUrl = musicaAtual?.thumbnail_url;

  return (
    <div className="relative w-56 md:w-64 lg:w-72 aspect-video shrink-0 mx-auto md:mx-0 md:mr-24 lg:mr-28">
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[95%] aspect-square rounded-full transition-all duration-700 ease-out"
        style={{
          right: musicaAtual ? '-28%' : '10%',
          opacity: musicaAtual ? 1 : 0.4,
          zIndex: 0
        }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/5"
          style={{
            background: 'conic-gradient(from 0deg, #0a0a0a 0deg, #222 45deg, #0a0a0a 90deg, #222 135deg, #0a0a0a 180deg, #222 225deg, #0a0a0a 270deg, #222 315deg, #0a0a0a 360deg)',
            animation: musicaAtual ? 'spin-rotate 4s linear infinite' : 'none'
          }}
        >
          <div className="absolute w-[95%] h-[95%] rounded-full border border-white/5" />
          <div className="absolute w-[80%] h-[80%] rounded-full border border-white/5" />
          <div className="absolute w-[65%] h-[65%] rounded-full border border-white/5" />
          <div className="w-1/3 h-1/3 bg-cyan-900 rounded-full border border-cyan-500/30 flex items-center justify-center shadow-inner">
            <div className="w-1.5 h-1.5 bg-[#020813] rounded-full" />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-10 w-full h-full rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-[#061224] flex items-center justify-center border border-white/10 overflow-hidden transform transition-transform duration-500 hover:scale-[1.02]">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Capa" className="w-full h-full object-cover animate-fade-in" />
        ) : (
          <Disc3 size={40} className={`text-cyan-500/20 ${musicaAtual ? 'animate-pulse' : ''}`} />
        )}
      </div>

      <style>{`
        @keyframes spin-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const ProgressBar = ({ progresso, crossfadeInfo }) => {
  const { tempoAtual, tempoTotal } = progresso;
  const progressPercent = tempoTotal > 0 ? (tempoAtual / tempoTotal) * 100 : 0;
  const crossfadeDuration = 4;
  let crossfadeProgressPercent = 0;

  if (crossfadeInfo && tempoTotal > 0) {
    const tempoInicioCrossfade = tempoTotal - crossfadeDuration;
    if (tempoAtual > tempoInicioCrossfade) {
      const progressoCrossfade = (tempoAtual - tempoInicioCrossfade) / crossfadeDuration;
      crossfadeProgressPercent = Math.min(progressoCrossfade * 100, 100);
    }
  }

  return (
    <div className="w-full py-2">
      <div className="relative w-full h-2 bg-[#020813] rounded-full border border-white/5 overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
          style={{ width: `${progressPercent}%`, transition: 'width 250ms linear' }}
        />
        {crossfadeInfo && (
          <div
            className="absolute top-0 left-0 h-full bg-orange-500 opacity-80"
            style={{ width: `${crossfadeProgressPercent}%`, transition: 'width 250ms linear' }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] font-mono font-bold text-white/40 mt-2">
        <span>{formatDuration(tempoAtual)}</span>
        <span>{formatDuration(tempoTotal)}</span>
      </div>
    </div>
  );
};

export default function Mixer() {
  const socketRef = useRef(null);
  const flipTimeoutRef = useRef(null);

  const [crossfadeInfo, setCrossfadeInfo] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [acervo, setAcervo] = useState([]);
  const [comerciais, setComerciais] = useState([]);
  const [buscaAcervo, setBuscaAcervo] = useState("");
  const [currentDayIndex, setCurrentDayIndex] = useState(getLogicalDayIndex());
  const [activeMobileTab, setActiveMobileTab] = useState('playlists');
  const [isFlipped, setIsFlipped] = useState(false);

  const [musicaAtual, setMusicaAtual] = useState({ id: 123, titulo: "Levitating", artista: "Dua Lipa", duracao_segundos: 203, thumbnail_url: "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg" });
  const [fila, setFila] = useState([
    { id: 2, titulo: "Illusion", artista: "Dua Lipa", tipo: "PLAYLIST" },
    { id: 3, titulo: "Pedido do DJ - Summer Hit", artista: "DJ Alok", tipo: "DJ" },
    { id: 4, titulo: "Comercial de Cerveja", artista: "Locutor", tipo: "COMERCIAL_MANUAL" }
  ]);
  const [progresso, setProgresso] = useState({ tempoAtual: 45, tempoTotal: 203 });
  const [isConnected, setIsConnected] = useState(true);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dedalos_local_mute') === 'true');

  useEffect(() => {
    const dayInterval = setInterval(() => {
      const newLogicalDay = getLogicalDayIndex();
      if (newLogicalDay !== currentDayIndex) setCurrentDayIndex(newLogicalDay);
    }, 60000);
    return () => clearInterval(dayInterval);
  }, [currentDayIndex]);

  useEffect(() => {
    let mounted = true;

    try {
      socketRef.current = io(api.defaults.baseURL);

      socketRef.current.on('connect', () => { if (mounted) setIsConnected(true); });
      socketRef.current.on('disconnect', () => { if (mounted) setIsConnected(false); });

      socketRef.current.on('maestro:estadoCompleto', (estado) => {
        if (!mounted) return;
        setMusicaAtual(estado.musicaAtual || null);
        setProgresso({
          tempoAtual: estado.tempoAtualSegundos || 0,
          tempoTotal: estado.musicaAtual ? (estado.musicaAtual.end_segundos ?? estado.musicaAtual.duracao_segundos) : 0
        });
        setCrossfadeInfo(null);
      });

      socketRef.current.on('maestro:filaAtualizada', (novaFila) => { if (mounted) setFila(novaFila || []); });
      socketRef.current.on('maestro:progresso', (info) => { if (mounted) setProgresso(info); });
      socketRef.current.on('maestro:iniciarCrossfade', (info) => { if (mounted) setCrossfadeInfo(info); });
      
      socketRef.current.on('maestro:tocarAgora', ({ musicaInfo }) => {
        if (!mounted) return;
        setMusicaAtual(musicaInfo);
        setCrossfadeInfo(null);
        setProgresso({ tempoAtual: 0, tempoTotal: musicaInfo.end_segundos ?? musicaInfo.duracao_segundos });
      });

      socketRef.current.on('maestro:pararTudo', () => {
        if (!mounted) return;
        setMusicaAtual(null);
        setProgresso({ tempoAtual: 0, tempoTotal: 0 });
        setCrossfadeInfo(null);
      });
    } catch (error) {
      console.error(error);
    }

    Promise.all([
      api.get('/api/playlists').catch(() => ({ data: [{ id: 1, nome: "Pop Hits 2026", tracks_ids: [1,2] }, { id: 2, nome: "Esquenta", tracks_ids: [3,4] }] })),
      api.get('/api/tracks').catch(() => ({ data: [
        { id: 1, titulo: "Levitating", artista: "Dua Lipa", dias_semana: [0,1,2,3,4,5,6], is_commercial: false },
        { id: 2, titulo: "Illusion", artista: "Dua Lipa", dias_semana: [5,6], is_commercial: false },
        { id: 101, titulo: "Promoção de Cerveja", start_segundos: 0, end_segundos: 30, is_commercial: true }
      ]}))
    ]).then(([resPlaylists, resTracks]) => {
      if (mounted) {
        setPlaylists(resPlaylists.data || []);
        setAcervo(resTracks.data.filter(t => !t.is_commercial) || []);
        setComerciais(resTracks.data.filter(t => t.is_commercial) || []);
      }
    });

    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.disconnect();
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, []);

  const handlePularMusica = () => {
    if (socketRef.current) socketRef.current.emit('dj:pularMusica');
    toast.success("Comando: Pular Música enviado (MOCK)");
  };

  const handleTocarComercialAgora = (trackId = null) => {
    if (socketRef.current) socketRef.current.emit('dj:tocarComercialAgora', trackId);
    toast.success("Comando: Tocar Comercial enviado (MOCK)");
  };

  const handleMuteToggle = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    localStorage.setItem('dedalos_local_mute', newState);
    window.dispatchEvent(new Event('storage'));
  };

  const handleCarregarPlaylist = (playlistId) => {
    if (socketRef.current) socketRef.current.emit('dj:carregarPlaylistManual', playlistId);
    toast.success("Comando: Carregar Playlist enviado (MOCK)");
  };

  const handleDjAdicionarPedido = (trackId) => {
    if (socketRef.current) socketRef.current.emit('dj:adicionarPedido', trackId);
    toast.success("Comando: Adicionar Pedido enviado (MOCK)");
    setBuscaAcervo("");
  };

  const handleVeto = (itemId) => {
    if (socketRef.current && itemId) socketRef.current.emit('dj:vetarPedido', itemId);
    toast.success("Comando: Vetar Pedido enviado (MOCK)");
  };

  const handleFlipCard = () => {
    setIsFlipped(true);
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    flipTimeoutRef.current = setTimeout(() => setIsFlipped(false), 5000);
  };

  const getTagInfo = (item) => {
    if (item.tipo === 'COMERCIAL_MANUAL' || item.is_commercial) return { text: 'COMERCIAL', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
    if (item.tipo === 'DJ_PEDIDO' || item.tipo === 'DJ') return { text: 'DJ', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
    if (item.unidade || item.tipo === 'JUKEBOX') {
      const u = (item.unidade || '').toUpperCase();
      if (u === 'BH') return { text: 'BH', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
      if (u === 'SP') return { text: 'SP', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      return { text: u || 'JUKEBOX', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    }
    return { text: 'PLAYLIST', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
  };

  const acervoFiltrado = useMemo(() => {
    if (!buscaAcervo) return [];
    const lowerTerm = buscaAcervo.toLowerCase();
    const filtered = acervo.filter(track => track.titulo?.toLowerCase().includes(lowerTerm) || track.artista?.toLowerCase().includes(lowerTerm));
    return filtered.sort((a, b) => {
      const aAvailable = Array.isArray(a.dias_semana) && a.dias_semana.includes(currentDayIndex);
      const bAvailable = Array.isArray(b.dias_semana) && b.dias_semana.includes(currentDayIndex);
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      return 0;
    });
  }, [buscaAcervo, acervo, currentDayIndex]);

  const qrLink = `https://merman.app/track/${musicaAtual?.id || ''}`;
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrLink)}`;

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in pt-4 md:pt-6 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          
          <div className="hidden md:flex flex-col w-full relative bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] -mr-10 -mt-10 rounded-full pointer-events-none" />
            
            <div className="flex flex-row items-center mb-8 z-10">
              <AlbumArtVinyl musicaAtual={musicaAtual} />
              
              <div className="flex-1 relative min-w-0" style={{ perspective: '1000px' }}>
                <div className={`w-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                  
                  <div className="w-full [backface-visibility:hidden]">
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-black tracking-widest uppercase text-white/60">
                          {isConnected ? 'ON AIR' : 'OFFLINE'}
                        </span>
                      </div>
                      {musicaAtual ? (
                        <>
                          <p className="text-white text-3xl font-black leading-tight line-clamp-2">{musicaAtual.titulo}</p>
                          <p className="text-cyan-400 font-bold text-sm truncate">{musicaAtual.artista}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-white text-3xl font-black leading-tight">Merman Radio</p>
                          <p className="text-cyan-400 font-bold text-sm">Aguardando sinal...</p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-8">
                      <button
                        onClick={handleMuteToggle}
                        className={`flex shrink-0 items-center justify-center rounded-xl w-12 h-12 border transition-all ${isMuted ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'}`}
                        title={isMuted ? "Ativar Som" : "Mutar Som"}
                      >
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <button
                        onClick={handlePularMusica}
                        className="flex flex-1 max-w-[200px] items-center justify-center gap-2 rounded-xl h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] active:scale-95"
                      >
                        <SkipForward size={18} /> Pular
                      </button>
                      <button
                        onClick={handleFlipCard}
                        className="flex shrink-0 items-center justify-center rounded-xl w-12 h-12 border bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10 transition-all"
                        title="Exibir QR Code"
                      >
                        <QrCode size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center w-full">
                      <p className="text-cyan-400 font-black uppercase tracking-widest text-[10px] mb-3 text-center">Compartilhar Música</p>
                      <img src={qrImage} alt="QR Code" className="w-24 h-24 rounded-xl shadow-xl bg-white p-2 mb-4" />
                      <a href={qrLink} target="_blank" rel="noreferrer" className="bg-white/10 border border-white/20 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95 text-center whitespace-nowrap">
                        Link Direto
                      </a>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            
            <div className="z-10 w-full">
              <ProgressBar progresso={progresso} crossfadeInfo={crossfadeInfo} />
            </div>
          </div>

          <div className="flex md:hidden w-full relative" style={{ perspective: '1000px' }}>
            <div className={`w-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
              
              <div className="w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col relative [backface-visibility:hidden]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] -mr-10 -mt-10 rounded-full pointer-events-none" />
                
                <div className="flex w-full justify-center pr-12 mb-6 z-10">
                  <AlbumArtVinyl musicaAtual={musicaAtual} />
                </div>
                
                <div className="flex flex-col items-center text-center w-full z-10">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-black tracking-widest uppercase text-white/60">
                      {isConnected ? 'ON AIR' : 'OFFLINE'}
                    </span>
                  </div>
                  {musicaAtual ? (
                    <>
                      <p className="text-white text-2xl font-black leading-tight line-clamp-2">{musicaAtual.titulo}</p>
                      <p className="text-cyan-400 font-bold text-sm mt-1 truncate w-full">{musicaAtual.artista}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white text-2xl font-black leading-tight">Merman Radio</p>
                      <p className="text-cyan-400 font-bold text-sm mt-1">Aguardando sinal...</p>
                    </>
                  )}
                </div>

                <div className="flex justify-center gap-3 mt-6 w-full z-10">
                  <button
                    onClick={handleMuteToggle}
                    className={`flex shrink-0 items-center justify-center rounded-xl w-12 h-12 border transition-all ${isMuted ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-white/5 text-white/60 border-white/10 hover:text-white'}`}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <button
                    onClick={handlePularMusica}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl h-12 bg-cyan-600 text-white font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] active:scale-95"
                  >
                    <SkipForward size={16} /> Pular
                  </button>
                  <button
                    onClick={handleFlipCard}
                    className="flex shrink-0 items-center justify-center rounded-xl w-12 h-12 border bg-white/5 text-white/60 border-white/10 hover:text-white transition-all"
                  >
                    <QrCode size={18} />
                  </button>
                </div>

                <div className="w-full mt-2 z-10">
                  <ProgressBar progresso={progresso} crossfadeInfo={crossfadeInfo} />
                </div>
              </div>

              <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-[#061224] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col items-center justify-center z-20">
                <p className="text-cyan-400 font-black uppercase tracking-widest text-xs mb-6">Compartilhar Música</p>
                <img src={qrImage} alt="QR Code" className="w-40 h-40 rounded-xl mb-8 shadow-xl bg-white p-2" />
                <a 
                  href={qrLink} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="bg-white/10 border border-white/20 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
                >
                  Abrir Link Direto
                </a>
              </div>

            </div>
          </div>

          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Próximos na Fila</h2>
              
              <div className="relative w-full sm:w-72 shrink-0">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar no acervo..."
                  value={buscaAcervo}
                  onChange={(e) => setBuscaAcervo(e.target.value)}
                  className="w-full bg-[#020813] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs font-bold placeholder:text-white/30 focus:border-cyan-500 outline-none transition-all"
                />
                
                {buscaAcervo && (
                  <div className="absolute top-full right-0 w-full md:w-[350px] mt-2 bg-[#061224] border border-cyan-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 max-h-72 overflow-y-auto custom-scrollbar">
                    {acervoFiltrado.length > 0 ? (
                      acervoFiltrado.map(track => {
                        const isAvailableToday = Array.isArray(track.dias_semana) && track.dias_semana.includes(currentDayIndex);
                        return (
                          <div
                            key={track.id}
                            onClick={() => handleDjAdicionarPedido(track.id)}
                            className={`p-3 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer transition-all flex items-center justify-between group ${!isAvailableToday ? 'opacity-40' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm font-bold truncate group-hover:text-cyan-400 transition-colors">{track.titulo}</p>
                              <p className="text-white/40 text-[10px] uppercase tracking-widest truncate">{track.artista}</p>
                            </div>
                            <PlusCircle size={16} className="text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-white/40 text-xs font-medium">Nenhuma música encontrada.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {fila.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30">
                  <ListMusic size={32} className="mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Fila Vazia</p>
                </div>
              ) : (
                fila.map((item, index) => {
                  const tag = getTagInfo(item);
                  return (
                    <div key={`${item.id}-${index}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#020813]/60 border border-white/5 hover:border-white/10 transition-all group">
                      <span className="text-xs font-mono font-black text-white/20 w-6 text-center">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{item.titulo}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${tag.color}`}>{tag.text}</span>
                          <span className="text-white/40 text-[10px] truncate">{item.artista}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleVeto(item.id)}
                        className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-100 md:opacity-0 group-hover:opacity-100"
                        title="Vetar pedido"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-6">
          <div className="flex lg:hidden gap-3">
            <button
              onClick={() => setActiveMobileTab('playlists')}
              className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${activeMobileTab === 'playlists' ? 'bg-cyan-600 text-white border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-white/40 border-white/10 hover:text-white'}`}
            >
              Playlists
            </button>
            <button
              onClick={() => setActiveMobileTab('comerciais')}
              className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${activeMobileTab === 'comerciais' ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-white/5 text-white/40 border-white/10 hover:text-white'}`}
            >
              Comerciais
            </button>
          </div>

          <div className={`bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex-col h-[350px] lg:h-[376px] ${activeMobileTab === 'playlists' ? 'flex' : 'hidden lg:flex'}`}>
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4">Playlists Disponíveis</h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {playlists.length === 0 && <p className="text-white/40 text-xs text-center mt-10">Nenhuma playlist.</p>}
              {playlists.map((playlist) => (
                <div key={playlist.id} className="bg-[#020813]/60 border border-white/5 p-3 rounded-xl flex items-center justify-between hover:border-cyan-500/30 transition-all group">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-white text-sm truncate group-hover:text-cyan-400 transition-colors">{playlist.nome}</p>
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-0.5">{playlist.tracks_ids.length} Músicas</p>
                  </div>
                  <button
                    onClick={() => handleCarregarPlaylist(playlist.id)}
                    className="bg-white/5 text-white/60 hover:text-white hover:bg-cyan-600 w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                    title="Injetar agora"
                  >
                    <Play size={14} className="ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={`bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex-col h-[350px] lg:h-[376px] ${activeMobileTab === 'comerciais' ? 'flex' : 'hidden lg:flex'}`}>
            <h2 className="text-sm font-bold text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Mic size={16} /> Comerciais Avulsos
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {comerciais.length === 0 && <p className="text-white/40 text-xs text-center mt-10">Nenhum comercial avulso.</p>}
              {comerciais.map((commercial) => (
                <div key={commercial.id} className="bg-[#020813]/60 border border-white/5 p-3 rounded-xl flex items-center justify-between hover:border-orange-500/30 transition-all group">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-white text-sm truncate group-hover:text-orange-400 transition-colors">{commercial.titulo}</p>
                    <p className="text-[10px] text-white/40 font-mono mt-0.5">{formatDuration(commercial.end_segundos - commercial.start_segundos)}</p>
                  </div>
                  <button
                    onClick={() => handleTocarComercialAgora(commercial.id)}
                    className="bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                    title="Tocar comercial"
                  >
                    <Play size={14} className="ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}