import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const PodiumItem = ({ user, place }) => {
    if (!user) {
        return (
            <div className="flex-1 flex flex-col justify-end items-center opacity-30 h-40">
                <div className="w-full bg-white/5 rounded-t-xl h-10 border-t border-x border-white/10"></div>
            </div>
        );
    }

    const isGold = place === 1;
    const isSilver = place === 2;
    
    const heightClass = isGold ? 'h-32' : isSilver ? 'h-24' : 'h-16';
    
    const bgClass = isGold 
        ? 'bg-gradient-to-t from-yellow-600/40 to-yellow-400/80 border-yellow-400' 
        : isSilver 
        ? 'bg-gradient-to-t from-gray-500/40 to-gray-300/80 border-gray-300' 
        : 'bg-gradient-to-t from-amber-800/40 to-amber-600/80 border-amber-600';
    
    const shadowClass = isGold ? 'shadow-[0_0_30px_rgba(250,204,21,0.4)]' : '';

    return (
        <div className={`flex-1 flex flex-col justify-end items-center relative z-10 ${isGold ? 'z-20' : ''}`}>
            <div className="relative mb-3 flex flex-col items-center group">
                {isGold && (
                    <span className="material-symbols-outlined absolute -top-8 text-yellow-400 text-4xl drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] animate-bounce-slow">
                        workspace_premium
                    </span>
                )}
                
                <div className={`w-16 h-16 rounded-full border-2 overflow-hidden bg-black/50 ${bgClass.split(' ')[2]} ${shadowClass} group-hover:scale-110 transition-transform duration-300`}>
                    {user.foto_perfil ? (
                        <img 
                            src={`${API_URL}${user.foto_perfil}`} 
                            alt={user.nome} 
                            className="w-full h-full object-cover" 
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50 bg-black/50">
                            <span className="material-symbols-outlined text-2xl">person</span>
                        </div>
                    )}
                </div>
                
                <div className="absolute -bottom-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-black bg-white shadow-lg">
                    {place}
                </div>
            </div>
            
            <p className="text-white font-bold text-xs text-center truncate w-full px-1">
                {user.nome.split(' ')[0]}
            </p>
            <p className="text-white/60 text-[10px] font-black tracking-widest">
                {user.total_checkins} TREINOS
            </p>
            
            <div className={`w-full rounded-t-xl border-t border-x mt-2 backdrop-blur-md ${bgClass} ${heightClass} flex items-start justify-center pt-2 opacity-90`}>
                <span className="text-white/40 font-black text-3xl drop-shadow-md">{place}</span>
            </div>
        </div>
    );
};

const PodiumCard = ({ title, data }) => {
    return (
        <div className="liquid-glass rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col relative overflow-hidden bg-black/40">
            <div className="absolute top-[-50%] left-[-10%] w-full h-full bg-yellow-500/10 blur-[100px] rounded-full pointer-events-none z-0"></div>
            
            <h3 className="text-white font-black uppercase tracking-widest text-xs text-center mb-8 flex items-center justify-center gap-2 relative z-10 opacity-80">
                <span className="material-symbols-outlined text-yellow-500 text-lg">trophy</span>
                {title}
            </h3>
            
            <div className="flex items-end justify-center gap-3 mt-auto relative z-10 px-2 h-48">
                <PodiumItem user={data[1]} place={2} />
                <PodiumItem user={data[0]} place={1} />
                <PodiumItem user={data[2]} place={3} />
            </div>
        </div>
    );
};

