import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Inbox, Trophy, Search, User } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { id: 'feed', path: '/feed', icon: Home, label: 'Feed' },
    { id: 'inbox', path: '/inbox', icon: Inbox, label: 'Inbox' },
    { id: 'ranking', path: '/ranking', icon: Trophy, label: 'Ranking' },
    { id: 'search', path: '/search', icon: Search, label: 'Buscar' },
    { id: 'profile', path: '/profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#050505]/80 backdrop-blur-xl border-t border-white/10 px-6 pt-3 pb-6 md:pb-4 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <ul className="flex justify-between items-center max-w-md mx-auto relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath.startsWith(item.path);

          return (
            <li key={item.id} className="relative flex flex-col items-center">
              <Link 
                to={item.path} 
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'text-yellow-400 scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' 
                    : 'text-white/40 hover:text-white/70 hover:scale-105'
                }`}
                aria-label={item.label}
              >
                <Icon size={isActive ? 26 : 24} strokeWidth={isActive ? 2.5 : 2} />
                
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,1)] animate-fade-in"></span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}