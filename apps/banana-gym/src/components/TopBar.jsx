import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusSquare, Bell, UploadCloud } from 'lucide-react';
import CreatePostMenu from './CreatePostMenu';
import BananasIcon from './BananasIcon';
import { usePost } from '../contexts/PostContext';
import { getSocket } from '../socket';
import api from '../services/api';

export default function TopBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const { isUploading, uploadProgress } = usePost();
  
  const user = JSON.parse(localStorage.getItem('gym_user') || 'null');

  useEffect(() => {
    if (!user?.cpf) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await api.get(`/api/gym/notifications/${user.cpf}/unread-count`);
        setUnreadCount(res.data.count || 0);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUnreadCount();

    const socket = getSocket();
    if (socket) {
      const handleNewNotification = (data) => {
        if (data.receiverCpf === user.cpf) {
          setUnreadCount(prev => prev + 1);
          
          try {
            const notificationSound = new Audio('/sounds/notificacao.mp3');
            notificationSound.play().catch(playErr => {
              console.error("Navegador bloqueou o autoplay do som:", playErr);
            });
          } catch (error) {
            console.error("Erro ao instanciar o áudio:", error);
          }
        }
      };

      socket.on('gym:new_notification', handleNewNotification);
      socket.on('gym:new_like', handleNewNotification);
      socket.on('gym:new_comment', handleNewNotification);

      return () => {
        socket.off('gym:new_notification', handleNewNotification);
        socket.off('gym:new_like', handleNewNotification);
        socket.off('gym:new_comment', handleNewNotification);
      };
    }
  }, [user?.cpf]);

  const hasUnreadNotifications = unreadCount > 0;

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/10 px-6 py-4 rounded-b-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        {isUploading ? (
          <div className="flex flex-col items-center justify-center max-w-md mx-auto w-full h-[34px] animate-fade-in">
            <div className="flex items-center justify-between w-full mb-1">
              <div className="flex items-center gap-1.5 text-yellow-500">
                <UploadCloud size={14} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {uploadProgress === 100 ? 'Publicado!' : 'Enviando postagem...'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-white/50">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
              <div 
                className="bg-yellow-500 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                style={{ width: `${uploadProgress}%` }}
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1s_infinite]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between max-w-md mx-auto animate-fade-in">
            <button 
              className="text-white/40 hover:text-yellow-400 active:scale-90 transition-all duration-300 flex items-center justify-center p-2"
              onClick={() => setIsMenuOpen(true)}
              title="Novo Check-in"
            >
              <PlusSquare size={26} strokeWidth={2} />
            </button>

            <div className="flex items-center gap-2 transform translate-y-0.5">
              <BananasIcon type="filled" size={24} />
              <h1 className="text-xl font-black tracking-tight text-white drop-shadow-md">
                Banana's Gym
              </h1>
            </div>

            <button 
              className="relative text-white/40 hover:text-yellow-400 active:scale-90 transition-all duration-300 flex items-center justify-center p-2"
              onClick={() => {
                setUnreadCount(0); 
                navigate('/notifications');
              }}
              title="Notificações"
            >
              <Bell size={26} strokeWidth={2} />
              {hasUnreadNotifications && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 border-2 border-[#050505] rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
              )}
            </button>
          </div>
        )}
      </header>

      <CreatePostMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
      />
    </>
  );
}