export default function GymRanking() {
    const [rankings, setRankings] = useState({ 
        topAnual: [], 
        topMensalSP: [], 
        topMensalBH: [], 
        rankingGeral: [] 
    });
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [rankRes, feedRes] = await Promise.all([
                axios.get(`${API_URL}/api/gym/rankings`),
                axios.get(`${API_URL}/api/gym/feed?limit=20`)
            ]);
            
            setRankings(rankRes.data);
            setFeed(feedRes.data);
        } catch (err) {
            console.error("Erro ao carregar dados do Banana's Gym:", err);
            toast.error("Erro ao carregar ranking e feed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const socket = io(API_URL);

        socket.on('gym:new_post', (data) => {
            fetchData(); 
            toast.success(`💪 Novo treino registrado na unidade ${data.unidade}!`, { icon: "🍌" });
        });

        socket.on('gym:ranking_updated', () => {
            fetchData();
        });

        return () => socket.disconnect();
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return '--';
        
        const d = new Date(dateString);
        return d.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const timeAgo = (dateString) => {
        const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
        
        if (diff < 60) return 'Agora';
        if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        return `${Math.floor(diff / 86400)}d atrás`;
    };

    return (
        <div className="min-h-screen bg-[#050505] flex selection:bg-yellow-500/30">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-600/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[10%] w-[30%] h-[30%] bg-orange-600/5 rounded-full blur-[100px]"></div>
            </div>

            <Sidebar activePage="gym-ranking" group="people" />

            <main className="ml-64 flex-1 flex h-screen p-8 gap-8 overflow-hidden relative z-10">
                
                <div className="flex-1 flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-2">
                    
                    <header className="flex justify-between items-end shrink-0 bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                                    <span className="material-symbols-outlined text-white text-2xl">fitness_center</span>
                                </div>
                                <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-md">
                                    Banana's Gym
                                </h1>
                            </div>
                            <p className="text-text-muted text-sm ml-16 font-medium">
                                Ranking oficial de assiduidade e Feed de treinos da equipe Dédalos.
                            </p>
                        </div>
                    </header>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 shrink-0">
                                <PodiumCard title="Top 3 Anual (Global)" data={rankings.topAnual} />
                                <PodiumCard title="Top 3 Mês Atual (SP)" data={rankings.topMensalSP} />
                                <PodiumCard title="Top 3 Mês Atual (BH)" data={rankings.topMensalBH} />
                            </div>

                            <div className="liquid-glass rounded-3xl border border-white/10 flex flex-col flex-1 min-h-[350px] overflow-hidden bg-black/40 shadow-2xl">
                                <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                                    <h2 className="text-white font-bold flex items-center gap-3 text-lg">
                                        <span className="material-symbols-outlined text-yellow-500">format_list_numbered</span>
                                        Classificação Geral (Mês Atual)
                                    </h2>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-[#0d0d0d]/90 backdrop-blur-md z-10">
                                            <tr className="border-b border-white/10 text-xs text-text-muted font-black uppercase tracking-widest">
                                                <th className="p-4 pl-6">Posição</th>
                                                <th className="p-4">Colaborador</th>
                                                <th className="p-4">Unidade</th>
                                                <th className="p-4 text-center">Check-ins</th>
                                                <th className="p-4 text-right pr-6">Último Treino</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rankings.rankingGeral.map((user, idx) => {
                                                const positionClasses = idx === 0 
                                                    ? 'bg-yellow-500 text-black shadow-yellow-500/30' 
                                                    : idx === 1 
                                                    ? 'bg-gray-300 text-black' 
                                                    : idx === 2 
                                                    ? 'bg-amber-600 text-white' 
                                                    : 'bg-white/5 text-white/50 border border-white/10';

                                                return (
                                                    <tr key={user.colaborador_id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                                        <td className="p-4 pl-6">
                                                            <span className={`font-black text-sm w-8 h-8 flex items-center justify-center rounded-full shadow-lg ${positionClasses}`}>
                                                                {idx + 1}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-full bg-black/50 overflow-hidden border border-white/10 shadow-inner">
                                                                    {user.foto_perfil ? (
                                                                        <img src={`${API_URL}${user.foto_perfil}`} className="w-full h-full object-cover" alt={user.nome} />
                                                                    ) : (
                                                                        <span className="material-symbols-outlined text-white/30 flex items-center justify-center w-full h-full">person</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-white font-bold text-sm group-hover:text-yellow-400 transition-colors">
                                                                    {user.nome}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/70 tracking-widest border border-white/5">
                                                                {user.unidade}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="text-yellow-500 font-black text-xl">
                                                                {user.total_checkins}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right pr-6">
                                                            <span className="text-text-muted text-xs font-mono">
                                                                {formatDate(user.ultimo_checkin)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {rankings.rankingGeral.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="text-center p-12 text-text-muted">
                                                        Nenhum check-in registrado neste mês. A equipe está descansando!
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="w-[420px] liquid-glass rounded-3xl flex flex-col border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex-shrink-0 overflow-hidden bg-black/50 relative">
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-black/80 to-transparent shrink-0 relative z-10 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-white font-black text-xl flex items-center gap-2 tracking-wide">
                                <span className="material-symbols-outlined text-green-400 animate-pulse">bolt</span> 
                                Feed ao Vivo
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                            </div>
                        </div>
                        <p className="text-white/50 text-xs font-medium">
                            Acompanhe quem está treinando agora mesmo.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar relative z-10">
                        {loading ? (
                            <div className="space-y-5 animate-pulse">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white/5 rounded-2xl h-80 border border-white/5"></div>
                                ))}
                            </div>
                        ) : feed.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-white/30 p-6 text-center">
                                <span className="material-symbols-outlined text-6xl mb-4 opacity-50">motion_photos_off</span>
                                <p className="text-sm font-medium">
                                    A timeline está vazia.<br/>O primeiro a treinar inaugura o feed!
                                </p>
                            </div>
                        ) : (
                            feed.map((post) => (
                                <div key={post.id} className="liquid-glass bg-black/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl animate-in fade-in slide-in-from-right-8 duration-500 hover:border-white/20 transition-colors">
                                    
                                    <div className="p-4 flex items-center justify-between bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-black/80 overflow-hidden border-2 border-white/10 shadow-inner">
                                                {post.colaborador_foto ? (
                                                    <img src={`${API_URL}${post.colaborador_foto}`} className="w-full h-full object-cover" alt={post.colaborador_nome} />
                                                ) : (
                                                    <span className="material-symbols-outlined text-white/30 flex items-center justify-center w-full h-full">person</span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-bold leading-tight">{post.colaborador_nome}</p>
                                                <p className="text-yellow-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                                                    {post.academia_nome || 'Treinando sem localização oficial'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest bg-black/50 px-2 py-1 rounded-md">
                                            {timeAgo(post.created_at)}
                                        </span>
                                    </div>

                                    <div className="w-full aspect-square bg-[#0a0a0a] relative group overflow-hidden">
                                        <img src={`${API_URL}${post.foto_treino_url}`} alt="Treino" className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105" />
                                        
                                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black text-white border border-white/20 shadow-xl uppercase tracking-widest">
                                            {post.unidade}
                                        </div>
                                    </div>

                                    <div className="p-5 bg-gradient-to-b from-transparent to-black/80">
                                        <div className="flex items-center gap-5 mb-3">
                                            <div className="flex items-center gap-2 text-white/80 hover:text-pink-500 transition-colors cursor-default">
                                                <span className="material-symbols-outlined text-lg">favorite</span>
                                                <span className="text-sm font-black">{post.likes_count}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-white/80 hover:text-blue-400 transition-colors cursor-default">
                                                <span className="material-symbols-outlined text-lg">chat_bubble</span>
                                                <span className="text-sm font-black">{post.comments_count}</span>
                                            </div>
                                        </div>
                                        {post.mensagem && (
                                            <p className="text-sm text-white/90 font-medium leading-relaxed">
                                                <span className="font-black mr-2 text-white">{post.colaborador_nome}</span>
                                                <span className="opacity-80">{post.mensagem}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}