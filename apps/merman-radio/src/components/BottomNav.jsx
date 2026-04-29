import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Music, ListMusic, CalendarClock, SlidersHorizontal, Radio, Disc3 } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const userStr = localStorage.getItem('merman_user');
  const role = userStr ? JSON.parse(userStr).role : '';

  let navItems = [];

  if (role === 'admin') {
    navItems = [
      { name: 'Músicas', path: '/library', icon: Music, isReady: true },
      { name: 'Playlists', path: '/playlists', icon: ListMusic, isReady: true },
      { name: 'Agendas', path: '/schedule', icon: CalendarClock, isReady: true },
      { name: 'Mixer', path: '/mixer', icon: SlidersHorizontal, isReady: true },
      { name: 'Ao Vivo', path: '/live', icon: Radio, isReady: true },
    ];
  } else if (role.startsWith('dj')) {
    navItems = [
      { name: 'Mixer', path: '/mixer', icon: SlidersHorizontal, isReady: true },
      { name: 'Ao Vivo', path: '/live', icon: Radio, isReady: true },
    ];
  } else if (role.startsWith('user')) {
    navItems = [
      { name: 'Jukebox', path: '/jukebox', icon: Disc3, isReady: false },
    ];
  }

  if (navItems.length === 0) return null;

  const handleNavClick = (e, isReady, name, isActive) => {
    if (!isReady) {
      e.preventDefault();
      toast.info(`${name} em breve nas próximas atualizações! 🚧`);
      return;
    }
    if (isActive) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-[#061224]/80 backdrop-blur-xl border-t border-white/10 px-6 pt-3 pb-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
      <ul className="flex justify-around items-center max-w-md mx-auto relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
          const isLive = item.path === '/live';

          return (
            <li key={item.path} className="relative flex flex-col items-center">
              <Link 
                to={item.path} 
                onClick={(e) => handleNavClick(e, item.isReady, item.name, isActive)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? `scale-110 ${isLive ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]'}` 
                    : `hover:scale-105 ${isLive ? 'text-red-500/70 hover:text-red-500' : 'text-white/40 hover:text-white/70'}`
                }`}
                aria-label={item.name}
              >
                <Icon 
                  size={isActive ? 26 : 24} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={isLive && !isActive ? 'animate-pulse' : ''}
                />
                {isActive && (
                  <span className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full animate-fade-in ${
                    isLive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]'
                  }`} />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}