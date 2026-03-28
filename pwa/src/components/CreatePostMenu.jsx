import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Image as ImageIcon,
  Timer,
  Dumbbell,
  Utensils,
  Users,
  X,
  Lock
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function CreatePostMenu({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const options = [
    { id: 'realtime', title: 'Tempo Real', pts: '+1 Ponto', icon: Camera, color: 'text-emerald-400', bg: 'bg-emerald-400/10', isLocked: false },
    { id: 'upload', title: 'Carregar Foto', pts: '+0.5 Ponto', icon: ImageIcon, color: 'text-blue-400', bg: 'bg-blue-400/10', isLocked: true },
    { id: 'run', title: 'Corrida', pts: '0 Pontos', icon: Timer, color: 'text-orange-400', bg: 'bg-orange-400/10', isLocked: true },
    { id: 'tip', title: 'Dica de Treino', pts: '0 Pontos', icon: Dumbbell, color: 'text-purple-400', bg: 'bg-purple-400/10', isLocked: true },
    { id: 'recipe', title: 'Receita Fitness', pts: '0 Pontos', icon: Utensils, color: 'text-pink-400', bg: 'bg-pink-400/10', isLocked: true },
    { id: 'duo', title: 'Treino em Dupla', pts: '+2 Pontos', icon: Users, color: 'text-yellow-400', bg: 'bg-yellow-400/10', isBonus: true, isLocked: true },
  ];

  const handleOptionClick = (opt) => {
    if (opt.isLocked) {
      toast.info('Em breve! Esta funcionalidade será liberada nas próximas atualizações. 🚧');
      return;
    }

    onClose();
    navigate('/camera');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] border-t border-white/10 rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">O que vamos postar? 🍌</h2>
          
          <button
            onClick={onClose}
            className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {options.map((opt) => {
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                onClick={() => handleOptionClick(opt)}
                className={`w-full flex items-center justify-between p-4 border rounded-2xl transition-all ${
                  opt.isLocked
                    ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${opt.bg} ${opt.color} ${opt.isLocked ? 'grayscale opacity-70' : ''}`}>
                    <Icon size={24} />
                  </div>
                  <span className={`font-bold text-base ${opt.isLocked ? 'text-white/50' : 'text-white'}`}>
                    {opt.title}
                  </span>
                </div>

                {opt.isLocked ? (
                  <div className="px-3 py-1.5 rounded-full bg-black/50 border border-white/10 text-white/40 flex items-center gap-1.5">
                    <Lock size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Em breve</span>
                  </div>
                ) : (
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${
                      opt.isBonus
                        ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {opt.pts}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}