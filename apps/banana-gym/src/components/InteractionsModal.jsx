import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Heart, Loader2 } from 'lucide-react';
import BananasIcon from './BananasIcon';
import api from '../services/api';
import { getSocket } from '../socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function InteractionsModal({ isOpen, onClose, data }) {
  const navigate = useNavigate();
  const [translateY, setTranslateY] = useState('translate-y-full');
  const [localUsers, setLocalUsers] = useState([]);
  const timeouts = useRef([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalUsers(data.users || []);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [data.users]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setTranslateY('translate-y-0'), 10);
      timeouts.current.push(t);
    } else {
      const t = setTimeout(() => setTranslateY('translate-y-full'), 10);
      timeouts.current.push(t);
    }

    return () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !data.postId || !data.type) return;

    const socket = getSocket();

    const fetchInteractionsSilently = async () => {
      try {
        const res = await api.get(`/api/gym/post/${data.postId}/interactions?type=${data.type}`);
        setLocalUsers(res.data);
      } catch (error) {
        console.error(error);
      }
    };

    const handleInteraction = (eventData) => {
      if (eventData.checkin_id === data.postId) {
        fetchInteractionsSilently();
      }
    };

    if (data.type === 'likes') {
      socket.on('gym:new_like', handleInteraction);
    } else if (data.type === 'bananas') {
      socket.on('gym:new_banana', handleInteraction);
    }

    return () => {
      socket.off('gym:new_like', handleInteraction);
      socket.off('gym:new_banana', handleInteraction);
    };
  }, [isOpen, data.postId, data.type]);

  const handleClose = () => {
    setTranslateY('translate-y-full');
    const t = setTimeout(() => {
      onClose();
    }, 300);
    timeouts.current.push(t);
  };

  if (!isOpen && translateY === 'translate-y-full') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[300] flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300" 
      onClick={handleClose}
    >
      <div 
        className={`bg-[#111] rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 border-t border-white/10 transition-transform duration-300 ease-out ${translateY}`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            {data.type === 'likes' ? <Heart className="text-red-500 fill-red-500" size={24} /> : <span className="text-2xl">🍌</span>}
            <h3 className="text-lg font-black text-white">
              {data.type === 'likes' ? 'Curtidas' : 'Bananas'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {data.loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-yellow-500" /></div>
          ) : localUsers?.length === 0 ? (
            <div className="text-center py-6 text-white/50 text-sm font-bold">Ninguém interagiu ainda. 😢</div>
          ) : (
            localUsers?.map(u => (
              <button 
                key={u.cpf}
                onClick={() => { handleClose(); setTimeout(() => navigate(`/${u.username}`), 300); }} 
                className="w-full bg-transparent p-4 flex items-center gap-4 hover:bg-white/5 transition-colors rounded-2xl active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-black overflow-hidden border border-white/10">
                  {u.foto_perfil ? (
                    <img src={`${API_URL}${u.foto_perfil}`} className="w-full h-full object-cover" alt="Perfil" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">{u.username?.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-white text-base">{u.nome}</span>
                  <span className="text-xs text-white/50">@{u.username}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}