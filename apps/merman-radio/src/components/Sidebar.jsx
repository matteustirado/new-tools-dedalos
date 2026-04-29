import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Music, ListMusic, CalendarClock, SlidersHorizontal, Radio, Disc3, LogOut, Bell, Home } from 'lucide-react';
import mermanIcon from '../assets/MermanIcon.webp';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const userStr = localStorage.getItem('merman_user');
  const role = userStr ? JSON.parse(userStr).role : '';

  let navItems = [];

  if (role === 'admin') {
    navItems = [
      { name: 'Músicas', path: '/library', icon: Music, isReady: true },
      { name: 'Playlists', path: '/playlists', icon: ListMusic, isReady: true },
      { name: 'Agendamentos', path: '/schedule', icon: CalendarClock, isReady: true },
      { name: 'Mixer', path: '/mixer', icon: SlidersHorizontal, isReady: true },
    ];
  } else if (role.startsWith('dj')) {
    navItems = [
      { name: 'Mixer', path: '/mixer', icon: SlidersHorizontal, isReady: true },
    ];
  } else if (role.startsWith('user')) {
    navItems = [
      { name: 'Jukebox', path: '/jukebox', icon: Disc3, isReady: false },
    ];
  }

  const handleLogout = () => {
    localStorage.removeItem('merman_token');
    localStorage.removeItem('merman_user');
    navigate('/login');
  };

  const handleNavClick = (path, isReady, name) => {
    if (!isReady) {
      toast.info(`${name} em breve nas próximas atualizações! 🚧`);
      return;
    }
    navigate(path);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-[#061224]/80 backdrop-blur-xl border-r border-white/10 sticky top-0 overflow-hidden shadow-2xl">
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
          <img src={mermanIcon} alt="Logo" className="w-full h-full object-cover -rotate-6" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-white text-lg font-bold leading-tight">Merman Music</h1>
          <p className="text-cyan-500/70 text-[10px] uppercase tracking-widest font-black">Rádio Dedalos</p>
        </div>
      </div>

      <div className="p-4 flex gap-2 border-b border-white/5">
        {role === 'admin' ? (
          <button 
            onClick={() => handleNavClick('/dashboard', false, 'Início')}
            className={`flex-1 flex items-center justify-center h-11 rounded-xl transition-all border ${
              location.pathname === '/dashboard' 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]' 
                : 'text-white/40 border-transparent hover:bg-white/5 hover:text-cyan-300'
            }`}
            title="Início"
          >
            <Home size={20} />
          </button>
        ) : (
          <button 
            onClick={() => toast.info('Notificações em breve nas próximas atualizações! 🚧')}
            className="flex-1 flex items-center justify-center h-11 rounded-xl transition-all border border-transparent text-white/40 hover:bg-white/5 hover:text-cyan-300"
            title="Notificações"
          >
            <Bell size={20} />
          </button>
        )}
        
        <button 
          onClick={handleLogout}
          className="flex-1 flex items-center justify-center h-11 rounded-xl transition-all border border-transparent text-white/40 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
          title="Sair do Sistema"
        >
          <LogOut size={20} />
        </button>
      </div>

      <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path, item.isReady, item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border group ${
                isActive 
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-md' 
                  : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} className={`transition-transform group-hover:scale-110 ${isActive ? 'drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'opacity-50'}`} />
              <p className={`text-sm tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>{item.name}</p>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 p-4 bg-black/20">
        {(role === 'admin' || role.startsWith('dj')) && (
          <button
            onClick={() => navigate('/live')}
            className="flex w-full items-center justify-center gap-2 rounded-xl h-12 px-4 text-white text-sm font-black bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all shadow-lg hover:shadow-red-900/40 transform hover:-translate-y-0.5 active:scale-95"
          >
            <Radio size={18} className="animate-pulse" />
            <span className="truncate uppercase tracking-widest">Ao Vivo</span>
          </button>
        )}

        <div className="text-center text-[10px] text-white/30 pt-2 border-t border-white/5">
          <p>© Developed by: <span className="text-cyan-500/60 font-bold">Matteus Tirado</span></p>
        </div>
      </div>
    </aside>
  );
}