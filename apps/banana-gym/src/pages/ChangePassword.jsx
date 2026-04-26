import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ShieldAlert, Lock, Eye, EyeOff, CheckCircle2, Check } from 'lucide-react';
import api from '../services/api';

export default function ChangePassword() {
  const navigate = useNavigate();
  
  const [user] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    if (!user) {
      toast.error('Sessão expirada. Faça login novamente.');
      navigate('/login');
    }
  }, [user, navigate]);

  const isPasswordValid = {
    length: novaSenha.length >= 8,
    uppercase: /[A-Z]/.test(novaSenha),
    number: /[0-9]/.test(novaSenha),
    special: /[^A-Za-z0-9]/.test(novaSenha)
  };

  const passwordsMatch = novaSenha === confirmarSenha || confirmarSenha === '';
  const isFormValid = isPasswordValid.length && isPasswordValid.uppercase && isPasswordValid.number && isPasswordValid.special && novaSenha === confirmarSenha && novaSenha !== '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isFormValid) return;

    setLoading(true);
    
    try {
      await api.put('/api/gym/change-password-force', {
        cpf: user.cpf,
        nova_senha: novaSenha
      });

      const updatedUser = { ...user, must_change_password: 0 };
      localStorage.setItem('gym_user', JSON.stringify(updatedUser));

      setShowSuccessScreen(true);
      
      setTimeout(() => {
        sessionStorage.setItem('just_logged_in', 'true'); 
        navigate('/feed');
      }, 1800);

    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Erro ao alterar a senha.');
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between pt-12 pb-4 px-6 relative overflow-hidden bg-[#050505] text-white">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-yellow-500/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-orange-600/[0.02] rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-auto animate-fade-in-up flex-1 flex flex-col justify-center">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-20 h-20 bg-yellow-500/10 rounded-3xl flex items-center justify-center border border-yellow-500/30 mb-6 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
            <ShieldAlert size={40} className="text-yellow-500" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">Ação Obrigatória</h1>
          <p className="text-white/60 text-sm font-medium px-4">
            Olá, <span className="text-yellow-400 font-bold">{user.nome.split(' ')[0]}</span>! Para a sua segurança, defina uma nova senha pessoal antes de acessar o app.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-3xl space-y-5 shadow-2xl">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-yellow-500 ml-1 uppercase tracking-wider flex justify-between">
              Nova Senha Pessoal
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><Lock size={18} /></div>
              <input 
                type={showNovaSenha ? "text" : "password"} 
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/50 border border-yellow-500/30 rounded-xl py-3 pl-11 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all text-base"
              />
              <button type="button" onClick={() => setShowNovaSenha(!showNovaSenha)} className="absolute right-4 text-white/40 hover:text-white transition-opacity">
                {showNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {novaSenha && (
              <div className="mt-3 space-y-1.5 px-1 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-2">Requisitos da senha:</p>
                
                <div className={`flex items-center gap-2 text-[10px] font-bold transition-colors duration-300 ${isPasswordValid.length ? 'text-emerald-500' : 'text-white/30'}`}>
                  <Check size={14} className={isPasswordValid.length ? 'opacity-100' : 'opacity-30'} />
                  <span>Mínimo de 8 caracteres</span>
                </div>
                
                <div className={`flex items-center gap-2 text-[10px] font-bold transition-colors duration-300 ${isPasswordValid.uppercase ? 'text-emerald-500' : 'text-white/30'}`}>
                  <Check size={14} className={isPasswordValid.uppercase ? 'opacity-100' : 'opacity-30'} />
                  <span>Pelo menos 1 letra maiúscula</span>
                </div>
                
                <div className={`flex items-center gap-2 text-[10px] font-bold transition-colors duration-300 ${isPasswordValid.number ? 'text-emerald-500' : 'text-white/30'}`}>
                  <Check size={14} className={isPasswordValid.number ? 'opacity-100' : 'opacity-30'} />
                  <span>Pelo menos 1 número (0-9)</span>
                </div>
                
                <div className={`flex items-center gap-2 text-[10px] font-bold transition-colors duration-300 ${isPasswordValid.special ? 'text-emerald-500' : 'text-white/30'}`}>
                  <Check size={14} className={isPasswordValid.special ? 'opacity-100' : 'opacity-30'} />
                  <span>Pelo menos 1 caractere especial (!@#$ etc)</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/70 ml-1 uppercase tracking-wider flex justify-between">
              Confirmar Nova Senha
              {!passwordsMatch && <span className="text-red-500 font-black animate-fade-in normal-case">Senhas não coincidem</span>}
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><CheckCircle2 size={18} /></div>
              <input 
                type={showConfirmarSenha ? "text" : "password"} 
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
                className={`w-full bg-black/50 border rounded-xl py-3 pl-11 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 transition-all text-base ${!passwordsMatch ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/50' : 'border-white/10 focus:border-yellow-500 focus:ring-yellow-500/50'}`}
              />
              <button type="button" onClick={() => setShowConfirmarSenha(!showConfirmarSenha)} className="absolute right-4 text-white/40 hover:text-white transition-opacity">
                {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !isFormValid}
            className={`w-full font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 ${isFormValid ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_10px_20px_rgba(234,179,8,0.2)]' : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'}`}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              'SALVAR E ACESSAR'
            )}
          </button>
        </form>
      </div>

      <footer className="relative z-10 w-full max-w-md mx-auto text-center text-[10px] text-white/40 pb-1 pt-3 border-t border-white/10 mt-10 shrink-0">
        <p>
          © Developed by:{' '}
          <span className="text-yellow-500 font-semibold">Matteus Tirado</span>
        </p>
      </footer>

      {showSuccessScreen && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center gap-6 animate-fade-in-up text-center">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={50} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Senha Atualizada!</h2>
              <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                Indo para o Feed...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}