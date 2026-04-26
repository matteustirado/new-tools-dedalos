import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Users, UserX, Loader2 } from 'lucide-react';

import api from '../services/api';
import { getSocket } from '../socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Search() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCommunity = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const res = await api.get('/api/gym/community');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      
      const mockUsers = [
        { cpf: '1', nome: 'Matteus Tirado', username: 'matteus', foto_perfil: null },
        { cpf: '2', nome: 'Carlos Silva', username: 'carlos.silva', foto_perfil: null },
        { cpf: '3', nome: 'Ana Souza', username: 'anasouza', foto_perfil: null },
        { cpf: '4', nome: 'Bruno Costa', username: 'brunoc', foto_perfil: null },
      ];
      setUsers(mockUsers);
    } finally {
      if (!silent) {
        setLoading(false);
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
    fetchCommunity();
  }, [fetchCommunity]);

  useEffect(() => {
    const socket = getSocket();

    const handleUpdate = () => {
      fetchCommunity(true);
    };

    socket.on('gym:profile_updated', handleUpdate);
    socket.on('gym:new_user', handleUpdate);

    return () => {
      socket.off('gym:profile_updated', handleUpdate);
      socket.off('gym:new_user', handleUpdate);
    };
  }, [fetchCommunity]);

  const filteredUsers = users.filter((u) => {
    if (!searchTerm) return true;
    const lowerText = searchTerm.toLowerCase();
    return u.nome.toLowerCase().includes(lowerText) ||
           (u.username && u.username.toLowerCase().includes(lowerText));
  });

  return (
    <div className="w-full relative overflow-x-hidden min-h-screen pb-24 flex flex-col animate-page-transition bg-[#050505]">
      <div className="px-5 pt-6 pb-4 border-b border-white/10 sticky top-0 bg-[#050505]/95 backdrop-blur-xl z-20">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
            <SearchIcon size={20} />
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuários..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-10 text-white/50 space-y-3 mt-10">
            <Loader2 size={32} className="animate-spin text-yellow-500" />
            <span className="text-sm font-bold uppercase tracking-widest">Carregando...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-white/30 space-y-3 mt-10 text-center px-6">
            <UserX size={40} className="mb-2" />
            <span className="text-sm font-bold">Nenhum usuário encontrado.</span>
            <span className="text-xs">Tente buscar por outro nome ou @username.</span>
          </div>
        ) : (
          <div className="flex flex-col animate-fade-in-up">
            <div className="px-5 py-3 border-b border-white/5">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                <Users size={12} /> Comunidade ({filteredUsers.length})
              </span>
            </div>
            
            {filteredUsers.map((u) => {
              const displayUsername = u.username || u.nome.split(' ')[0].toLowerCase();

              return (
                <Link
                  key={u.cpf}
                  to={`/${displayUsername}`}
                  className="flex items-center px-5 py-4 border-b border-white/5 hover:bg-white/[0.05] active:bg-white/10 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full bg-black/80 overflow-hidden border border-white/10 shrink-0 shadow-md group-hover:border-yellow-500/50 transition-colors">
                    {u.foto_perfil ? (
                      <img
                        src={`${API_URL}${u.foto_perfil}`}
                        alt={u.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/50 text-lg font-black">
                        {u.username ? u.username.charAt(0).toUpperCase() : u.nome.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex-1 flex flex-col justify-center">
                    <span className="text-sm font-bold text-yellow-500 tracking-wide mb-0.5">
                      @{displayUsername}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white/80 truncate max-w-[150px] md:max-w-xs group-hover:text-white transition-colors">
                        {u.nome}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}