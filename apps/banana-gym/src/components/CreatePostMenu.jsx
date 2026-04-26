import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Camera,
  Image as ImageIcon,
  Dumbbell,
  Utensils,
  Users,
  Lock,
  Activity,
  ChevronRight,
  X 
} from 'lucide-react';
import api from '../services/api';

const POST_OPTIONS = [
  { id: 'realtime', title: 'Tempo Real', pts: '+1 Ponto', icon: Camera, color: 'text-emerald-400', bg: 'bg-emerald-400/10', isLocked: false },
  { id: 'upload', title: 'Carregar Foto', pts: '+0.5 Ponto', icon: ImageIcon, color: 'text-blue-400', bg: 'bg-blue-400/10', isLocked: false },
  { id: 'run', title: 'Corrida (Strava)', pts: '+0.5 Ponto', icon: Activity, color: 'text-[#FC4C02]', bg: 'bg-[#FC4C02]/10', isLocked: false },
  { id: 'duo', title: 'Treino em Dupla', pts: '+2 Pontos', icon: Users, color: 'text-yellow-500', bg: 'bg-yellow-500/10', isBonus: true, isLocked: false },
  { id: 'tip', title: 'Dica de Treino', pts: '0 Pontos', icon: Dumbbell, color: 'text-purple-400', bg: 'bg-purple-400/10', isLocked: true },
  { id: 'recipe', title: 'Receita Fitness', pts: '0 Pontos', icon: Utensils, color: 'text-pink-400', bg: 'bg-pink-400/10', isLocked: true },
];

const FUN_PHRASES = [
  "Amarrando o tênis... 👟",
  "Abrindo o Strava... 📱",
  "Calculando seu Pace... ⏱️",
  "Buscando seus quilômetros... 🏃‍♂️",
  "Preparando seu card... 🍌"
];

