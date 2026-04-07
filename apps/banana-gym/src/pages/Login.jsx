import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { User, Lock, Eye, EyeOff, LogIn, X, Send, KeyRound, Check } from 'lucide-react';

// Importando o nosso novo ícone de Banana
import BananasIcon from '../components/BananasIcon';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Login() {
  const navigate = useNavigate();
  
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberData, setRememberData] = useState(false); // Novo estado do Checkbox
  const [loading, setLoading] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [resetCpf, setResetCpf] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');

    // 1. REDIRECIONAMENTO AUTOMÁTICO (Resolve o problema de "esquecer" o login)
    const storedUser = localStorage.getItem('gym_user');
    if (storedUser) {
      navigate('/feed');
      return; // Para a execução da tela de login aqui
    }

    // 2. BUSCA O CPF SALVO (Caso o usuário tenha deslogado mas marcado "Lembrar CPF")
    const savedCpf = localStorage.getItem('gym_saved_cpf');
    if (savedCpf) {
      setCpf(savedCpf);
      setRememberData(true);
    }
  }, [navigate]);

  const handleCpfChange = (e, setter) => {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 11) {
      value = value.slice(0, 11);
    }
    
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    setter(value);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (cpf.length < 14) return toast.error('Digite um CPF válido.');
    if (!senha) return toast.error('A senha é obrigatória.');

    setLoading(true);
    
    try {
      const res = await axios.post(`${API_URL}/api/gym/login`, { cpf, senha });
      
      // Salva o usuário no localStorage para mantê-lo conectado
      localStorage.setItem('gym_user', JSON.stringify(res.data.user));

      // Lógica do Checkbox: Salva ou remove apenas o CPF da memória
      if (rememberData) {
        localStorage.setItem('gym_saved_cpf', cpf);
      } else {
        localStorage.removeItem('gym_saved_cpf');
      }

      toast.success(`Bem-vindo, ${res.data.user.nome.split(' ')[0]}!`);
      
      if (res.data.user.must_change_password) {
        navigate('/change-password');
      } else {
        // Gatilho para a Splash Screen rodar lá no Feed!
        sessionStorage.setItem('just_logged_in', 'true');
        navigate('/feed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao efetuar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (resetCpf.length < 14) return toast.error('Digite um CPF válido.');
    
    setModalLoading(true);
    
    try {
      const cleanCpf = resetCpf.replace(/\D/g, '');
      await axios.put(`${API_URL}/api/gym/users/${cleanCpf}/reset-password`);
      
      toast.success('Senha redefinida com sucesso! Utilize a senha padrão da empresa.', { autoClose: 5000 });
      setShowResetModal(false);
      setResetCpf('');
    } catch (err) {
      toast.error('Erro ao redefinir a senha. Verifique o CPF.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSupportSubmit = (e) => {
    e.preventDefault();
    
    if (!supportMessage.trim()) return toast.warning('Escreva uma mensagem.');
    
    setModalLoading(true);
    
    setTimeout(() => {
      toast.success('Mensagem enviada ao RH com sucesso!');
      setShowSupportModal(false);
      setSupportMessage('');
      setModalLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pt-12 pb-4 px-6 relative overflow-hidden bg-[#050505] text-white">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-yellow-500/[0.03] dark:bg-yellow-500/[0.05] rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-yellow-600/[0.02] dark:bg-yellow-600/[0.03] rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md mx-auto animate-fade-in-up flex-1 flex flex-col justify-center">
        <div className="flex flex-col items-center mb-10">
          
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)] mb-6 transform rotate-6 animate-float border-2 border-yellow-300/50">
            <BananasIcon type="filled" size={75} className="drop-shadow-md -rotate-6" />
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-md">Banana's Gym</h1>
          <p className="text-white/60 text-sm mt-2 font-medium">O seu app de treinos do ecossistema Dédalos.</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-3xl space-y-5 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/70 ml-1 uppercase tracking-wider">CPF</label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-white/40"><User size={18} /></div>
              <input 
                type="tel" 
                value={cpf}
                onChange={(e) => handleCpfChange(e, setCpf)}
                placeholder="000.000.000-00"
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all text-lg font-medium"
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
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-11 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all text-lg font-bold tracking-widest"
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

          {/* CHECKBOX CUSTOMIZADO: LEMBRAR MEUS DADOS */}
          <div 
            className="flex items-center gap-2 mt-2 px-1 cursor-pointer w-max"
            onClick={() => setRememberData(!rememberData)}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
              rememberData ? 'bg-yellow-500 border-yellow-500' : 'bg-black/50 border border-white/20'
            }`}>
              {rememberData && <Check size={14} className="text-black stroke-[3px]" />}
            </div>
            <span className="text-xs font-bold text-white/70 select-none hover:text-white transition-colors">
              Lembrar meu CPF
            </span>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl shadow-[0_10px_20px_rgba(234,179,8,0.2)] transition-all flex items-center justify-center gap-2 mt-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={20} />
                ENTRAR
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-3 mt-8 text-xs font-bold text-white/50">
          <button onClick={() => setShowResetModal(true)} className="hover:text-yellow-400 transition-colors">
            Esqueci minha senha
          </button>
          <span>|</span>
          <button onClick={() => setShowSupportModal(true)} className="hover:text-yellow-400 transition-colors">
            Contate o RH
          </button>
        </div>
      </div>

      <footer className="relative z-10 w-full max-w-md mx-auto text-center text-[10px] text-white/40 pb-1 pt-3 border-t border-white/10 mt-10 shrink-0">
          <p>
            © Developed by:{' '}
            <span className="text-yellow-500 font-semibold">Matteus Tirado</span>
          </p>
      </footer>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={24} /></button>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mb-4 border border-yellow-500/20">
              <KeyRound size={24} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Redefinir Senha</h2>
            <p className="text-sm text-white/50 mb-6">Digite o seu CPF abaixo. A sua senha será redefinida para o padrão inicial do sistema.</p>
            
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input 
                type="tel" 
                value={resetCpf}
                onChange={(e) => handleCpfChange(e, setResetCpf)}
                placeholder="000.000.000-00"
                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white focus:border-yellow-500 transition-colors"
                required
              />
              <button type="submit" disabled={modalLoading} className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors flex justify-center">
                {modalLoading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div> : 'Redefinir Senha'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setShowSupportModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={24} /></button>
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 mb-4 border border-blue-500/20">
              <Send size={24} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Suporte ao Colaborador</h2>
            <p className="text-sm text-white/50 mb-6">Encontrou algum erro, tem uma sugestão ou precisa de ajuda com a sua conta?</p>
            
            <form onSubmit={handleSupportSubmit} className="space-y-4">
              <textarea 
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Escreva a sua mensagem aqui..."
                rows="4"
                className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 transition-colors resize-none"
                required
              ></textarea>
              <button type="submit" disabled={modalLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 transition-colors flex justify-center">
                {modalLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Enviar Mensagem'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}