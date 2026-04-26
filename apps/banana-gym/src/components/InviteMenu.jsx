import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, TreePine, UtensilsCrossed, Coffee, Bike, Dumbbell, Flame, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const INVITE_OPTIONS = [
  { id: 'park', title: 'Passeio no parque', icon: TreePine, color: 'text-emerald-500' },
  { id: 'lunch', title: 'Almoço especial', icon: UtensilsCrossed, color: 'text-orange-500' },
  { id: 'dinner', title: 'Jantar de negócios', icon: Coffee, color: 'text-blue-400' },
  { id: 'bike', title: 'Pedalada ao ar livre', icon: Bike, color: 'text-cyan-400' },
  { id: 'gym', title: 'Academia do prédio', icon: Dumbbell, color: 'text-purple-500' },
  { id: 'bananada', title: 'Bananada', icon: Flame, color: 'text-red-500', isHot: true },
];

export default function InviteMenu({ isOpen, onClose, targetUsername, currentUser }) {
  const [step, setStep] = useState('list'); 
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [translateY, setTranslateY] = useState('translate-y-full');
  
  const timeouts = useRef([]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setTranslateY('translate-y-0'), 10); 
      timeouts.current.push(t);
    }

    return () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isSending) return;
    setTranslateY('translate-y-full');
    const t = setTimeout(() => {
      onClose();
      setStep('list');
      setSelectedInvite(null);
      setDate('');
      setTime('');
      setIsSending(false);
    }, 300); 
    timeouts.current.push(t);
  };

  const handleSend = async () => {
    if (!date || !time) {
      toast.warning("Selecione data e hora!");
      return;
    }

    try {
      const [year, month, day] = date.split('-');
      const [hour, minute] = time.split(':');
      const eventDateTime = new Date(year, month - 1, day, hour, minute);
      const now = new Date();

      if (eventDateTime < now) {
        toast.warning("O horário do rolê precisa ser no futuro! ⏰");
        return;
      }

      setIsSending(true);
      
      await new Promise(resolve => {
        const t = setTimeout(resolve, 50);
        timeouts.current.push(t);
      });
      
      await api.post('/api/gym/send-invite', {
        sender_cpf: currentUser.cpf,
        receiver_username: targetUsername,
        invite_type: selectedInvite.id,
        event_date: eventDateTime.toISOString()
      });

      setStep('success');
      setIsSending(false);
      
      const closeTimer = setTimeout(() => {
        handleClose();
      }, 2000);
      timeouts.current.push(closeTimer);

    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Erro ao enviar convite.");
      setIsSending(false);
    } 
  };

  if (!isOpen) return null;

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
          <h3 className="text-lg font-black text-white">
            {step === 'list' ? `Convide @${targetUsername}` : step === 'success' ? 'Sucesso!' : 'Detalhes do Convite'}
          </h3>
          <button onClick={handleClose} disabled={isSending} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full transition-colors disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        {step === 'list' && (
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1 pb-4 custom-scrollbar">
            {INVITE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setSelectedInvite(option);
                    setStep('datetime');
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all active:scale-95 group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-black border border-white/10 group-hover:scale-110 transition-transform ${option.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="font-bold text-white text-sm">{option.title}</span>
                  </div>
                  {option.isHot && (
                    <span className="text-[9px] font-black bg-red-500/20 text-red-500 px-2 py-1 rounded border border-red-500/30 uppercase tracking-widest animate-pulse">
                      HOT
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {step === 'datetime' && selectedInvite && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
              <selectedInvite.icon size={24} className={selectedInvite.color} />
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider font-bold mb-0.5">Tipo de Convite</p>
                <p className="text-sm font-bold text-white">{selectedInvite.title}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Calendar size={14} /> Data do Rolê
                </label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-[#050505] border border-white/20 text-white rounded-xl p-3 focus:outline-none focus:border-yellow-500 appearance-none min-h-[50px]"
                  style={{ colorScheme: 'dark' }} 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Clock size={14} /> Horário
                </label>
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-[#050505] border border-white/20 text-white rounded-xl p-3 focus:outline-none focus:border-yellow-500 appearance-none min-h-[50px]"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button 
                onClick={() => setStep('list')}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white bg-white/5 hover:bg-white/10 transition-colors"
                disabled={isSending}
              >
                Voltar
              </button>
              <button 
                onClick={handleSend}
                className="flex-1 py-3.5 rounded-xl font-black text-sm text-black bg-yellow-500 hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                disabled={isSending}
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : 'Enviar Convite'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-10 animate-fade-in gap-4 text-center">
             <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/50">
               <CheckCircle2 size={40} className="text-emerald-500" />
             </div>
             <div>
               <h4 className="text-xl font-black text-white mb-2">Convite Enviado!</h4>
               <p className="text-sm text-white/60">Agora é só aguardar @{targetUsername} aceitar.</p>
             </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}