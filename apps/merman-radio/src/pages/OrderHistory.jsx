import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Headphones, Ticket, MessageCircle, RefreshCw, ChevronDown, CheckCircle2, Ban, Lightbulb, Clock } from 'lucide-react';
import api from '../services/api';

export default function OrderHistory() {
  const navigate = useNavigate();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTerm, setFilterTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('TODOS');
  
  const [displayLimit, setDisplayLimit] = useState(100);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchHistory = useCallback(async (limit, isLoadMore = false) => {
    if (isLoadMore) setIsLoadingMore(true);
    try {
      const res = await api.get(`/api/jukebox/history?limit=${limit}`);
      setHistory(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    api.get(`/api/jukebox/history?limit=${displayLimit}`)
      .then(res => {
        if (mounted) {
          setHistory(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setHistory([
            { id: 1, titulo: "Levitating", artista: "Dua Lipa", termo_busca: "", pulseira_id: "784512", unidade: "SP", status: "TOCADO", telefone: "11999999999", created_at: new Date().toISOString(), tocado_em: new Date().toISOString(), thumbnail_url: "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg" },
            { id: 2, titulo: "Bloody Mary", artista: "Lady Gaga", termo_busca: "", pulseira_id: "DJ-Vini", unidade: "DJ", status: "PENDENTE", telefone: "", created_at: new Date(Date.now() - 300000).toISOString(), tocado_em: null, thumbnail_url: "https://i.ytimg.com/vi/VFwnHACNDCQ/hqdefault.jpg" },
            { id: 3, titulo: "", artista: "", termo_busca: "Beyonce Judas Remix", pulseira_id: "125478", unidade: "BH", status: "SUGERIDA", telefone: "31988888888", created_at: new Date(Date.now() - 3600000).toISOString(), tocado_em: null, thumbnail_url: "" },
            { id: 4, titulo: "Baby Shark", artista: "Pinkfong", termo_busca: "", pulseira_id: "998877", unidade: "SP", status: "VETADO", telefone: "11977777777", created_at: new Date(Date.now() - 7200000).toISOString(), tocado_em: new Date(Date.now() - 7000000).toISOString(), thumbnail_url: "https://i.ytimg.com/vi/XqZsoesa55w/hqdefault.jpg" },
          ]);
          setLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [displayLimit]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchHistory(displayLimit, false);
    }, 30000);
    return () => clearInterval(interval);
  }, [displayLimit, fetchHistory]);

  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + 100);
    fetchHistory(displayLimit + 100, true);
  };

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    const term = filterTerm.trim().toLowerCase();

    return history.filter(item => {
      const matchesTerm = term === '' || 
        (item.titulo && item.titulo.toLowerCase().includes(term)) ||
        (item.artista && item.artista.toLowerCase().includes(term)) ||
        (item.termo_busca && item.termo_busca.toLowerCase().includes(term)) ||
        (item.pulseira_id && String(item.pulseira_id).toLowerCase().includes(term)) ||
        (item.telefone && item.telefone.includes(term));

      let matchesStatus = true;
      if (filterStatus === 'SUGERIDAS') matchesStatus = item.status === 'SUGERIDA';

      return matchesTerm && matchesStatus;
    });
  }, [history, filterTerm, filterStatus]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${date.toLocaleDateString('pt-BR')}`;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDENTE': 
        return <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black tracking-widest uppercase"><Clock size={12} /> NA FILA</span>;
      case 'TOCADO': 
        return <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black tracking-widest uppercase"><CheckCircle2 size={12} /> TOCADA</span>;
      case 'VETADO': 
        return <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black tracking-widest uppercase"><Ban size={12} /> VETADA</span>;
      case 'SUGERIDA': 
        return <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-black tracking-widest uppercase"><Lightbulb size={12} /> SUGESTÃO</span>;
      default: 
        return <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 border border-white/10 text-[10px] font-black tracking-widest uppercase">{status}</span>;
    }
  };

  const generateWhatsAppLink = (phone, musicName) => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = `55${cleanPhone}`;
    const message = `Olá player! Sua música "${musicName}" foi adicionada hoje à nossa lista de músicas disponíveis. Não esquece de pedir ela pra tocar na próxima vez que vier se divertir com a gente.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in mt-4 md:mt-0">
      <div className="flex flex-row items-center justify-between gap-4 mb-6 md:mb-8">
        <h1 className="text-xl md:text-3xl font-black text-white tracking-tight">Histórico de Pedidos</h1>
        <button
          onClick={() => navigate('/library')}
          className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white w-10 h-10 rounded-xl border border-white/10 transition-colors"
          title="Voltar para Acervo"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 md:p-6 mb-6 shadow-xl flex flex-col">
        <div className="flex flex-col md:flex-row gap-4 w-full">
          <div className="relative w-full md:flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Filtrar por música, artista ou nº pulseira..."
              className="w-full bg-[#020813] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-white/30 focus:border-cyan-500 outline-none font-medium text-sm transition-all"
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex bg-[#020813] rounded-xl p-1 border border-white/10">
              {['TODOS', 'SUGERIDAS'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                    filterStatus === status 
                      ? 'bg-cyan-600 text-white shadow-md' 
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            
            <span className="md:hidden text-[10px] font-black text-white/40 uppercase tracking-widest">
              {filteredHistory.length} Hoje
            </span>
          </div>
        </div>
        
        <div className="hidden md:flex justify-end mt-3">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {filteredHistory.length} Pedidos Hoje
          </span>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-xl flex flex-col">
        <div className="hidden md:flex items-center p-4 rounded-xl bg-[#020813]/50 border border-white/5 mb-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Música / Sugestão</span>
          </div>
          <div className="w-40 flex-shrink-0">
            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Solicitante</span>
          </div>
          <div className="w-24 text-center flex-shrink-0">
            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Unidade</span>
          </div>
          <div className="w-32 text-center flex-shrink-0">
            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Status</span>
          </div>
          <div className="w-32 text-right flex-shrink-0">
            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Data / Hora</span>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-cyan-500">
              <RefreshCw size={32} className="animate-spin mb-4" />
              <p className="text-xs font-bold tracking-widest uppercase text-center">Carregando Histórico...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/40 text-sm font-medium">Nenhum registro encontrado.</p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div key={item.id} className="flex flex-col md:flex-row md:items-center p-4 rounded-xl bg-[#020813]/30 border border-white/5 hover:bg-[#020813]/80 hover:border-white/10 transition-all gap-4">
                
                <div className="flex items-center flex-1 min-w-0">
                  {item.titulo ? (
                    <>
                      <img src={item.thumbnail_url || 'https://placehold.co/400'} alt="Thumb" className="w-12 h-12 rounded-lg object-cover border border-white/10 flex-shrink-0 mr-4 shadow-lg" loading="lazy" />
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{item.titulo}</p>
                        <p className="text-white/40 text-xs truncate mt-0.5">{item.artista}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0 border border-yellow-500/20 mr-4 shadow-lg">
                        <Lightbulb className="text-yellow-500" size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate italic">"{item.termo_busca}"</p>
                        <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mt-0.5">Sugestão Manual</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between md:w-40 flex-shrink-0 border-t border-white/5 pt-3 md:border-none md:pt-0">
                  <div className="flex flex-col items-start gap-1 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                      {item.unidade === 'DJ' ? <Headphones size={14} className="text-white/30" /> : <Ticket size={14} className="text-white/30" />}
                      <span className="text-white/80 font-mono text-sm font-bold">{item.pulseira_id || 'N/A'}</span>
                    </div>
                    {item.telefone && item.status === 'SUGERIDA' && (
                      <a
                        href={generateWhatsAppLink(item.telefone, item.termo_busca)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 mt-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all w-fit"
                        title={`Notificar cliente (${item.telefone})`}
                      >
                        <MessageCircle size={10} />
                        Avisar
                      </a>
                    )}
                  </div>
                </div>

                <div className="hidden md:flex justify-center w-24 flex-shrink-0">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border ${
                    item.unidade === 'SP' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                    item.unidade === 'BH' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {item.unidade}
                  </span>
                </div>

                <div className="flex items-center justify-between md:justify-center w-full md:w-32 flex-shrink-0">
                  <span className="md:hidden text-[10px] font-black text-white/40 uppercase tracking-widest">Status</span>
                  {getStatusBadge(item.status)}
                </div>

                <div className="flex items-center justify-between md:justify-end md:items-end flex-col w-full md:w-32 flex-shrink-0">
                  <div className="flex w-full md:w-auto justify-between md:flex-col md:items-end">
                    <span className="text-white/60 text-xs font-bold font-mono">{formatDate(item.created_at)}</span>
                    {item.tocado_em && item.status === 'TOCADO' && (
                      <span className="text-emerald-400/80 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 mt-1">
                        <CheckCircle2 size={10} /> Tocou às {formatTime(item.tocado_em)}
                      </span>
                    )}
                    {item.status === 'VETADO' && item.tocado_em && (
                      <span className="text-red-400/80 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 mt-1">
                        <Ban size={10} /> Vetado às {formatTime(item.tocado_em)}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
        
        {!loading && history.length >= displayLimit && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="bg-[#020813] hover:bg-white/5 text-white/70 font-bold py-3 px-8 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50 w-full sm:w-auto"
            >
              {isLoadingMore ? <RefreshCw size={16} className="animate-spin" /> : <ChevronDown size={16} />}
              {isLoadingMore ? 'Buscando...' : 'Carregar Mais Antigos'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}