export default function CreatePostMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [viewState, setViewState] = useState('menu');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [translateY, setTranslateY] = useState('translate-y-full');
  
  const timeouts = useRef([]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setTranslateY('translate-y-0'), 10);
      timeouts.current.push(t);
    } else {
      const t = setTimeout(() => {
        setTranslateY('translate-y-full');
        setViewState('menu');
        setPhraseIndex(0);
      }, 10);
      timeouts.current.push(t);
    }

    return () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
    };
  }, [isOpen]);

  useEffect(() => {
    let interval;
    if (viewState === 'loading') {
      interval = setInterval(() => {
        setPhraseIndex((prev) => (prev + 1) % FUN_PHRASES.length);
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [viewState]);

  const handleCloseMenu = () => {
    setTranslateY('translate-y-full');
    const t = setTimeout(() => {
      onClose();
    }, 300);
    timeouts.current.push(t);
  };

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
        () => {
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
      captureLocationAndNavigate(reader.result);
      setTimeout(() => handleCloseMenu(), 100); 
    };
    reader.readAsDataURL(file);
  };

  const handleFetchRun = async () => {
    const storedUser = localStorage.getItem('gym_user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    
    const user = JSON.parse(storedUser);

    if (!user.has_strava || user.has_strava === 0 || user.has_strava === '0') {
      setViewState('promo'); 
      return;
    }

    setViewState('loading');
    
    try {
      const res = await api.post('/api/gym/strava/fetch-run', { cpf: user.cpf });
      
      setTimeout(() => {
        navigate('/edit-post', { 
          state: { 
            isRun: true, 
            runData: res.data.run
          } 
        });
        setTimeout(() => handleCloseMenu(), 10);
      }, 1500);

    } catch (err) {
      setViewState('menu');
      toast.error(err.response?.data?.error || 'Erro ao puxar dados da corrida.');
    }
  };

  const handleOptionClick = (event, option) => {
    event.stopPropagation();

    if (option.isLocked) {
      toast.info('Em breve! Esta funcionalidade será liberada nas próximas atualizações. 🚧');
      return;
    }

    if (option.id === 'realtime') {
      navigate('/camera');
      setTimeout(() => handleCloseMenu(), 10);
    } else if (option.id === 'upload') {
      fileInputRef.current?.click();
    } else if (option.id === 'run') {
      handleFetchRun();
    } else if (option.id === 'duo') {
      navigate('/camera', { state: { isDuo: true } });
      setTimeout(() => handleCloseMenu(), 10);
    }
  };

  if (!isOpen && translateY === 'translate-y-full') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      onClick={handleCloseMenu}
    >
      <div
        className={`bg-[#111] border-t border-white/10 rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 shadow-2xl transition-transform duration-300 ease-out relative min-h-[400px] flex flex-col ${translateY}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-lg font-black text-white tracking-tight w-full text-left">
            {viewState === 'menu' ? 'O que vamos postar? 🍌' : ''}
            {viewState === 'promo' ? 'Conexão Strava' : ''}
            {viewState === 'loading' ? 'Puxando Corrida...' : ''}
          </h2>
          <button 
            onClick={handleCloseMenu} 
            className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full transition-colors shrink-0 ml-4"
          >
            <X size={20} />
          </button>
        </div>

        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />

        <div className="flex-1 flex flex-col justify-center">
          {viewState === 'menu' && (
            <div className="space-y-3 animate-fade-in">
              {POST_OPTIONS.map((option) => {
                const Icon = option.icon;
                const baseButtonClass = "w-full flex items-center justify-between p-4 border rounded-2xl transition-all relative overflow-hidden";
                const lockedStateClass = "bg-white/5 border-white/5 opacity-50 cursor-not-allowed";
                const activeStateClass = "bg-white/5 hover:bg-white/10 border-white/10 active:scale-95";

                const badgeColors = {
                  realtime: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
                  upload: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
                  run: 'bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/30',
                  duo: 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]',
                  bonus: 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                };

                return (
                  <button
                    key={option.id}
                    onClick={(e) => handleOptionClick(e, option)}
                    className={`${baseButtonClass} ${option.isLocked ? lockedStateClass : activeStateClass}`}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`p-3 rounded-xl ${option.bg} ${option.color} ${option.isLocked ? 'grayscale opacity-70' : ''}`}>
                        <Icon size={24} />
                      </div>
                      <span className={`font-bold text-base ${option.isLocked ? 'text-white/50' : 'text-white'}`}>
                        {option.title}
                      </span>
                    </div>

                    <div className="relative z-10">
                      {option.isLocked ? (
                        <div className="px-3 py-1.5 rounded-full bg-black/50 border border-white/10 text-white/40 flex items-center gap-1.5">
                          <Lock size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Em breve</span>
                        </div>
                      ) : (
                        <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${option.isBonus ? badgeColors.bonus : badgeColors[option.id]}`}>
                          {option.pts}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {viewState === 'promo' && (
            <div className="flex flex-col items-center text-center animate-fade-in-up space-y-6 py-4">
              <div className="w-20 h-20 bg-[#FC4C02]/10 rounded-full flex items-center justify-center border-2 border-[#FC4C02]/30 relative">
                 <Activity size={40} className="text-[#FC4C02]" />
                 <div className="absolute -bottom-2 -right-2 bg-black rounded-full p-1">
                   <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                     <X size={14} className="text-white" />
                   </div>
                 </div>
              </div>
              
              <div>
                <p className="text-white/70 text-sm font-medium px-4">
                  Para importar suas corridas automaticamente e ganhar <strong className="text-[#FC4C02]">+0.5 pts</strong>, você precisa vincular sua conta do Strava.
                </p>
              </div>

              <button 
                onClick={() => {
                  handleCloseMenu(); 
                  setTimeout(() => navigate('/edit-profile'), 150); 
                }}
                className="w-full bg-[#FC4C02] text-white font-black py-4 rounded-xl hover:bg-[#E34402] transition-colors shadow-lg shadow-[#FC4C02]/20 flex justify-center items-center gap-2"
              >
                Conectar Conta Strava <ChevronRight size={20} />
              </button>
              
              <button onClick={() => setViewState('menu')} className="text-white/40 text-sm font-bold hover:text-white transition-colors">
                Voltar para opções
              </button>
            </div>
          )}

          {viewState === 'loading' && (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in h-48 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 bg-[#FC4C02]/10 rounded-full border-2 border-[#FC4C02]/30 flex items-center justify-center relative z-10">
                  <Activity size={40} className="text-[#FC4C02] animate-bounce" />
                </div>
                <div className="absolute inset-0 border-4 border-[#FC4C02]/20 rounded-full animate-ping"></div>
                <div className="absolute -inset-4 border-2 border-[#FC4C02]/10 rounded-full animate-ping" style={{ animationDelay: '200ms' }}></div>
              </div>
              
              <div className="h-8 flex items-center justify-center">
                <p className="text-lg font-bold text-white/90 animate-fade-in" key={phraseIndex}>
                  {FUN_PHRASES[phraseIndex]}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}