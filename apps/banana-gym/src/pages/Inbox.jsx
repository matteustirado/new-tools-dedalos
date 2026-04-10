import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle2, Circle, Clock, Info, AlertCircle, MessageCircle, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Inbox() {
  const [todayPosts, setTodayPosts] = useState([]);
  const [pendingDuos, setPendingDuos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('gym_user'));
    
    if (storedUser) {
      setUser(storedUser);
      fetchInboxData(storedUser.cpf);
    }
  }, []);

  const fetchInboxData = async (cpf) => {
    try {
      const [activityRes, duosRes] = await Promise.all([
        axios.get(`${API_URL}/api/gym/today-activity/${cpf}`),
        axios.get(`${API_URL}/api/gym/pending-duos/${cpf}`)
      ]);
      
      setTodayPosts(activityRes.data);
      
      const duosWithStatus = duosRes.data.map(d => ({ ...d, statusLocal: 'PENDING' }));
      setPendingDuos(duosWithStatus);
    } catch (err) {
      console.error("Erro ao buscar dados da caixa de entrada");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCheckin = async (postId) => {
    try {
      const res = await axios.post(`${API_URL}/api/gym/select-checkin`, {
        colaborador_cpf: user.cpf,
        post_id: postId
      });
      
      // 👈 AQUI ATUALIZAMOS A UI BASEADA NO TOGGLE
      const isNowChecked = res.data.isNowChecked;
      
      setTodayPosts(prev => prev.map(post => ({
        ...post,
        is_checkin_valid: (post.id === postId && isNowChecked) ? 1 : 0
      })));
      
      if (isNowChecked) {
        toast.success("Check-in do dia atualizado! 🎯");
      } else {
        toast.info("Check-in desmarcado.");
      }
      
    } catch (err) {
      toast.error("Erro ao definir check-in.");
    }
  };

  const handleApproveDuo = async (postId) => {
    if (!user) return;
    setProcessingId(postId);

    try {
      const res = await axios.post(`${API_URL}/api/gym/approve-duo`, {
        post_id: postId,
        amigo_cpf: user.cpf
      });

      toast.success(res.data.message || "Aprovado com sucesso! 🍌");
      
      setPendingDuos(prev => prev.map(duo => 
        duo.post_id === postId ? { ...duo, statusLocal: 'APPROVED' } : duo
      ));
      
      fetchInboxData(user.cpf); 
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao aprovar o treino.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectDuo = async (postId) => {
    if (!user) return;
    setProcessingId(postId);

    try {
      await axios.post(`${API_URL}/api/gym/reject-duo`, {
        post_id: postId,
        amigo_cpf: user.cpf
      });

      toast.info("Convite recusado.");
      
      setPendingDuos(prev => prev.map(duo => 
        duo.post_id === postId ? { ...duo, statusLocal: 'REJECTED' } : duo
      ));
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao recusar o treino.");
    } finally {
      setProcessingId(null);
    }
  };

  const selectedPost = todayPosts.find(p => p.is_checkin_valid === 1);

  return (
    <div className="w-full min-h-screen bg-[#050505] text-white pb-24 animate-page-transition">
      <section className="p-5 border-b border-white/5 bg-[#0a0a0a]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-yellow-500">Check-in do Dia</h2>
            <p className="text-[10px] text-white/40 font-medium">Selecione a foto que valida seu treino de hoje</p>
          </div>
          <Clock size={16} className="text-white/20" />
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-24 h-32 bg-white/5 rounded-xl animate-pulse shrink-0" />
            ))}
          </div>
        ) : todayPosts.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-6 border border-dashed border-white/10 flex flex-col items-center text-center">
            <AlertCircle size={24} className="text-white/20 mb-2" />
            <p className="text-xs text-white/50">Você ainda não postou nada hoje.<br/>Poste uma foto para validar seu check-in!</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none">
            {todayPosts.map((post) => (
              <div 
                key={post.id}
                onClick={() => handleSelectCheckin(post.id)}
                className={`relative w-28 h-40 rounded-2xl overflow-hidden shrink-0 border-2 transition-all active:scale-95 cursor-pointer ${
                  post.is_checkin_valid 
                    ? 'border-yellow-500 ring-4 ring-yellow-500/20' 
                    : 'border-white/10 opacity-60'
                }`}
              >
                <img 
                  src={`${API_URL}${post.foto_treino_url}`} 
                  className="w-full h-full object-cover"
                  alt="Opção de checkin"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute top-2 right-2 z-10">
                  {post.is_checkin_valid ? (
                    <CheckCircle2 size={20} className="text-yellow-500 fill-black" />
                  ) : (
                    <Circle size={20} className="text-white/50 hover:text-white transition-colors" />
                  )}
                </div>

                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <span className={`text-[10px] font-black uppercase shadow-lg px-2 py-1 rounded-full ${post.pontos === 2 ? 'bg-yellow-500 text-black' : 'text-white'}`}>
                    {post.pontos} PTS
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 👈 O AVISO SÓ APARECE SE TIVER UMA FOTO MARCADA */}
        {selectedPost ? (
          <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
            <Info size={14} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-yellow-200/70 leading-tight">
              Esta foto será enviada ao RH à meia-noite. Você pode alterá-la ou desmarcá-la a qualquer momento hoje.
            </p>
          </div>
        ) : (
          !loading && todayPosts.length > 0 && (
            <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-white/50 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/50 leading-tight">
                Nenhum check-in selecionado. Seus pontos não serão validados pelo RH se continuar assim.
              </p>
            </div>
          )
        )}
      </section>

      <div className="p-5">
        <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">
          Mensagens e Avisos
        </h2>
        
        {pendingDuos.length > 0 ? (
           <div className="space-y-3">
             {pendingDuos.map(duo => (
               <div key={duo.post_id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-500 ${
                 duo.statusLocal === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30' : 
                 duo.statusLocal === 'REJECTED' ? 'bg-red-500/10 border-red-500/30 opacity-60' : 
                 'bg-white/5 border-white/10'
               }`}>
                 
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-full bg-black border border-white/20 overflow-hidden shrink-0">
                     {duo.amigo_foto ? (
                       <img src={`${API_URL}${duo.amigo_foto}`} alt={duo.amigo_nome} className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                         {duo.amigo_nome.charAt(0).toUpperCase()}
                       </div>
                     )}
                   </div>
                   
                   <div>
                     <p className="text-xs text-white/80 leading-tight">
                       <span className="font-bold text-white">@{duo.amigo_nome.split(' ')[0].toLowerCase()}</span> te marcou em um:
                     </p>
                     <p className="text-xs font-black text-yellow-500 uppercase tracking-wide mt-0.5">
                       Treino em Dupla
                     </p>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    {processingId === duo.post_id ? (
                       <div className="p-2"><Loader2 size={20} className="text-white/50 animate-spin" /></div>
                    ) : duo.statusLocal === 'APPROVED' ? (
                       <span className="text-xs font-black text-emerald-400 pr-2">APROVADO</span>
                    ) : duo.statusLocal === 'REJECTED' ? (
                       <span className="text-xs font-black text-red-400 pr-2">RECUSADO</span>
                    ) : (
                       <>
                         <button 
                           onClick={() => handleRejectDuo(duo.post_id)}
                           className="p-2.5 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                         >
                           <X size={18} />
                         </button>
                         <button 
                           onClick={() => handleApproveDuo(duo.post_id)}
                           className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-colors"
                         >
                           <Check size={18} />
                         </button>
                       </>
                    )}
                 </div>
               </div>
             ))}
           </div>
        ) : (
           <div className="flex flex-col items-center justify-center py-10 opacity-30">
             <MessageCircle size={40} className="mb-2" />
             <p className="text-xs">Sua caixa de entrada está limpa.</p>
           </div>
        )}
      </div>
    </div>
  );
}