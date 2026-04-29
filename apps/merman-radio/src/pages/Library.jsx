import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { History, ListPlus, Search, ChevronDown, ArrowUp, ArrowDown, Trash2, Edit2, Music, Mic, X, Check, Loader2 } from 'lucide-react';
import api from '../services/api';

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const ALL_DAYS_ARRAY = [0, 1, 2, 3, 4, 5, 6];

const initialFormData = {
  youtube_id: '',
  titulo: '',
  artista: '',
  artistas_participantes: [],
  album: '',
  ano: '',
  gravadora: '',
  diretor: '',
  thumbnail_url: '',
  duracao_segundos: 0,
  start_segundos: 0,
  end_segundos: 0,
  is_commercial: false,
  dias_semana: [...ALL_DAYS_ARRAY]
};

export default function Library() {
  const navigate = useNavigate();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [editingTrack, setEditingTrack] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState(null);

  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());

  const fetchTracksData = useCallback(async () => {
    try {
      const response = await api.get('/api/tracks');
      setTracks(response.data);
    } catch (error) {
      console.error(error);
      toast.error('Falha ao buscar músicas do acervo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    api.get('/api/tracks')
      .then(response => {
        if (mounted) {
          setTracks(response.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setTracks([
            { id: 1, titulo: "Illusion", artista: "Dua Lipa", status_processamento: "PROCESSADO", start_segundos: 0, end_segundos: 194, duracao_segundos: 194, is_commercial: false, thumbnail_url: "https://i.ytimg.com/vi/q1eEioa0HGE/hqdefault.jpg" },
            { id: 2, titulo: "Comercial Quinta Premiada", artista: "Locutor Dedalos", status_processamento: "PENDENTE", start_segundos: 0, end_segundos: 30, duracao_segundos: 30, is_commercial: true, thumbnail_url: "" },
            { id: 3, titulo: "Erro de Download (Exemplo)", artista: "Link Quebrado", status_processamento: "ERRO", start_segundos: 0, end_segundos: 0, duracao_segundos: 0, is_commercial: false, thumbnail_url: "" },
          ]);
          setLoading(false);
        }
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const hasPending = tracks.some(track => track.status_processamento === 'PENDENTE');
    if (!hasPending) return;

    const timer = setInterval(() => {
      api.get('/api/tracks')
        .then(response => setTracks(response.data))
        .catch(console.error);
    }, 5000);

    return () => clearInterval(timer);
  }, [tracks]);

  const handleFetchData = async () => {
    if (!youtubeUrl) return toast.warn('Por favor, insira uma URL do YouTube.');
    setLoading(true);
    try {
      const response = await api.post('/api/tracks/fetch-data', { url: youtubeUrl });
      setFormData({
        ...initialFormData,
        youtube_id: response.data.youtube_id,
        titulo: response.data.titulo,
        artista: response.data.artista,
        duracao_segundos: response.data.duracao_segundos,
        end_segundos: response.data.duracao_segundos,
        thumbnail_url: response.data.thumbnail_url || ''
      });
      setShowForm(true);
      setYoutubeUrl('');
      toast.success('Dados do vídeo carregados!');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Erro ao buscar dados do vídeo.');
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(initialFormData);
    setEditingTrack(null);
  };

  const handleSaveTrack = async () => {
    if (!formData.titulo || !formData.artista) return toast.warn('Título e Artista são obrigatórios.');
    if (formData.end_segundos <= formData.start_segundos || formData.end_segundos > formData.duracao_segundos) {
      return toast.warn('Os limites de tempo são inválidos.');
    }

    setLoading(true);
    try {
      if (editingTrack) {
        await api.put(`/api/tracks/${editingTrack.id}`, formData);
        toast.success('Mídia atualizada com sucesso!');
      } else {
        const response = await api.post('/api/tracks/import', formData);
        toast.success(response.data.message || 'Mídia adicionada com sucesso!');
      }
      closeForm();
      await fetchTracksData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Erro ao salvar a música.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteTrack = async () => {
    if (!trackToDelete) return;
    try {
      await api.delete(`/api/tracks/${trackToDelete.id}`);
      setTracks(tracks.filter(t => t.id !== trackToDelete.id));
      toast.success(`"${trackToDelete.titulo}" excluída!`);
      setShowDeleteModal(false);
      setTrackToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error('Falha ao excluir a música.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTrackIds.size === 0) return toast.warn('Nenhuma mídia selecionada.');
    if (window.confirm(`Excluir permanentemente ${selectedTrackIds.size} mídias?`)) {
      setLoading(true);
      try {
        const ids = Array.from(selectedTrackIds);
        const response = await api.delete('/api/tracks/batch', { data: { ids } });
        toast.success(response.data.message || `${ids.length} mídias excluídas.`);
        setSelectedTrackIds(new Set());
        await fetchTracksData();
      } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.error || 'Falha ao excluir mídias.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditTrack = (track) => {
    setFormData({
      ...track,
      artistas_participantes: Array.isArray(track.artistas_participantes) ? track.artistas_participantes : [],
      dias_semana: Array.isArray(track.dias_semana) && track.dias_semana.length > 0 ? track.dias_semana : [...ALL_DAYS_ARRAY],
      ano: track.ano || '',
      thumbnail_url: track.thumbnail_url || ''
    });
    setEditingTrack(track);
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDayToggle = (index) => {
    setFormData(prev => {
      let newDays = [...(prev.dias_semana || [])];
      const isAll = newDays.length === 7;
      if (index === 'TODOS') {
        newDays = isAll ? [] : [...ALL_DAYS_ARRAY];
      } else {
        if (isAll) newDays = [index];
        else if (newDays.includes(index)) newDays = newDays.filter(d => d !== index);
        else newDays.push(index);
        if (newDays.length === 7) newDays = [...ALL_DAYS_ARRAY];
      }
      return { ...prev, dias_semana: newDays.sort((a, b) => a - b) };
    });
  };

  const handleToggleSelect = (trackId) => {
    setSelectedTrackIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };

  const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '0:00';
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimeForInput = (totalSeconds) => {
    const p = parseInt(totalSeconds, 10);
    if (isNaN(p) || p <= 0) return '00:00';
    const h = Math.floor(p / 3600);
    const m = Math.floor((p % 3600) / 60);
    const s = p % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const parseInputToSeconds = (rawValue) => {
    const onlyNums = rawValue.replace(/\D/g, '');
    if (!onlyNums) return 0;
    const str = parseInt(onlyNums, 10).toString();
    if (str.length <= 2) return parseInt(str, 10);
    const secStr = str.slice(-2);
    const minStr = str.slice(0, -2);
    if (minStr.length <= 2) return parseInt(minStr, 10) * 60 + parseInt(secStr, 10);
    return parseInt(minStr.slice(0, -2), 10) * 3600 + parseInt(minStr.slice(-2), 10) * 60 + parseInt(secStr, 10);
  };

  const filteredAndSortedTracks = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = tracks.filter(t => {
      const match = !searchQuery || t.titulo.toLowerCase().includes(lowerQuery) || (t.artista && t.artista.toLowerCase().includes(lowerQuery));
      if (!match) return false;
      return typeFilter === 'TODOS' || (typeFilter === 'Música' && !t.is_commercial) || (typeFilter === 'Comercial' && t.is_commercial);
    });
    return filtered.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (sortBy === 'duration') {
        valA = Math.max(0, (a.end_segundos ?? a.duracao_segundos) - (a.start_segundos ?? 0));
        valB = Math.max(0, (b.end_segundos ?? b.duracao_segundos) - (b.start_segundos ?? 0));
      }
      let comp = typeof valA === 'string' ? valA.localeCompare(valB, 'pt-BR') : valA - valB;
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [tracks, searchQuery, typeFilter, sortBy, sortOrder]);

  const areAllFilteredSelected = filteredAndSortedTracks.length > 0 && filteredAndSortedTracks.every(t => selectedTrackIds.has(t.id));

  const handleToggleSelectAll = () => {
    setSelectedTrackIds(prev => {
      const newSet = new Set(prev);
      if (areAllFilteredSelected) filteredAndSortedTracks.forEach(t => newSet.delete(t.id));
      else filteredAndSortedTracks.forEach(t => newSet.add(t.id));
      return newSet;
    });
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'PROCESSADO': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PENDENTE': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'ERRO': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-white/5 text-white/40 border-white/10';
    }
  };

  const allDaysSelected = formData.dias_semana.length === 7;

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in mt-4 md:mt-0">
      <div className="flex flex-row items-center md:items-end justify-between gap-4 mb-6 md:mb-8">
        <h1 className="text-xl md:text-3xl font-black text-white tracking-tight">Acervo Musical</h1>
        <div className="flex gap-2 md:gap-3">
          <button
            onClick={() => navigate('/order-history')}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl border border-white/10 transition-colors font-bold text-xs uppercase tracking-wider"
            title="Histórico de Pedidos"
          >
            <History size={18} />
            <span className="hidden md:inline">Histórico de Pedidos</span>
          </button>
          <button
            onClick={() => navigate('/playlist-creator')}
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all font-bold text-xs uppercase tracking-wider active:scale-95"
            title="Nova Playlist"
          >
            <ListPlus size={18} />
            <span className="hidden md:inline">Nova Playlist</span>
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 mb-6 shadow-xl">
        <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4 text-center md:text-left">Adicionar Nova Mídia</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="flex-1 w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium text-center md:text-left"
            placeholder="Cole o link do YouTube aqui..."
            onKeyDown={(e) => e.key === 'Enter' && handleFetchData()}
          />
          <button
            onClick={handleFetchData}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] active:scale-95 disabled:opacity-50 uppercase tracking-wider text-xs"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Buscar
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-xl flex flex-col">
        <div className="flex flex-col w-full">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest w-full text-center md:text-left md:w-auto">
              Mídias no Acervo
            </h2>
            <div className="flex flex-1 w-full md:w-auto items-center justify-end gap-2 md:gap-3">
              <div className="hidden md:block relative flex-1 sm:flex-none">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full appearance-none bg-[#020813] border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-white text-xs font-bold focus:border-cyan-500 outline-none cursor-pointer"
                >
                  <option value="TODOS">TIPO: TODOS</option>
                  <option value="Música">TIPO: MÚSICA</option>
                  <option value="Comercial">TIPO: COMERCIAL</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
              
              <div className="hidden md:block relative flex-1 sm:flex-none">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full appearance-none bg-[#020813] border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-white text-xs font-bold focus:border-cyan-500 outline-none cursor-pointer"
                >
                  <option value="created_at">ORDEM: DATA</option>
                  <option value="titulo">ORDEM: TÍTULO</option>
                  <option value="artista">ORDEM: ARTISTA</option>
                  <option value="duration">ORDEM: DURAÇÃO</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>

              <button
                onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                className="hidden md:flex bg-[#020813] border border-white/10 rounded-xl w-10 h-10 items-center justify-center text-white/60 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
              >
                {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </button>

              {selectedTrackIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={loading}
                  className="hidden md:flex w-full md:w-auto items-center justify-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={16} />
                  Excluir ({selectedTrackIds.size})
                </button>
              )}

              <div className="relative w-full max-w-none md:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="BUSCAR MÚSICA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#020813] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs font-bold placeholder:text-white/20 focus:border-cyan-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between md:justify-end items-center mt-3 w-full">
            {selectedTrackIds.size > 0 ? (
              <button
                onClick={handleDeleteSelected}
                disabled={loading}
                className="md:hidden flex items-center justify-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={12} />
                Excluir ({selectedTrackIds.size})
              </button>
            ) : <div />}
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest text-right w-full md:w-auto">
              {filteredAndSortedTracks.length} Músicas
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center p-4 rounded-xl bg-[#020813]/50 border border-white/5 mt-4 mb-2">
          <div className="w-8 flex-shrink-0 flex items-center justify-center">
            <input
              type="checkbox"
              checked={areAllFilteredSelected}
              onChange={handleToggleSelectAll}
              disabled={filteredAndSortedTracks.length === 0}
              className="w-4 h-4 rounded bg-[#020813] border-white/20 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
            />
          </div>
          <div className="w-12 mr-4 flex-shrink-0"></div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Título / Artista</span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
            <span className="text-[10px] font-black tracking-widest text-white/40 w-24 text-center uppercase">Status</span>
            <span className="text-[10px] font-black tracking-widest text-white/40 w-16 text-right uppercase">Duração</span>
            <span className="text-[10px] font-black tracking-widest text-white/40 w-20 text-right uppercase">Ações</span>
          </div>
        </div>

        <div className="space-y-3 md:space-y-2 flex-1 mt-4 md:mt-0">
          {loading && tracks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-cyan-500">
              <Loader2 size={32} className="animate-spin mb-4" />
              <p className="text-xs font-bold tracking-widest uppercase text-center">Carregando Acervo...</p>
            </div>
          )}

          {!loading && filteredAndSortedTracks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/40 text-sm font-medium">Nenhum resultado encontrado.</p>
            </div>
          )}

          {filteredAndSortedTracks.map((track) => {
            const isSelected = selectedTrackIds.has(track.id);
            const duration = Math.max(0, (track.end_segundos ?? track.duracao_segundos) - track.start_segundos);

            return (
              <div
                key={track.id}
                className={`flex flex-col md:flex-row md:items-center p-4 rounded-xl border transition-all relative ${
                  isSelected ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-[#020813]/30 border-white/5 hover:bg-[#020813]/80 hover:border-white/10'
                }`}
              >
                <div className="absolute top-4 left-4 md:static md:w-8 md:flex-shrink-0 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelect(track.id)}
                    className="w-4 h-4 rounded bg-[#020813] border-white/20 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col md:flex-row items-center flex-1 min-w-0 mb-4 md:mb-0 mt-2 md:mt-0">
                  {track.thumbnail_url ? (
                    <img src={track.thumbnail_url} alt="Thumb" className="w-14 h-14 md:w-12 md:h-12 object-cover rounded-lg mb-3 md:mb-0 md:mr-4 border border-white/10 shadow-lg" loading="lazy" />
                  ) : (
                    <div className="w-14 h-14 md:w-12 md:h-12 rounded-lg bg-white/5 flex items-center justify-center mb-3 md:mb-0 md:mr-4 border border-white/10 shadow-lg">
                      {track.is_commercial ? <Mic size={20} className="text-white/40" /> : <Music size={20} className="text-white/40" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 w-full px-8 md:px-0 text-center md:text-left">
                    <p className="font-bold text-white text-sm truncate">{track.titulo}</p>
                    <p className="text-xs text-white/50 truncate mt-0.5">{track.artista}</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center md:justify-end gap-3 md:gap-4 flex-shrink-0 w-full md:w-auto px-4 md:px-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border text-center w-full md:w-24 ${getStatusChip(track.status_processamento)}`}>
                    {track.status_processamento}
                  </span>
                  <div className="flex items-center justify-center gap-4 w-full md:w-auto border-t border-white/5 md:border-none pt-3 md:pt-0">
                    <p className="text-xs font-mono font-bold text-white/60 w-16 text-center md:text-right">
                      {formatDuration(duration)}
                    </p>
                    <div className="flex justify-center md:justify-end gap-2 w-20">
                      <button onClick={() => handleEditTrack(track)} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => { setTrackToDelete(track); setShowDeleteModal(true); }} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020813]/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#061224] border border-cyan-900/30 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-black/20">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">
                {editingTrack ? 'Editar Mídia' : 'Configurar Nova Mídia'}
              </h2>
              <button onClick={closeForm} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 border-b border-white/5 pb-8 text-center md:text-left">
                {formData.thumbnail_url ? (
                  <img src={formData.thumbnail_url} alt="Thumb" className="w-32 h-32 object-cover rounded-2xl border border-white/10 shadow-lg" />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-lg">
                    <Music size={40} className="text-white/20" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-center w-full">
                  <h3 className="text-2xl font-black text-white truncate">{formData.titulo || 'Novo Título...'}</h3>
                  <p className="text-sm font-bold text-cyan-400 truncate mt-1">{formData.artista || 'Novo Artista...'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center md:text-left">Título da Música</label>
                  <input type="text" name="titulo" value={formData.titulo} onChange={handleFormChange} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none font-medium text-center md:text-left" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center md:text-left">Artista Principal</label>
                  <input type="text" name="artista" value={formData.artista} onChange={handleFormChange} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none font-medium text-center md:text-left" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center md:text-left">Artistas Participantes</label>
                  <input type="text" placeholder="Separados por vírgula..." value={formData.artistas_participantes.join(', ')} onChange={(e) => setFormData(p => ({ ...p, artistas_participantes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none font-medium placeholder:text-white/20 text-center md:text-left" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center md:text-left">Álbum</label>
                    <input type="text" name="album" value={formData.album || ''} onChange={handleFormChange} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none font-medium text-center md:text-left" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center">Ano</label>
                    <input type="text" maxLength={4} value={formData.ano || ''} onChange={(e) => setFormData(p => ({ ...p, ano: e.target.value.replace(/\D/g, '') }))} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none font-medium text-center" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center md:text-left">Gravadora</label>
                  <input type="text" name="gravadora" value={formData.gravadora || ''} onChange={handleFormChange} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none font-medium text-center md:text-left" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center">Corte Inicial (MM:SS)</label>
                    <input type="text" value={formatTimeForInput(formData.start_segundos)} onChange={(e) => setFormData(p => ({ ...p, start_segundos: parseInputToSeconds(e.target.value) }))} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-cyan-400 font-mono font-bold text-center focus:border-cyan-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center">Corte Final (MM:SS)</label>
                    <input type="text" value={formatTimeForInput(formData.end_segundos)} onChange={(e) => setFormData(p => ({ ...p, end_segundos: parseInputToSeconds(e.target.value) }))} className="w-full bg-[#020813] border border-white/10 rounded-xl px-4 py-3 text-cyan-400 font-mono font-bold text-center focus:border-cyan-500 outline-none" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 text-center md:text-left">Dias de Reprodução</label>
                  <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start">
                    <button onClick={() => handleDayToggle('TODOS')} className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${allDaysSelected ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>TODOS</button>
                    <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>
                    {WEEK_DAYS.map((day, idx) => (
                      <button key={idx} onClick={() => handleDayToggle(idx)} className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${!allDaysSelected && formData.dias_semana.includes(idx) ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{day}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-5 border-t border-white/5 bg-black/40 gap-4">
              <button onClick={() => setFormData(p => ({ ...p, is_commercial: !p.is_commercial }))} className="flex items-center gap-3 group w-full md:w-auto justify-center md:justify-start">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors border ${formData.is_commercial ? 'bg-cyan-500 border-cyan-500' : 'bg-[#020813] border-white/20 group-hover:border-white/40'}`}>
                  {formData.is_commercial && <Check size={14} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest group-hover:text-white transition-colors">É um comercial?</span>
              </button>
              <div className="flex gap-3 w-full md:w-auto">
                <button onClick={closeForm} disabled={loading} className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-widest disabled:opacity-50">Cancelar</button>
                <button onClick={handleSaveTrack} disabled={loading} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 disabled:opacity-50 min-w-[160px]">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : (editingTrack ? 'Atualizar' : 'Salvar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] bg-[#020813]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#061224] border border-red-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.15)] text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Confirmar Exclusão</h3>
            <p className="text-white/60 text-sm mb-8 font-medium">Tem certeza que deseja excluir permanentemente a mídia <strong className="text-white">"{trackToDelete?.titulo}"</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-widest">Cancelar</button>
              <button onClick={confirmDeleteTrack} className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}