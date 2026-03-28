import React, { useState } from 'react';
import { PlusSquare, Bell } from 'lucide-react';
import CreatePostMenu from './CreatePostMenu';

export default function TopBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 rounded-b-3xl shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button 
            className="text-white/80 hover:text-yellow-400 active:scale-90 transition-all p-1.5 bg-white/5 rounded-xl border border-white/10"
            onClick={() => setIsMenuOpen(true)}
            title="Novo Check-in"
          >
            <PlusSquare size={24} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xl drop-shadow-md">🍌</span>
            <h1 className="text-xl font-black tracking-tight text-white drop-shadow-md">
              Banana's Gym
            </h1>
          </div>

          <button className="relative text-white/80 hover:text-yellow-400 active:scale-90 transition-all p-1.5 bg-white/5 rounded-xl border border-white/10">
            <Bell size={24} />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 border-2 border-[#050505] rounded-full animate-pulse"></span>
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