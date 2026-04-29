import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { User, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

import mermanIcon from '../assets/MermanIcon.webp';
import { LOADING_PHRASES } from '../constants/phrases';

export default function Login() {
  const navigate = useNavigate();
  
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [welcomeName, setWelcomeName] = useState('');
  const [showPhrases, setShowPhrases] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [shuffledPhrases, setShuffledPhrases] = useState([]);

  const redirectByRole = useCallback((role) => {
    if (role === 'admin') navigate('/dashboard');
    else if (role === 'dj') navigate('/dj-panel');
    else navigate('/jukebox');
  }, [navigate]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    const storedUser = localStorage.getItem('merman_user');
    const storedToken = localStorage.getItem('merman_token');
    
    if (storedUser && storedToken) {
      redirectByRole(JSON.parse(storedUser).role);
    }
  }, [redirectByRole]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!usuario) return toast.error('Identificação obrigatória.');
    if (!senha) return toast.error('Senha obrigatória.');

    setLoading(true);
    
    try {
      setTimeout(() => {
        const mockUser = { nome: 'Gestor Dedalos', role: 'admin' };
        localStorage.setItem('merman_token', 'token_temporario_merman');
        localStorage.setItem('merman_user', JSON.stringify(mockUser));
        
        setWelcomeName(mockUser.nome.split(' ')[0]);
        const shuffled = [...LOADING_PHRASES].sort(() => 0.5 - Math.random()).slice(0, 4);
        setShuffledPhrases(shuffled);

        setTimeout(() => {
          setShowPhrases(true);
          let currentIdx = 0;
          
          const interval = setInterval(() => {
            currentIdx++;
            if (currentIdx >= 4) {
              clearInterval(interval);
              redirectByRole(mockUser.role);
            } else {
              setPhraseIndex(currentIdx);
            }
          }, 1500);
        }, 1500);

      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao efetuar login.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pt-12 pb-4 px-6 relative overflow-hidden bg-[#050505] text-white">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-cyan-500/[0.03] dark:bg-cyan-500/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-blue-600/[0.02] dark:bg-blue-600/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <style>{`
        @keyframes slideRight {
          0% { opacity: 0; transform: translateX(-20px); }
          20% { opacity: 1; transform: translateX(0); }
          80% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(20px); }
        }
        .animate-slide-right {
          animation: slideRight 1.5s ease-in-out forwards;
        }
      `}</style>

      <div className="relative z-10 w-full max-w-md mx-auto animate-fade-in-up flex-1 flex flex-col justify-center">
        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="w-24 h-24 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.2)] mb-6 transform rotate-6 animate-float border-2 border-cyan-400/30 overflow-hidden">
            <img src={mermanIcon} alt="Merman Icon" className="w-full h-full object-contain -rotate-6" />
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-md">
            Merman Music
          </h1>
          <p className="text-white/60 text-sm mt-2 font-medium text-center">
            O seu app de músicas do ecossistema Dédalos.
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-3xl space-y-5 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/70 ml-1 uppercase tracking-wider">Identificação</label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><User size={18} /></div>
              <input 
                type="text" 
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Usuário ou Função"
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all text-lg font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/70 ml-1 uppercase tracking-wider">Senha</label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><Lock size={18} /></div>
              <input 
                type={showPassword ? "text" : "password"} 
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="****"
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-11 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all text-lg font-bold tracking-widest"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-white/40 hover:text-white transition-opacity"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_10px_20px_rgba(8,145,178,0.2)] active:scale-95 disabled:active:scale-100"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                ENTRAR
              </>
            )}
          </button>
        </form>
      </div>

      <footer className="relative z-10 w-full max-w-md mx-auto text-center text-[10px] text-white/40 pb-1 pt-3 mt-6 shrink-0">
        <p>© Developed by: <span className="text-cyan-500 font-semibold">Matteus Tirado</span></p>
      </footer>

      {welcomeName && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#050505]/95 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-24 h-24 bg-cyan-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.4)] p-4">
              <img src={mermanIcon} alt="Merman Icon" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2 animate-fade-in-up">
                Bem-vindo, {welcomeName}!
              </h2>
              {!showPhrases ? (
                <p className="text-sm font-bold text-cyan-500 uppercase tracking-widest animate-pulse h-14 flex items-center justify-center">Iniciando...</p>
              ) : (
                <div className="h-14 overflow-hidden relative w-72 mx-auto mt-2">
                  <p key={phraseIndex} className="text-sm font-bold text-cyan-500 uppercase tracking-widest animate-slide-right absolute inset-0 flex items-center justify-center text-center leading-relaxed">
                    {shuffledPhrases[phraseIndex]}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}