import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Info, 
  AlertCircle, 
  MessageCircle, 
  X, 
  Loader2, 
  Camera, 
  Image as ImageIcon 
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { getSocket } from '../socket';

const INVITE_DICTIONARY = {
  'park': 'Passeio no parque',
  'lunch': 'Almoço especial',
  'dinner': 'Jantar de negócios',
  'bike': 'Pedalada ao ar livre',
  'gym': 'Academia do prédio',
  'bananada': 'Bananada 🔥'
};

export default function Inbox() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const observer = useRef();

  const [user] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [todayPosts, setTodayPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [activeRoleForUpload, setActiveRoleForUpload] = useState(null);

  const fetchTodayActivity = useCallback(async (cpf) => {
    try {
      const res = await api.get(`/api/gym/today-activity/${cpf}`);
      setTodayPosts(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchNotifications = useCallback(async (cpf, pageNum) => {
    if (pageNum === 1) setLoadingInitial(true);
    else setLoadingMore(true);

    try {
      const res = await api.get(`/api/gym/pending-duos/${cpf}?page=${pageNum}&limit=15`);
      
      if (res.data.length < 15) {
        setHasMore(false);
      }

      setNotifications(prev => {
        if (pageNum === 1) return res.data;
        const existingIds = new Set(prev.map(n => `${n.tipo}-${n.post_id}`));
        const newUnique = res.data.filter(n => !existingIds.has(`${n.tipo}-${n.post_id}`));
        return [...prev, ...newUnique];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  }, []);

  const lastNotificationElementRef = useCallback(node => {
    if (loadingInitial || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loadingInitial, loadingMore, hasMore]);

  useEffect(() => {
    if (user) {
      fetchTodayActivity(user.cpf);
    }
  }, [user, fetchTodayActivity]);

  useEffect(() => {
    if (user) {
      fetchNotifications(user.cpf, page);
    }
  }, [user, page, fetchNotifications]);

  useEffect(() => {
    if (!user?.cpf) return;
    
    const socket = getSocket();
    
    const handleNewNotification = (data) => {
      if (data.receiverCpf === user.cpf) {
        setPage(1); 
        fetchNotifications(user.cpf, 1);
      }
    };

    socket.on('gym:new_notification', handleNewNotification);
    
    return () => {
      socket.off('gym:new_notification', handleNewNotification);
    };
  }, [user, fetchNotifications]);

  const handleSelectCheckin = async (postId) => {
    const isCurrentlyChecked = todayPosts.find(p => p.id === postId)?.is_checkin_valid === 1;
    
    setTodayPosts(prev => prev.map(post => ({
      ...post,
      is_checkin_valid: (post.id === postId && !isCurrentlyChecked) ? 1 : 0
    })));

    try {
      await api.post('/api/gym/select-checkin', {
        post_id: postId
      });
    } catch (err) {
      console.error(err);
      fetchTodayActivity(user.cpf);
      toast.error("Falha ao salvar a marcação. Verifique a conexão.");
    }
  };

  const handleApprove = async (notification) => {
    if (!user) return;
    setProcessingId(`${notification.tipo}-${notification.post_id}`);

    try {
      if (notification.statusLocal === 'PHOTO_PENDING') {
        const targetId = notification.tipo === 'social_invite' ? notification.linked_checkin_id : notification.post_id;
        await api.post('/api/gym/approve-duo', {
          post_id: targetId
        });
        fetchTodayActivity(user.cpf); 
      } else if (notification.statusLocal === 'INVITE_PENDING') {
        await api.post('/api/gym/answer-social-invite', { 
          invite_id: notification.post_id,
          action: 'approve'
        });
      }
      
      setNotifications(prev => prev.map(n => 
        (n.post_id === notification.post_id && n.tipo === notification.tipo) 
          ? { ...n, statusLocal: notification.statusLocal === 'PHOTO_PENDING' ? 'PHOTO_APPROVED' : 'INVITE_ACCEPTED' }
          : n
      ));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Erro de conexão ao aprovar.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (notification) => {
    if (!user) return;
    setProcessingId(`${notification.tipo}-${notification.post_id}`);

    try {
      if (notification.statusLocal === 'PHOTO_PENDING') {
        const targetId = notification.tipo === 'social_invite' ? notification.linked_checkin_id : notification.post_id;
        await api.post('/api/gym/reject-duo', {
          post_id: targetId
        });
      } else if (notification.statusLocal === 'INVITE_PENDING') {
        await api.post('/api/gym/answer-social-invite', { 
          invite_id: notification.post_id,
          action: 'reject'
        });
      }
      
      setNotifications(prev => prev.map(n => 
        (n.post_id === notification.post_id && n.tipo === notification.tipo) 
          ? { ...n, statusLocal: notification.statusLocal === 'PHOTO_PENDING' ? 'PHOTO_REJECTED' : 'INVITE_REJECTED' } 
          : n
      ));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Erro de conexão ao recusar.");
    } finally {
      setProcessingId(null);
    }
  };

  const triggerNativeFilePicker = (notification) => {
    setActiveRoleForUpload(notification); 
    fileInputRef.current.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        navigate('/crop', { 
          state: {
            photo: reader.result, 
            isDuo: false, 
            socialInvite: activeRoleForUpload 
          }
        });
      };
      reader.readAsDataURL(file);
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

        {loadingInitial && page === 1 ? (
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
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${post.foto_treino_url}`} 
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

        {selectedPost ? (
          <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
            <Info size={14} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-yellow-200/70 leading-tight">
              Esta foto será enviada ao RH à meia-noite. Você pode alterá-la ou desmarcá-la a qualquer momento hoje.
            </p>
          </div>
        ) : (
          !loadingInitial && todayPosts.length > 0 && (
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
        
        {loadingInitial && page === 1 ? (
            <div className="flex justify-center py-10">
              <Loader2 size={32} className="animate-spin text-yellow-500" />
            </div>
        ) : notifications.length > 0 ? (
           <div className="space-y-3">
             {notifications.map((notif, index) => {
               const isLast = notifications.length === index + 1;
               const status = notif.statusLocal;
               const isInvitePending = status === 'INVITE_PENDING';
               const isInviteRejected = status === 'INVITE_REJECTED';
               const isInviteAccepted = status === 'INVITE_ACCEPTED';
               const isPhotoPending = status === 'PHOTO_PENDING';
               const isPhotoRejected = status === 'PHOTO_REJECTED';
               const isPhotoApproved = status === 'PHOTO_APPROVED';
               const isRejected = isInviteRejected || isPhotoRejected;
               const isApprovedOrCompleted = isPhotoApproved || isInviteAccepted;

               let formattedDate = '';
               if (notif.tipo === 'social_invite' && notif.event_date) {
                  const d = new Date(notif.event_date);
                  formattedDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')} às ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
               }
               
               const amigoNome = notif.amigo_nome || 'Usuário';
               const amigoUsername = notif.amigo_username || amigoNome.split(' ')[0].toLowerCase();
               
               let actionText = '';
               if (notif.tipo === 'treino_dupla') {
                  actionText = 'te marcou em um:';
               } else {
                  if (isInvitePending || isInviteAccepted || isInviteRejected) {
                      actionText = notif.is_sender === 1 ? 'foi convidado(a) por você para:' : 'te convidou para:';
                  } else {
                      actionText = notif.is_photo_uploader === 1 ? 'foi marcado(a) por você na foto do rolê:' : 'publicou a foto do rolê:';
                  }
               }

               return (
                 <div 
                   key={`${notif.tipo}-${notif.post_id}`} 
                   ref={isLast ? lastNotificationElementRef : null}
                   className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all duration-500 ${
                     isApprovedOrCompleted && !isRejected ? 'bg-emerald-500/10 border-emerald-500/30' : 
                     isRejected ? 'bg-red-500/10 border-red-500/30 opacity-60' : 
                     'bg-white/5 border-white/10'
                   }`}
                 >
                   <div className="flex items-center justify-between gap-3">
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-full bg-black border border-white/20 overflow-hidden shrink-0">
                         {notif.amigo_foto ? (
                           <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${notif.amigo_foto}`} alt={amigoNome} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                             {amigoNome.charAt(0).toUpperCase()}
                           </div>
                         )}
                       </div>
                       <div>
                         <p className="text-xs text-white/80 leading-tight">
                           <span className="font-bold text-white">@{amigoUsername}</span> {actionText}
                         </p>
                         <p className="text-xs font-black text-yellow-500 uppercase tracking-wide mt-0.5">
                           {notif.tipo === 'treino_dupla' ? 'Treino em Dupla' : (INVITE_DICTIONARY[notif.invite_type] || 'Evento')}
                         </p>
                         {notif.tipo === 'social_invite' && (
                           <p className="text-[10px] text-white/50 mt-0.5 flex items-center gap-1">
                             <Clock size={10} /> {formattedDate}
                           </p>
                         )}
                       </div>
                     </div>
                     {isInvitePending && notif.is_sender === 0 && (
                       <div className="flex items-center gap-2">
                          {processingId === `${notif.tipo}-${notif.post_id}` ? (
                              <div className="p-2"><Loader2 size={20} className="text-white/50 animate-spin" /></div>
                          ) : (
                              <>
                                <button onClick={() => handleReject(notif)} className="p-2.5 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30"><X size={18} /></button>
                                <button onClick={() => handleApprove(notif)} className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"><CheckCircle2 size={18} /></button>
                              </>
                          )}
                       </div>
                     )}
                     {isInvitePending && notif.is_sender === 1 && (
                        <span className="text-[10px] font-bold text-yellow-500/50 pr-2 uppercase tracking-widest text-right w-20 leading-tight">Aguardando<br/>Resposta</span>
                     )}
                     {isPhotoPending && notif.is_photo_uploader === 0 && (
                       <div className="flex items-center gap-2">
                          {processingId === `${notif.tipo}-${notif.post_id}` ? (
                              <div className="p-2"><Loader2 size={20} className="text-white/50 animate-spin" /></div>
                          ) : (
                              <>
                                <button onClick={() => handleReject(notif)} className="p-2.5 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30"><X size={18} /></button>
                                <button onClick={() => handleApprove(notif)} className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"><CheckCircle2 size={18} /></button>
                              </>
                          )}
                       </div>
                     )}
                     {isPhotoPending && notif.is_photo_uploader === 1 && (
                        <span className="text-[10px] font-bold text-yellow-500/50 pr-2 uppercase tracking-widest text-right w-20 leading-tight">Aguardando<br/>Aprovação</span>
                     )}
                     {isRejected && <span className="text-xs font-black text-red-400 pr-2">RECUSADO</span>}
                     {isPhotoApproved && <span className="text-xs font-black text-emerald-400 pr-2">APROVADO</span>}
                   </div>
                   {!isRejected && isInviteAccepted && (
                     <div className="pt-2 border-t border-emerald-500/20 mt-2">
                       <button 
                         onClick={() => triggerNativeFilePicker(notif)}
                         className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 text-black rounded-xl font-black text-xs hover:bg-emerald-400 transition-colors active:scale-95"
                       >
                         <Camera size={14} />
                         POSTAR FOTO DO ROLÊ
                       </button>
                     </div>
                   )}
                   {!isRejected && isPhotoApproved && (notif.linked_post_slug || notif.linked_checkin_id) && (
                     <div className="pt-2 border-t border-emerald-500/20 mt-2">
                       <button 
                         onClick={() => {
                           const slugOrId = notif.linked_post_slug || notif.linked_checkin_id;
                           const username = notif.linked_post_username || notif.amigo_username;
                           navigate(`/${username}/post/${slugOrId}`);
                         }}
                         className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl font-black text-xs hover:bg-emerald-500/20 transition-colors active:scale-95"
                       >
                         <ImageIcon size={14} />
                         VER FOTO PUBLICADA
                       </button>
                     </div>
                   )}
                 </div>
               );
             })}
             {loadingMore && (
               <div className="py-4 flex justify-center w-full">
                 <Loader2 size={24} className="animate-spin text-yellow-500" />
               </div>
             )}
             {!hasMore && notifications.length > 0 && (
               <div className="py-4 text-center text-white/30 text-[10px] font-bold uppercase tracking-widest">
                 Fim das mensagens
               </div>
             )}
           </div>
        ) : (
           <div className="flex flex-col items-center justify-center py-10 opacity-30">
             <MessageCircle size={40} className="mb-2" />
             <p className="text-xs">Sua caixa de entrada está limpa.</p>
           </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="image/png, image/jpeg, image/webp" 
        className="hidden" 
      />
    </div>
  );
}