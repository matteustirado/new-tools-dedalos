import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function DuoProfileModal({ isOpen, onClose, duoModalData }) {
  const navigate = useNavigate();
  const [translateY, setTranslateY] = useState('translate-y-full');
  const timeouts = useRef([]);

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

  const handleClose = () => {
    setTranslateY('translate-y-full');
    const t = setTimeout(() => {
      onClose();
    }, 300);
    timeouts.current.push(t);
  };

  if (!isOpen && translateY === 'translate-y-full') return null;
  if (!duoModalData) return null;

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
          <h3 className="text-lg font-black text-white">Visitar perfil de quem?</h3>
          <button onClick={handleClose} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => { handleClose(); setTimeout(() => navigate(`/${duoModalData.colaborador_username}`), 300); }} 
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors active:scale-95"
          >
            <div className="w-12 h-12 rounded-full bg-black overflow-hidden border border-white/10">
              {duoModalData.colaborador_foto ? (
                <img src={`${API_URL}${duoModalData.colaborador_foto}`} className="w-full h-full object-cover" alt="Perfil" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                  {duoModalData.colaborador_username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-white text-base">{duoModalData.colaborador_nome}</span>
              <span className="text-xs text-white/50">@{duoModalData.colaborador_username}</span>
            </div>
          </button>

          <button 
            onClick={() => { handleClose(); setTimeout(() => navigate(`/${duoModalData.tagged_username}`), 300); }} 
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors active:scale-95"
          >
            <div className="w-12 h-12 rounded-full bg-black overflow-hidden border border-white/10">
              {duoModalData.tagged_foto ? (
                <img src={`${API_URL}${duoModalData.tagged_foto}`} className="w-full h-full object-cover" alt="Perfil" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                  {duoModalData.tagged_username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-white text-base">{duoModalData.tagged_nome}</span>
              <span className="text-xs text-yellow-500 font-semibold">@{duoModalData.tagged_username}</span>
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}