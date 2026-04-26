import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Bell, Heart, MessageCircle, UserPlus, 
  ShieldAlert, Activity, Trophy
} from 'lucide-react';
import api from '../services/api';
import BananasIcon from '../components/BananasIcon';
import { getSocket } from '../socket';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [user] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    return stored ? JSON.parse(stored) : null;
  });

  const fetchNotifications = useCallback(async () => {
    if (!user?.cpf) return;
    try {
      const res = await api.get(`/api/gym/inbox-notifications/${user.cpf}`);
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.cpf) return;
    
    const markAllRead = async () => {
      try {
        await api.put('/api/gym/notifications/read-all');
      } catch (err) {
        console.error(err);
      }
    };
    
    markAllRead();
  }, [user]);

  useEffect(() => {
    if (!user?.cpf) return;
    
    const socket = getSocket();
    const handleNewNotification = (data) => {
      if (data.receiverCpf === user.cpf) {
        fetchNotifications();
        api.put('/api/gym/notifications/read-all').catch(console.error);
      }
    };

    socket.on('gym:new_notification', handleNewNotification);
    
    return () => {
      socket.off('gym:new_notification', handleNewNotification);
    };
  }, [user, fetchNotifications]);

  const handleNotificationClick = (notif) => {
    if (notif.post_slug) {
      navigate(`/post/${notif.post_slug}`);
    } else if (notif.type.startsWith('SOCIAL') || notif.type.includes('INVITE')) {
      navigate('/inbox');
    } else if (notif.type === 'RANKING') {
      navigate('/ranking');
    } else if (notif.type === 'SECURITY') {
      navigate('/edit-profile');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'LIKE': return <Heart size={16} className="text-red-500 fill-red-500" />;
      case 'BANANA': return <BananasIcon type="filled" size={16} />;
      case 'COMMENT': return <MessageCircle size={16} className="text-blue-500" />;
      case 'COMMENT_REPLY': return <MessageCircle size={16} className="text-blue-500" />;
      case 'INVITE': return <UserPlus size={16} className="text-yellow-500" />;
      case 'DUO': return <UserPlus size={16} className="text-emerald-500" />;
      case 'SECURITY': return <ShieldAlert size={16} className="text-orange-500" />;
      case 'STRAVA': return <Activity size={16} className="text-[#FC4C02]" />;
      case 'RANKING': return <Trophy size={16} className="text-yellow-400" />;
      default: return <Bell size={16} className="text-white/40" />;
    }
  };

  const formatTimestamp = (date) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const formatNotificationText = (notif) => {
    const hasGroup = notif.group_count > 1;
    const groupText = hasGroup ? ` e mais ${notif.group_count - 1} ${notif.group_count - 1 === 1 ? 'pessoa' : 'pessoas'}` : '';
    
    let actionText = notif.content;

    if (hasGroup) {
      if (notif.type === 'LIKE') actionText = 'curtiram sua publicação';
      if (notif.type === 'BANANA') actionText = 'deram uma banana 🍌 na sua publicação';
      if (notif.type === 'COMMENT') actionText = 'comentaram na sua publicação';
      if (notif.type === 'COMMENT_REPLY') actionText = 'responderam ao seu comentário';
    }

    return (
      <p className="text-sm leading-tight text-white/90">
        {notif.sender_username && (
          <span className="font-black text-white">@{notif.sender_username}{groupText} </span>
        )}
        {actionText}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black tracking-tight text-white">Notificações</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Carregando...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Bell size={32} className="text-white/20" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Tudo calmo por aqui</h3>
            <p className="text-sm text-white/40 max-w-[220px]">Você ainda não recebeu nenhuma notificação.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer border ${notif.is_read ? 'bg-transparent border-transparent opacity-60' : 'bg-white/[0.03] border-white/5 shadow-lg active:scale-[0.98]'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 border border-white/10">
                    {notif.sender_foto ? (
                      <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${notif.sender_foto}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        {getIcon(notif.type)}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black border-2 border-[#050505] flex items-center justify-center">
                    {getIcon(notif.type)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {formatNotificationText(notif)}
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider mt-1 block">
                    {formatTimestamp(notif.created_at)}
                  </span>
                </div>

                {notif.post_thumbnail && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${notif.post_thumbnail}`} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {!loading && notifications.length > 0 && (
        <div className="p-6 text-center">
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
            Fim das notificações
          </p>
        </div>
      )}
    </div>
  );
}