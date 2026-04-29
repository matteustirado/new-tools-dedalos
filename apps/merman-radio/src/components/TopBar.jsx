import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Home } from 'lucide-react';
import mermanIcon from '../assets/MermanIcon.webp';

export default function TopBar() {
  const navigate = useNavigate();
  const unreadCount = 0;
  
  const userStr = localStorage.getItem('merman_user');
  const role = userStr ? JSON.parse(userStr).role : '';

  const handleLogout = () => {
    localStorage.removeItem('merman_token');
    localStorage.removeItem('merman_user');
    navigate('/login');
  };

  return (
    <header className="md:hidden fixed top-0 left-0 w-full z-50 bg-[#061224]/80 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-b-3xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
      {role === 'admin' ? (
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-white/40 hover:text-cyan-400 active:scale-90 transition-all duration-300 p-2 -ml-2"
        >
          <Home size={26} strokeWidth={2} />
        </button>
      ) : (
        <button 
          onClick={() => navigate('/notifications')}
          className="relative text-white/40 hover:text-cyan-400 active:scale-90 transition-all duration-300 p-2 -ml-2"
        >
          <Bell size={26} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-[#061224] rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          )}
        </button>
      )}
      
      <div className="flex items-center gap-2 transform translate-y-0.5">
        <img src={mermanIcon} alt="Merman" className="w-6 h-6 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
        <h1 className="text-xl font-black tracking-tight text-white drop-shadow-md">
          Merman Music
        </h1>
      </div>
      
      <button 
        onClick={handleLogout}
        className="text-white/40 hover:text-red-500 active:scale-90 transition-all duration-300 p-2 -mr-2"
      >
        <LogOut size={26} strokeWidth={2} />
      </button>
    </header>
  );
}