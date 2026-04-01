import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusSquare, Bell } from 'lucide-react';
import CreatePostMenu from './CreatePostMenu';
import BananasIcon from './BananasIcon'; 

export default function TopBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/10 px-6 py-4 rounded-b-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between max-w-md mx-auto">
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
            onClick={() => navigate('/notifications')}
            title="Notificações"
          >
            <Bell size={26} strokeWidth={2} />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 border-2 border-[#050505] rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
          </button>
        </div>
      </header>

      <CreatePostMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
      />
    </>
  );
}