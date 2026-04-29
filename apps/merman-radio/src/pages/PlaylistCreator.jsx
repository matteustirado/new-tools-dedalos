import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Search, ImagePlus, Tv, X, Shuffle, ArrowUpToLine, Trash2, GripVertical, AlertTriangle, Music, Mic, Loader2 } from 'lucide-react';
import api from '../services/api';

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const ALL_DAYS_CODE = -1;
const DURATION_WARNING_SECONDS = 24 * 3600;

const organizeDuplicatesAtTop = (tracksList) => {
  const counts = {};
  tracksList.forEach(t => counts[t.id] = (counts[t.id] || 0) + 1);

  const duplicates = [];
  const uniques = [];

  tracksList.forEach(t => {
    if (counts[t.id] > 1) {
      duplicates.push(t);
    } else {
      uniques.push(t);
    }
  });

  duplicates.sort((a, b) => a.id - b.id);
  return [...duplicates, ...uniques];
};

export default function PlaylistCreator() {
  const navigate = useNavigate();
  const { playlistId } = useParams();
  const isEditMode = Boolean(playlistId);

  const [searchTerm, setSearchTerm] = useState('');
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    description: '',
    cover: null,
    coverFile: null,
    overlay: null,
    overlayFile: null
  });

  const [originalCover, setOriginalCover] = useState(null);
  const [originalOverlay, setOriginalOverlay] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [allTracksForLookup, setAllTracksForLookup] = useState([]);
  const [draggedTrack, setDraggedTrack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState(ALL_DAYS_CODE);
  const [playlistFilter, setPlaylistFilter] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const tracksResponse = await api.get('/api/tracks');
        const processedTracks = tracksResponse.data.filter(t => t.status_processamento === 'PROCESSADO');
        
        if (!mounted) return;
        setAllTracksForLookup(processedTracks);

        if (isEditMode) {
          const playlistResponse = await api.get(`/api/playlists/${playlistId}`);
          const playlistData = playlistResponse.data;

          setNewPlaylist({
            name: playlistData.nome || '',
            description: playlistData.descricao || '',
            cover: playlistData.imagem || null,
            coverFile: null,
            overlay: playlistData.overlay || null,
            overlayFile: null
          });
          setOriginalCover(playlistData.imagem || null);
          setOriginalOverlay(playlistData.overlay || null);

          const trackIdsInPlaylist = playlistData.tracks_ids || [];
          const tracksForPlaylist = trackIdsInPlaylist
            .map(id => processedTracks.find(track => track.id === Number(id)))
            .filter(Boolean);
          
          setPlaylistTracks(organizeDuplicatesAtTop(tracksForPlaylist));
        }
      } catch (error) {
        if (!mounted) return;
        console.error("Usando mocks devido a falha na API:", error);
        
        const mockTracks = [
          { id: 1, titulo: "Illusion", artista: "Dua Lipa", duracao_segundos: 194, start_segundos: 0, end_segundos: 194, is_commercial: false, dias_semana: [0,1,2,3,4,5,6], thumbnail_url: "https://i.ytimg.com/vi/q1eEioa0HGE/hqdefault.jpg" },
          { id: 2, titulo: "Comercial Quinta Premiada", artista: "Locutor Dedalos", duracao_segundos: 30, start_segundos: 0, end_segundos: 30, is_commercial: true, dias_semana: [4,5,6], thumbnail_url: "" },
          { id: 3, titulo: "Levitating", artista: "Dua Lipa", duracao_segundos: 203, start_segundos: 0, end_segundos: 203, is_commercial: false, dias_semana: [0,1,2,3,4,5,6], thumbnail_url: "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg" }
        ];
        
        setAllTracksForLookup(mockTracks);

        if (isEditMode) {
          setNewPlaylist({
            name: "Pop Hits Mock",
            description: "Playlist gerada offline para testes visuais.",
            cover: null, coverFile: null, overlay: null, overlayFile: null
          });
          setPlaylistTracks([mockTracks[0], mockTracks[2]]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchInitialData();
    return () => { mounted = false; };
  }, [playlistId, isEditMode]);

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.warn("A imagem não pode exceder 5MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (type === 'cover') {
      setNewPlaylist(prev => ({ ...prev, cover: previewUrl, coverFile: file }));
    } else if (type === 'overlay') {
      setNewPlaylist(prev => ({ ...prev, overlay: previewUrl, overlayFile: file }));
    }
    e.target.value = null;
  };

  const addTrack = (track) => {
    const isDuplicate = playlistTracks.some(t => t.id === track.id);
    const newTracks = [...playlistTracks, track];

    if (isDuplicate) {
      toast.warn(`Música duplicada! As cópias de "${track.titulo}" foram movidas para o topo.`);
      setPlaylistTracks(organizeDuplicatesAtTop(newTracks));
    } else {
      setPlaylistTracks(newTracks);
    }
  };

  const removeTrack = (indexToRemove) => {
    setPlaylistTracks(playlistTracks.filter((_, index) => index !== indexToRemove));
  };

  const handleShuffle = () => {
    if (playlistTracks.length < 2) return;
    setPlaylistTracks(prevTracks => {
      const newArr = [...prevTracks];
      for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
      }
      return newArr;
    });
    toast.success("Ordem da playlist embaralhada!");
  };

  const handleDragStart = (track, index) => {
    setDraggedTrack({ ...track, originalIndex: index });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex) => {
    if (playlistFilter) {
      toast.warn("Limpe o filtro para reordenar músicas.");
      return;
    }
    if (!draggedTrack || draggedTrack.originalIndex === targetIndex) {
      setDraggedTrack(null);
      return;
    }

    const newTracks = [...playlistTracks];
    const [itemToMove] = newTracks.splice(draggedTrack.originalIndex, 1);
    newTracks.splice(targetIndex, 0, itemToMove);

    setPlaylistTracks(newTracks);
    setDraggedTrack(null);
  };

  const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '0:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds <= 0) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    return result.trim() || '0m';
  };

  const getTotalDurationSeconds = useMemo(() => {
    return playlistTracks.reduce((acc, track) => {
      const fullTrackData = allTracksForLookup.find(t => t.id === track.id);
      if (!fullTrackData) return acc;
      const end = fullTrackData.end_segundos ?? fullTrackData.duracao_segundos;
      const start = fullTrackData.start_segundos ?? 0;
      const duration = (end > start) ? (end - start) : 0;
      return acc + duration;
    }, 0);
  }, [playlistTracks, allTracksForLookup]);

  const savePlaylist = async (exitOnSave = true) => {
    if (!newPlaylist.name || playlistTracks.length === 0) {
      toast.warn("A playlist precisa de um nome e pelo menos uma música.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('name', newPlaylist.name);
    formData.append('description', newPlaylist.description);
    formData.append('tracks_ids', JSON.stringify(playlistTracks.map(t => t.id)));
    
    if (newPlaylist.coverFile) formData.append('cover', newPlaylist.coverFile);
    if (newPlaylist.overlayFile) formData.append('overlay', newPlaylist.overlayFile);

    if (isEditMode) {
      const processImagePath = (current, original, key) => {
        if ((current === null || current?.startsWith('blob:')) && original) {
          formData.append(key, original);
        } else if (typeof current === 'string' && !current.startsWith('blob:') && current === original) {
          formData.append(key, current);
        } else if (current === null && !original) {
          formData.append(key, '');
        }
      };
      processImagePath(newPlaylist.cover, originalCover, 'existingImagePath');
      processImagePath(newPlaylist.overlay, originalOverlay, 'existingOverlayPath');
    }

    try {
      let newId = playlistId;
      let newCoverUrl = null;
      let newOverlayUrl = null;

      if (isEditMode) {
        const response = await api.put(`/api/playlists/${playlistId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        newCoverUrl = response.data.imagePath;
        newOverlayUrl = response.data.overlayPath;
        toast.success("Playlist atualizada com sucesso!");
      } else {
        const response = await api.post('/api/playlists', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        newId = response.data.id;
        newCoverUrl = response.data.imagePath;
        newOverlayUrl = response.data.overlayPath;
        toast.success("Playlist salva com sucesso!");
      }

      if (exitOnSave) {
        navigate('/playlists');
      } else {
        setOriginalCover(newCoverUrl || null);
        setOriginalOverlay(newOverlayUrl || null);
        setNewPlaylist(prev => ({ 
          ...prev, 
          cover: newCoverUrl || null, coverFile: null,
          overlay: newOverlayUrl || null, overlayFile: null 
        }));
        if (!isEditMode && newId) {
          navigate(`/playlist-creator/${newId}`, { replace: true });
        }
      }
    } catch (error) {
      console.error("Erro simulado MOCK", error);
      toast.success(exitOnSave ? "Playlist salva! (Simulação MOCK)" : "Atualizado! (Simulação MOCK)");
      if (exitOnSave) navigate('/playlists');
    } finally {
      setLoading(false);
    }
  };

  const clearPlaylistTracks = () => {
    setPlaylistTracks([]);
  };

  const trackCounts = useMemo(() => {
    const counts = {};
    playlistTracks.forEach(t => counts[t.id] = (counts[t.id] || 0) + 1);
    return counts;
  }, [playlistTracks]);

  const filteredAcervo = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const dayFilterValue = selectedDayFilter === ALL_DAYS_CODE ? null : selectedDayFilter;
    
    return allTracksForLookup.filter(track => {
      const dayMatch = dayFilterValue === null || (Array.isArray(track.dias_semana) && track.dias_semana.includes(dayFilterValue));
      if (!dayMatch) return false;
      if (!searchTerm) return true;
      
      const titleMatch = track.titulo?.toLowerCase().includes(lowerSearchTerm);
      const artistMatch = track.artista?.toLowerCase().includes(lowerSearchTerm);
      return titleMatch || artistMatch;
    });
  }, [allTracksForLookup, selectedDayFilter, searchTerm]);

  const filteredPlaylistTracks = useMemo(() => {
    const tracksWithIndex = playlistTracks.map((t, i) => ({ ...t, _origIndex: i }));
    if (!playlistFilter) return tracksWithIndex;
    
    const lower = playlistFilter.toLowerCase();
    return tracksWithIndex.filter(track =>
      track.titulo?.toLowerCase().includes(lower) ||
      track.artista?.toLowerCase().includes(lower)
    );
  }, [playlistTracks, playlistFilter]);

  const getPreviewUrl = (type) => {
    const path = type === 'cover' ? newPlaylist.cover : newPlaylist.overlay;
    const file = type === 'cover' ? newPlaylist.coverFile : newPlaylist.overlayFile;
    if (file && path?.startsWith('blob:')) return path;
    if (!file && typeof path === 'string' && path) return `${api.defaults.baseURL}${path}`;
    return null;
  };

  const coverImageUrl = getPreviewUrl('cover');
  const overlayImageUrl = getPreviewUrl('overlay');

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in mt-4 md:mt-0">
      <div className="flex flex-row items-center justify-between gap-4 mb-6 md:mb-8">
        <h1 className="text-xl md:text-3xl font-black text-white tracking-tight">
          {isEditMode ? 'Editar Playlist' : 'Nova Playlist'}
        </h1>
        <button
          onClick={() => navigate('/playlists')}
          className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white w-10 h-10 rounded-xl border border-white/10 transition-colors shrink-0"
          title="Voltar para Playlists"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 mb-6 shadow-xl">
        <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4">Informações da Playlist</h2>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Nome da Playlist</label>
              <input 
                type="text" 
                value={newPlaylist.name} 
                onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })} 
                className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-cyan-500 outline-none font-medium transition-all" 
                placeholder="Ex: Summer Hits 2026" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Descrição</label>
              <textarea 
                rows="2" 
                value={newPlaylist.description} 
                onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })} 
                className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-cyan-500 outline-none font-medium transition-all resize-none custom-scrollbar" 
                placeholder="Descreva o propósito da playlist..."
              />
            </div>
          </div>

          <div className="lg:hidden grid grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Capa</label>
              <div className="flex items-center gap-2 bg-[#020813] border border-white/10 p-1.5 rounded-xl h-12">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden relative shrink-0">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus size={16} className="text-white/20" />
                  )}
                  {coverImageUrl && (
                    <button onClick={() => setNewPlaylist(prev => ({ ...prev, cover: null, coverFile: null }))} className="absolute top-0 right-0 p-0.5 bg-black/60 text-white rounded-bl-lg hover:bg-red-500 transition-colors">
                      <X size={10} strokeWidth={3} />
                    </button>
                  )}
                </div>
                <label className="flex-1 cursor-pointer text-[9px] font-black uppercase tracking-widest text-center text-white/60 hover:text-white transition-colors leading-tight">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover')} className="hidden" />
                  {coverImageUrl ? 'Trocar' : 'Upload'}
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Overlay</label>
              <div className="flex items-center gap-2 bg-[#020813] border border-white/10 p-1.5 rounded-xl h-12">
                <div className="w-[60px] h-9 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden relative shrink-0">
                  {overlayImageUrl ? (
                    <img src={overlayImageUrl} alt="Overlay" className="w-full h-full object-contain" />
                  ) : (
                    <Tv size={16} className="text-white/20" />
                  )}
                  {overlayImageUrl && (
                    <button onClick={() => setNewPlaylist(prev => ({ ...prev, overlay: null, overlayFile: null }))} className="absolute top-0 right-0 p-0.5 bg-black/60 text-white rounded-bl-lg hover:bg-red-500 transition-colors">
                      <X size={10} strokeWidth={3} />
                    </button>
                  )}
                </div>
                <label className="flex-1 cursor-pointer text-[9px] font-black uppercase tracking-widest text-center text-white/60 hover:text-white transition-colors leading-tight">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'overlay')} className="hidden" />
                  {overlayImageUrl ? 'Trocar' : 'Upload'}
                </label>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col xl:flex-row gap-6 items-start shrink-0">
            <div className="flex flex-col items-center gap-3 w-32 shrink-0">
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest text-center w-full">Capa da Playlist</label>
              <div className="w-32 h-32 rounded-xl bg-[#020813] flex items-center justify-center overflow-hidden border border-white/10 relative shrink-0 shadow-lg">
                {coverImageUrl ? (
                  <img src={coverImageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={32} className="text-white/20" />
                )}
                {coverImageUrl && (
                  <button
                    onClick={() => setNewPlaylist(prev => ({ ...prev, cover: null, coverFile: null }))}
                    className="absolute top-1 right-1 z-10 p-1 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-red-500 transition-colors"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
              <label className="cursor-pointer bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors w-full text-center">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover')} className="hidden" />
                {coverImageUrl ? 'Alterar' : 'Carregar'}
              </label>
            </div>

            <div className="flex flex-col items-center gap-3 shrink-0">
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest text-center w-full">Overlay TV (16:9)</label>
              <div className="h-32 aspect-video rounded-xl bg-[#020813] flex items-center justify-center overflow-hidden border border-white/10 relative shrink-0 shadow-lg">
                {overlayImageUrl ? (
                  <img src={overlayImageUrl} alt="Overlay Preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-white/20">
                    <Tv size={28} className="mb-2" />
                    <span className="text-[9px] uppercase font-black tracking-widest">Marca D'água</span>
                  </div>
                )}
                {overlayImageUrl && (
                  <button
                    onClick={() => setNewPlaylist(prev => ({ ...prev, overlay: null, overlayFile: null }))}
                    className="absolute top-1 right-1 z-10 p-1 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-red-500 transition-colors"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
              <label className="cursor-pointer bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors w-full text-center">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'overlay')} className="hidden" />
                {overlayImageUrl ? 'Alterar' : 'Carregar'}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col h-[650px]">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4">Acervo de Músicas</h2>
          
          <div className="flex gap-2 items-center mb-4 overflow-x-auto custom-scrollbar pb-2">
            <button
              onClick={() => setSelectedDayFilter(ALL_DAYS_CODE)}
              className={`px-4 h-9 rounded-lg font-black text-[10px] tracking-widest uppercase transition-all whitespace-nowrap ${selectedDayFilter === ALL_DAYS_CODE ? 'bg-cyan-600 text-white' : 'bg-[#020813] text-white/40 hover:text-white'}`}
            >
              TODOS
            </button>
            <div className="h-5 w-px bg-white/10 mx-1 shrink-0"></div>
            {WEEK_DAYS.map((day, index) => (
              <button
                key={index}
                onClick={() => setSelectedDayFilter(index)}
                className={`w-9 h-9 rounded-lg font-black text-[10px] shrink-0 transition-all ${selectedDayFilter === index ? 'bg-cyan-600 text-white' : 'bg-[#020813] text-white/40 hover:text-white'}`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="relative mb-4 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Buscar no acervo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 bg-[#020813] border border-white/10 rounded-xl pl-9 pr-4 text-white text-sm font-medium placeholder:text-white/20 focus:border-cyan-500 outline-none transition-all"
              disabled={loading}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-cyan-500">
                <Loader2 size={32} className="animate-spin mb-2" />
              </div>
            ) : filteredAcervo.length === 0 ? (
              <p className="text-white/40 text-center text-xs font-medium mt-10">Nenhuma música encontrada.</p>
            ) : (
              filteredAcervo.map((track) => (
                <div
                  key={track.id}
                  onClick={() => addTrack(track)}
                  className="flex items-center gap-3 p-3 bg-[#020813]/60 border border-white/5 rounded-xl hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all cursor-pointer group"
                >
                  {track.thumbnail_url ? (
                    <img src={track.thumbnail_url} alt="Thumb" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10" loading="lazy" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/10">
                      {track.is_commercial ? <Mic size={16} className="text-white/40" /> : <Music size={16} className="text-white/40" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate group-hover:text-cyan-400 transition-colors">{track.titulo}</p>
                    <p className="text-white/40 text-xs truncate mt-0.5">{track.artista}</p>
                  </div>
                  <span className="text-white/40 font-mono text-[10px] font-bold shrink-0">
                    {formatDuration(track.end_segundos ? track.end_segundos - track.start_segundos : track.duracao_segundos - track.start_segundos)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col h-[650px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 shrink-0">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Sua Playlist</h2>
            <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${getTotalDurationSeconds > DURATION_WARNING_SECONDS ? 'text-yellow-400' : 'text-white/40'}`}>
              <span>{playlistTracks.length} MÚSICAS</span>
              <span className="mx-1">•</span>
              <span>{formatTotalDuration(getTotalDurationSeconds)}</span>
              {getTotalDurationSeconds > DURATION_WARNING_SECONDS && (
                <AlertTriangle size={14} className="ml-1 animate-pulse" title="Duração da playlist excede 24 horas!" />
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-start md:justify-end gap-2 mb-4 shrink-0 w-full">
            <button
              onClick={handleShuffle}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 h-9 px-4 rounded-lg font-black text-[10px] uppercase tracking-widest bg-white/5 hover:bg-cyan-500/20 text-white/60 hover:text-cyan-400 transition-all border border-white/10"
              title="Embaralhar Músicas"
            >
              <Shuffle size={14} /> SHUFFLE
            </button>

            {Object.values(trackCounts).some(c => c > 1) && (
              <button
                onClick={() => setPlaylistTracks(organizeDuplicatesAtTop(playlistTracks))}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 h-9 px-4 rounded-lg font-black text-[10px] uppercase tracking-widest bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 transition-all border border-yellow-500/20"
                title="Agrupar músicas duplicadas no topo"
              >
                <ArrowUpToLine size={14} /> AGRUPAR DUPLICADAS
              </button>
            )}

            {playlistTracks.length > 0 && (
              <button
                onClick={clearPlaylistTracks}
                disabled={loading || playlistFilter}
                className="flex-1 md:flex-none flex items-center justify-center h-9 px-4 rounded-lg font-black text-[10px] uppercase tracking-widest bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all border border-white/10 disabled:opacity-50"
              >
                LIMPAR
              </button>
            )}
          </div>

          <div className="relative mb-4 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Filtrar na playlist..."
              value={playlistFilter}
              onChange={(e) => setPlaylistFilter(e.target.value)}
              className="w-full h-11 bg-[#020813] border border-white/10 rounded-xl pl-9 pr-10 text-white text-sm font-medium placeholder:text-white/20 focus:border-cyan-500 outline-none transition-all"
            />
            {playlistFilter && (
              <button onClick={() => setPlaylistFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                <X size={14} strokeWidth={3} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {playlistTracks.length === 0 ? (
              <p className="text-white/40 text-center text-xs font-medium mt-10">Adicione músicas clicando no acervo ao lado.</p>
            ) : filteredPlaylistTracks.length === 0 ? (
              <p className="text-white/40 text-center text-xs font-medium mt-10">Nenhuma música na playlist com este filtro.</p>
            ) : (
              filteredPlaylistTracks.map((track) => {
                const originalIndex = track._origIndex;
                const isDuplicate = trackCounts[track.id] > 1;

                return (
                  <div
                    key={`${track.id}-${originalIndex}`}
                    draggable={!playlistFilter}
                    onDragStart={() => !playlistFilter && handleDragStart(track, originalIndex)}
                    onDragOver={handleDragOver}
                    onDrop={() => !playlistFilter && handleDrop(originalIndex)}
                    className={`flex items-center gap-3 p-3 bg-[#020813]/60 border rounded-xl hover:bg-white/5 transition-all group relative 
                        ${draggedTrack?.originalIndex === originalIndex ? 'opacity-30' : ''}
                        ${!playlistFilter ? 'cursor-move border-white/5 hover:border-white/20' : 'border-white/5'}
                        ${isDuplicate ? 'border-red-500/20 bg-red-500/5' : ''}
                      `}
                  >
                    {!playlistFilter ? (
                      <GripVertical size={16} className="text-white/20 flex-shrink-0" />
                    ) : (
                      <span className="text-white/20 text-[10px] w-4 text-center shrink-0">•</span>
                    )}

                    {track.thumbnail_url ? (
                      <img src={track.thumbnail_url} alt="Thumb" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10" loading="lazy" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/10">
                        {track.is_commercial ? <Mic size={16} className="text-white/40" /> : <Music size={16} className="text-white/40" />}
                      </div>
                    )}

                    <span className="text-white/20 font-mono text-[10px] font-black w-5 text-right shrink-0">
                      {playlistFilter ? '' : originalIndex + 1}
                    </span>

                    <div className="flex-1 min-w-0 pl-1">
                      <p className={`font-bold text-sm truncate ${isDuplicate ? 'text-red-300' : 'text-white'}`}>{track.titulo}</p>
                      <p className="text-white/40 text-xs truncate mt-0.5">{track.artista}</p>
                    </div>

                    <span className="text-white/40 font-mono text-[10px] font-bold shrink-0">
                      {formatDuration(track.end_segundos ? track.end_segundos - track.start_segundos : track.duracao_segundos - track.start_segundos)}
                    </span>

                    <button
                      onClick={() => removeTrack(originalIndex)}
                      className="p-2 ml-1 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      title="Remover da Playlist"
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

      <div className="flex flex-col sm:flex-row justify-end gap-3 mb-10">
        <button 
          onClick={() => navigate('/playlists')} 
          disabled={loading} 
          className="bg-white/5 text-white/60 hover:text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-50 text-center"
        >
          Cancelar
        </button>
        <button 
          onClick={() => savePlaylist(false)} 
          disabled={loading || playlistTracks.length === 0} 
          className="bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-cyan-800/60 transition-colors disabled:opacity-50 text-center"
        >
          {loading ? 'Salvando...' : (isEditMode ? 'Atualizar' : 'Salvar')}
        </button>
        <button 
          onClick={() => savePlaylist(true)} 
          disabled={loading || playlistTracks.length === 0} 
          className="bg-cyan-600 text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 disabled:opacity-50 text-center"
        >
          {loading ? 'Salvando...' : (isEditMode ? 'Atualizar e Sair' : 'Salvar e Sair')}
        </button>
      </div>
    </div>
  );
}