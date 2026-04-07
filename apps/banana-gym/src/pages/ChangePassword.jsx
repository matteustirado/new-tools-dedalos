import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ShieldAlert, Lock, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ChangePassword() {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    const storedUser = localStorage.getItem('gym_user');
    
    if (!storedUser) {
      toast.error('Sessão expirada. Faça login novamente.');
      navigate('/login');
      return;
    }
    
    setUser(JSON.parse(storedUser));
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      return toast.warning('Preencha todos os campos.');
    }
    
    if (novaSenha.length < 6) {
      return toast.warning('A nova senha deve ter pelo menos 6 caracteres.');
    }
    
    if (novaSenha !== confirmarSenha) {
      return toast.error('A nova senha e a confirmação não coincidem.');
    }

    setLoading(true);
    
    try {
      await axios.put(`${API_URL}/api/gym/change-password`, {
        cpf: user.cpf,
        senha_atual: senhaAtual,
        nova_senha: novaSenha
      });

      const updatedUser = { ...user, must_change_password: 0 };
      localStorage.setItem('gym_user', JSON.stringify(updatedUser));

      toast.success('Senha atualizada! Redirecionando para o Feed...');
      navigate('/feed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between pt-12 pb-4 px-6 relative overflow-hidden bg-[#050505] text-white">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-yellow-500/[0.03] rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-orange-600/[0.02] rounded-full blur-[100px] pointer-events-none"></div>

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
            <label className="text-xs font-bold text-white/70 ml-1 uppercase tracking-wider">Senha Atual</label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><KeyRound size={18} /></div>
              <input 
                type={showPasswords ? "text" : "password"} 
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="Digite a sua senha atual"
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all text-base"
              />
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-4 text-white/40 hover:text-white transition-opacity">
                {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10"></div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-yellow-500 ml-1 uppercase tracking-wider">Nova Senha Pessoal</label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><Lock size={18} /></div>
              <input 
                type={showPasswords ? "text" : "password"} 
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="w-full bg-black/50 border border-yellow-500/30 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all text-base"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/70 ml-1 uppercase tracking-wider">Confirmar Nova Senha</label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><CheckCircle2 size={18} /></div>
              <input 
                type={showPasswords ? "text" : "password"} 
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all text-base"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl shadow-[0_10px_20px_rgba(234,179,8,0.2)] transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
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
    </div>
  );
}