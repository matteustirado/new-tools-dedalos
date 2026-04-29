import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Search, Trash2, Edit2, Music, Loader2, ListMusic, CalendarClock, ListPlus } from 'lucide-react';
import api from '../services/api';

const formatTotalDuration = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  let result = '';
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m`;
  return result.trim() || '0m';
};

export default function Playlists() {
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState([]);
  const [allTracks, setAllTracks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api.get('/api/playlists').catch(() => ({ data: [] })),
      api.get('/api/tracks').catch(() => ({ data: [] }))
    ])
    .then(([playlistsRes, tracksRes]) => {
      if (mounted) {
        if (!playlistsRes.data.length && !tracksRes.data.length) {
          setPlaylists([
            { id: 1, nome: "Pop Hits 2026", descricao: "As músicas pop mais pedidas do ano.", imagem: "", tracks_ids: [1, 2, 3] },
            { id: 2, nome: "Esquenta Fim de Semana", descricao: "Playlist para animar a pista na sexta-feira.", imagem: "", tracks_ids: [1, 2, 3, 4, 5, 6, 7] },
            { id: 3, nome: "Comerciais e Avisos", descricao: "Chamadas da rádio intercaladas.", imagem: "", tracks_ids: [1] }
          ]);
          setAllTracks([
            { id: 1, duracao_segundos: 210 }, { id: 2, duracao_segundos: 180 }, { id: 3, duracao_segundos: 240 },
            { id: 4, duracao_segundos: 200 }, { id: 5, duracao_segundos: 190 }, { id: 6, duracao_segundos: 220 },
            { id: 7, duracao_segundos: 180 }
          ]);
        } else {
          setPlaylists(playlistsRes.data);
          setAllTracks(tracksRes.data);
        }
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, []);

  const getPlaylistDetails = (playlist) => {
    if (!allTracks || allTracks.length === 0) return { count: 0, duration: '0m' };
    const trackIds = Array.isArray(playlist.tracks_ids) ? playlist.tracks_ids : [];
    let totalDurationSeconds = 0;
    
    trackIds.forEach(id => {
      const track = allTracks.find(t => t.id === Number(id));
      if (track) {
        const end = track.end_segundos ?? track.duracao_segundos;
        const start = track.start_segundos ?? 0;
        totalDurationSeconds += (end > start) ? (end - start) : 0;
      }
    });

    return {
      count: trackIds.length,
      duration: formatTotalDuration(totalDurationSeconds)
    };
  };

  const filteredPlaylists = useMemo(() => {
    if (!searchTerm) return playlists;
    const lowerQuery = searchTerm.toLowerCase();
    return playlists.filter(p => p.nome.toLowerCase().includes(lowerQuery));
  }, [playlists, searchTerm]);

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    try {
      await api.delete(`/api/playlists/${playlistToDelete.id}`);
      setPlaylists(prev => prev.filter(p => p.id !== playlistToDelete.id));
      toast.success(`Playlist "${playlistToDelete.nome}" excluída com sucesso!`);
      setShowDeleteModal(false);
      setPlaylistToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error(`Falha ao excluir a playlist "${playlistToDelete.nome}".`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in mt-4 md:mt-0">
      <div className="flex flex-row items-center md:items-end justify-between gap-4 mb-6 md:mb-8">
        <h1 className="text-xl md:text-3xl font-black text-white tracking-tight md:mb-1">Biblioteca de Playlists</h1>
        <div className="flex gap-2 md:gap-3">
          <button
            onClick={() => navigate('/schedule')}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl border border-white/10 transition-colors font-bold text-xs uppercase tracking-wider"
            title="Agendamentos"
          >
            <CalendarClock size={18} />
            <span className="hidden md:inline">Agendamentos</span>
          </button>
          <button
            onClick={() => navigate('/playlist-creator')}
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all font-bold text-xs uppercase tracking-wider active:scale-95"
            title="Nova Playlist"
          >
            <ListPlus size={18} strokeWidth={3} />
            <span className="hidden md:inline">Nova Playlist</span>
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 md:p-6 mb-8 shadow-xl flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Buscar playlists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#020813] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-white/30 focus:border-cyan-500 outline-none font-medium text-sm transition-all"
          />
        </div>
        <div className="w-full sm:w-auto">
           <span className="text-[10px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap block text-right pr-2">
            {filteredPlaylists.length} Playlists
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-cyan-500">
          <Loader2 size={40} className="animate-spin mb-4" />
          <p className="text-xs font-bold tracking-widest uppercase">Carregando Playlists...</p>
        </div>
      ) : filteredPlaylists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
          <ListMusic size={48} className="text-white/20 mb-4" />
          <p className="text-white/50 text-sm font-medium mb-6">Nenhuma playlist encontrada.</p>
          <button
            onClick={() => navigate('/playlist-creator')}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
          >
            <ListPlus size={18} /> Criar a Primeira
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlaylists.map((playlist) => {
            const details = getPlaylistDetails(playlist);
            const imageUrl = playlist.imagem ? `${api.defaults.baseURL}${playlist.imagem}` : null;

            return (
              <div key={playlist.id} className="bg-[#020813]/60 border border-white/10 rounded-2xl overflow-hidden hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all duration-300 group flex flex-col">
                <div 
                  className="h-40 bg-gradient-to-br from-cyan-900/40 to-[#020813] flex items-center justify-center relative bg-cover bg-center border-b border-white/5"
                  style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}}
                >
                  {!imageUrl && <ListMusic size={48} className="text-white/10" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020813] to-transparent opacity-80" />
                  
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
                     <span className="text-[9px] font-black text-white/80 tracking-widest">{details.duration}</span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-black text-white mb-1 truncate group-hover:text-cyan-400 transition-colors">{playlist.nome}</h3>
                  <p className="text-xs text-white/40 mb-4 line-clamp-2 h-8 font-medium">{playlist.descricao || 'Nenhuma descrição fornecida.'}</p>
                  
                  <div className="flex items-center gap-2 mb-5">
                     <Music size={14} className="text-cyan-500" />
                     <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">{details.count} Músicas</span>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => navigate(`/playlist-creator/${playlist.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    <button
                      onClick={() => { setPlaylistToDelete(playlist); setShowDeleteModal(true); }}
                      className="flex items-center justify-center w-12 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] bg-[#020813]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#061224] border border-red-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.15)] text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Confirmar Exclusão</h3>
            <p className="text-white/60 text-sm mb-8 font-medium">Tem certeza que deseja excluir permanentemente a playlist <strong className="text-white">"{playlistToDelete?.nome}"</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-widest">Cancelar</button>
              <button onClick={confirmDeletePlaylist} className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}