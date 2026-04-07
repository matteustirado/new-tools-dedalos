import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Camera,
  Image as ImageIcon,
  Timer,
  Dumbbell,
  Utensils,
  Users,
  Lock
} from 'lucide-react';

const POST_OPTIONS = [
  { id: 'realtime', title: 'Tempo Real', pts: '+1 Ponto', icon: Camera, color: 'text-emerald-400', bg: 'bg-emerald-400/10', isLocked: false },
  { id: 'upload', title: 'Carregar Foto', pts: '+0.5 Ponto', icon: ImageIcon, color: 'text-orange-400', bg: 'bg-orange-400/10', isLocked: false },
  { id: 'run', title: 'Corrida', pts: '0 Pontos', icon: Timer, color: 'text-blue-400', bg: 'bg-blue-400/10', isLocked: true },
  { id: 'tip', title: 'Dica de Treino', pts: '0 Pontos', icon: Dumbbell, color: 'text-purple-400', bg: 'bg-purple-400/10', isLocked: true },
  { id: 'recipe', title: 'Receita Fitness', pts: '0 Pontos', icon: Utensils, color: 'text-pink-400', bg: 'bg-pink-400/10', isLocked: true },
  { id: 'duo', title: 'Treino em Dupla', pts: '+2 Pontos', icon: Users, color: 'text-yellow-400', bg: 'bg-yellow-400/10', isBonus: true, isLocked: true },
];

export default function CreatePostMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [startY, setStartY] = useState(null);
  const [currentY, setCurrentY] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentY(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const captureLocationAndNavigate = (rawPhotoData) => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          navigate('/crop', { 
            state: { photo: rawPhotoData, location: locationData } 
          });
        },
        (error) => {
          toast.warning("GPS desativado. Localização não será salva.");
          navigate('/crop', { 
            state: { photo: rawPhotoData, location: null } 
          });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      navigate('/crop', { 
        state: { photo: rawPhotoData, location: null } 
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas imagens.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onClose();
      captureLocationAndNavigate(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleOptionClick = (event, option) => {
    event.stopPropagation();

    if (option.isLocked) {
      toast.info('Em breve! Esta funcionalidade será liberada nas próximas atualizações. 🚧');
      return;
    }

    if (option.id === 'realtime') {
      onClose();
      navigate('/camera');
    } else if (option.id === 'upload') {
      fileInputRef.current?.click();
    }
  };

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!startY) return;
    const y = e.touches[0].clientY;
    const diff = y - startY;
    
    if (diff > 0) {
      setCurrentY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 80) {
      onClose();
    }
    setStartY(null);
    setCurrentY(0);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] border-t border-white/10 rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] overflow-hidden transition-transform duration-300"
        style={{ transform: `translateY(${currentY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="flex flex-col items-center mb-6 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-white/20 rounded-full mb-5"></div>
          <h2 className="text-xl font-black text-white tracking-tight w-full text-left">
            O que vamos postar? 🍌
          </h2>
        </div>

        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />

        <div className="space-y-3">
          {POST_OPTIONS.map((option) => {
            const Icon = option.icon;
            const baseButtonClass = "w-full flex items-center justify-between p-4 border rounded-2xl transition-all";
            const lockedStateClass = "bg-white/5 border-white/5 opacity-50 cursor-not-allowed";
            const activeStateClass = "bg-white/5 hover:bg-white/10 border-white/10 active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.1)]";

            return (
              <button
                key={option.id}
                onClick={(e) => handleOptionClick(e, option)}
                className={`${baseButtonClass} ${option.isLocked ? lockedStateClass : activeStateClass}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${option.bg} ${option.color} ${option.isLocked ? 'grayscale opacity-70' : ''}`}>
                    <Icon size={24} />
                  </div>
                  <span className={`font-bold text-base ${option.isLocked ? 'text-white/50' : 'text-white'}`}>
                    {option.title}
                  </span>
                </div>

                {option.isLocked ? (
                  <div className="px-3 py-1.5 rounded-full bg-black/50 border border-white/10 text-white/40 flex items-center gap-1.5">
                    <Lock size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      Em breve
                    </span>
                  </div>
                ) : (
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${
                      option.isBonus
                        ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                        : option.id === 'upload' 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {option.pts}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}