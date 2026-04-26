import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, User } from 'lucide-react';

import api from '../services/api';
import { getSocket } from '../socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TopCircle = ({ user, position }) => {
  const isFirst = position === 1;
  const isSecond = position === 2;

  const ringColor = isFirst 
    ? 'ring-yellow-400' 
    : isSecond 
      ? 'ring-gray-300' 
      : 'ring-amber-600';
      
  const badgeColor = isFirst 
    ? 'bg-yellow-500 text-black' 
    : isSecond 
      ? 'bg-gray-300 text-black' 
      : 'bg-amber-600 text-white';
      
  const sizeClass = isFirst 
    ? 'w-20 h-20 md:w-24 md:h-24' 
    : 'w-16 h-16 md:w-20 md:h-20';

  const profilePath = user 
    ? `/${user.username || user.nome.split(' ')[0].toLowerCase()}` 
    : '#';

  return (
    <div className={`flex flex-col items-center gap-2 ${isFirst ? '-mt-6 z-10' : 'z-0'}`}>
      <Link
        to={profilePath}
        className={`relative rounded-full ring-4 ${ringColor} ${sizeClass} bg-white/5 flex items-center justify-center shadow-2xl transition-transform hover:scale-105`}
      >
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
          {user?.foto_perfil ? (
            <img 
              src={`${API_URL}${user.foto_perfil}`} 
              alt={user.nome} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <User size={isFirst ? 36 : 28} className="text-white/30" />
          )}
        </div>

        <div className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full ${badgeColor} flex items-center justify-center text-[11px] font-black border-4 border-[#050505] z-20 shadow-lg`}>
          {position}
        </div>
      </Link>

      {user ? (
        <div className="flex flex-col items-center mt-1">
          <span className="text-white font-bold text-xs truncate w-20 text-center drop-shadow-md">
            {user.username ? `@${user.username}` : user.nome.split(' ')[0]}
          </span>
          <span className="text-yellow-500 font-black text-[10px] drop-shadow-md">
            {user.pontos} pts
          </span>
        </div>
      ) : (
        <span className="text-white/30 text-xs font-medium mt-1">-</span>
      )}
    </div>
  );
};

export default function Ranking() {
  const [ranking, setRanking] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRanking = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const res = await api.get('/api/gym/rankings');

      const rankingReal = res.data.rankingGeral
        .map(u => ({
          ...u,
          pontos: u.total_pontos || u.total_checkins || 0
        }))
        .filter(u => u.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 30)
        .map((u, index) => ({ ...u, rankPos: index + 1 }));

      setRanking(rankingReal);
    } catch (err) {
      console.error(err);
      
      const mock = [
        { colaborador_id: '1', nome: 'Carlos Silva', username: 'carlos', foto_perfil: null, pontos: 45 },
        { colaborador_id: '2', nome: 'Matteus Tirado', username: 'matteus', foto_perfil: null, pontos: 42 },
        { colaborador_id: '3', nome: 'Ana Souza', username: 'ana', foto_perfil: null, pontos: 38 },
        { colaborador_id: '4', nome: 'Bruno Costa', username: 'bruno', foto_perfil: null, pontos: 25 },
        { colaborador_id: '5', nome: 'Julia Lima', username: 'julial', foto_perfil: null, pontos: 12 },
      ].map((u, i) => ({ ...u, rankPos: i + 1 }));

      setRanking(mock);
    } finally {
      setLoading(false);
      
      if (!silent) {
        setTimeout(() => {
          const savedPosition = sessionStorage.getItem(`scroll_pos_${window.location.pathname}`);
          if (savedPosition) {
            window.scrollTo({ top: parseInt(savedPosition, 10), behavior: 'instant' });
          }
        }, 50);
      }
    }
  }, []);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  useEffect(() => {
    const socket = getSocket();

    const handleRankingUpdate = () => {
      fetchRanking(true);
    };

    socket.on('gym:ranking_updated', handleRankingUpdate);

    return () => {
      socket.off('gym:ranking_updated', handleRankingUpdate);
    };
  }, [fetchRanking]);

  const filteredRanking = ranking.filter(u => {
    if (!searchTerm) return true;
    const lowerText = searchTerm.toLowerCase();
    return u.nome.toLowerCase().includes(lowerText) || 
           (u.username && u.username.toLowerCase().includes(lowerText));
  });

  const first = ranking[0] || null;
  const second = ranking[1] || null;
  const third = ranking[2] || null;

  return (
    <div className="w-full relative overflow-x-hidden min-h-screen pb-24 flex flex-col bg-[#050505] animate-page-transition">
      <div className="w-full pt-10 pb-6 bg-[#050505] flex items-center justify-center gap-6 md:gap-10 border-b border-white/5 shadow-lg relative z-20">
        <TopCircle user={second} position={2} />
        <TopCircle user={first} position={1} />
        <TopCircle user={third} position={3} />
      </div>

      <div className="px-5 py-4 sticky top-0 bg-[#050505]/95 backdrop-blur-xl z-30 border-b border-white/5">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
            <SearchIcon size={20} />
          </div>
          
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar no Top 30..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all font-medium text-sm"
          />
        </div>
      </div>

      <div className="w-full flex-1 pt-6 px-4 pb-4">
        <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4 ml-2 flex items-center justify-between">
          <span>Global (Top 30)</span>
          {ranking.length > 0 && <span>{ranking.length} Atletas</span>}
        </h2>

        {loading ? (
          <div className="text-center text-white/50 text-sm py-10">
            Calculando posições...
          </div>
        ) : filteredRanking.length === 0 ? (
          <div className="text-center text-white/50 text-sm py-10">
            {searchTerm ? "Nenhum usuário encontrado na busca." : "A lista está vazia este mês!"}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredRanking.map((user) => (
              <Link
                to={`/${user.username || user.nome.split(' ')[0].toLowerCase()}`}
                key={user.colaborador_id}
                className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl p-3 hover:bg-white/[0.05] active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 text-center">
                    <span className="text-sm font-black text-white/40">{user.rankPos}º</span>
                  </div>

                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                    {user.foto_perfil ? (
                      <img 
                        src={`${API_URL}${user.foto_perfil}`} 
                        alt={user.nome} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <User size={18} className="text-white/40" />
                    )}
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-sm font-bold text-white truncate max-w-[140px] md:max-w-[200px]">
                      {user.nome}
                    </span>
                    <span className="text-[10px] font-medium text-yellow-500 tracking-wider">
                      @{user.username || user.nome.split(' ')[0].toLowerCase()}
                    </span>
                  </div>
                </div>

                <div className="bg-black/30 px-3 py-1.5 rounded-xl border border-white/5">
                  <span className="text-sm font-black text-white">
                    {user.pontos} <span className="text-[10px] text-white/50 font-bold uppercase">pts</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}