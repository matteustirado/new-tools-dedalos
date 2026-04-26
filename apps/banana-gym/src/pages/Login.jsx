import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { User, Lock, Eye, EyeOff, LogIn, X, KeyRound, Check, CheckCircle2, ShieldCheck } from 'lucide-react';

import BananasIcon from '../components/BananasIcon';
import TermsModal from '../components/TermsModal'; 
import RegisterModal from '../components/RegisterModal';
import { validateCPF } from '../utils/validators';
import { LOADING_PHRASES } from '../constants/phrases';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [termosAceitos, setTermosAceitos] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState('cpf'); 
  const [resetCpf, setResetCpf] = useState('');
  const [reset2FACode, setReset2FACode] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  const [welcomeName, setWelcomeName] = useState('');
  const [showPhrases, setShowPhrases] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [shuffledPhrases, setShuffledPhrases] = useState([]);

  useEffect(() => {
    document.documentElement.classList.add('dark');

    const storedUser = localStorage.getItem('gym_user');
    const storedToken = localStorage.getItem('gym_token');
    
    if (storedUser && storedToken) {
      navigate('/feed');
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
    
    if (!validateCPF(cpf)) return toast.error('Digite um CPF válido.');
    if (!senha) return toast.error('A senha é obrigatória.');
    if (!termosAceitos) return toast.warning('Você precisa aceitar os Termos de Uso para entrar.');

    setLoading(true);
    
    try {
      const res = await api.post('/api/gym/login', { cpf, senha });
      
      if (res.data.user.termos_aceitos === 0 && !termosAceitos) {
        setLoading(false);
        return toast.warning('Você precisa ler e aceitar os Termos de Uso para entrar no aplicativo.');
      }

      localStorage.setItem('gym_token', res.data.token);
      localStorage.setItem('gym_user', JSON.stringify(res.data.user));

      if (termosAceitos && res.data.user.termos_aceitos === 0) {
         try {
            await api.post('/api/gym/accept-terms', {});
         } catch (err) {
            console.warn(err);
         }
      }

      if (res.data.user.must_change_password) {
        navigate('/change-password');
      } else {
        setWelcomeName(res.data.user.nome.split(' ')[0]);
        
        const shuffled = [...LOADING_PHRASES].sort(() => 0.5 - Math.random()).slice(0, 4);
        setShuffledPhrases(shuffled);

        setTimeout(() => {
          setShowPhrases(true);
          let currentIdx = 0;
          
          const interval = setInterval(() => {
            currentIdx++;
            if (currentIdx >= 4) {
              clearInterval(interval);
              navigate('/feed');
            } else {
              setPhraseIndex(currentIdx);
            }
          }, 1500); 

        }, 1500); 
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Erro ao efetuar login.');
      setLoading(false);
    }
  };

  const handleResetCpfSubmit = async (e) => {
    e.preventDefault();
    if (!validateCPF(resetCpf)) return toast.warning('Digite um CPF válido.');
    
    setModalLoading(true);
    try {
      const cleanCpf = resetCpf.replace(/\D/g, '');
      const res = await api.post('/api/gym/check-2fa', { cpf: cleanCpf });
      
      if (res.data.has2FA) {
        setResetStep('2fa');
      } else {
        await api.post('/api/gym/request-reset', { cpf: cleanCpf });
        setResetStep('success_rh');
        setTimeout(() => {
          setShowResetModal(false);
          setResetCpf('');
          setResetStep('cpf');
        }, 4000);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Erro ao processar solicitação.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifyReset2FA = async (code) => {
    if (code.length !== 6) return;
    setModalLoading(true);
    try {
      const cleanCpf = resetCpf.replace(/\D/g, '');
      const res = await api.post('/api/gym/verify-2fa-reset', { cpf: cleanCpf, token: code });
      
      localStorage.setItem('gym_token', res.data.token);
      localStorage.setItem('gym_user', JSON.stringify(res.data.user));
      
      setShowResetModal(false);
      navigate('/change-password');
    } catch (err) {
      console.error(err);
      toast.error('Código inválido ou expirado.');
      setReset2FACode('');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pt-12 pb-4 px-6 relative overflow-hidden bg-[#050505] text-white">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-yellow-500/[0.03] dark:bg-yellow-500/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-yellow-600/[0.02] dark:bg-yellow-600/[0.03] rounded-full blur-[100px] pointer-events-none" />

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

          <div className="flex flex-col gap-3 mt-4 px-1">
            <div className="flex items-start gap-2">
              <div 
                className="cursor-pointer shrink-0 mt-0.5"
                onClick={() => setTermosAceitos(!termosAceitos)}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                  termosAceitos ? 'bg-emerald-500 border-emerald-500' : 'bg-black/50 border border-white/20'
                }`}>
                  {termosAceitos && <Check size={14} className="text-black stroke-[3px]" />}
                </div>
              </div>
              <p className="text-[11px] text-white/60 leading-tight">
                Li e concordo com os{' '}
                <button 
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-yellow-500 hover:text-yellow-400 font-bold underline decoration-yellow-500/30 underline-offset-2 transition-colors"
                >
                  Termos de Uso e Privacidade
                </button>
              </p>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !termosAceitos}
            className={`w-full font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 active:scale-95 disabled:active:scale-100 ${
              termosAceitos 
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_10px_20px_rgba(234,179,8,0.2)]' 
                : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
            }`}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                {termosAceitos ? 'ENTRAR' : 'ACEITE OS TERMOS'}
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-3 mt-8 text-xs font-bold text-white/50">
          <button onClick={() => setShowResetModal(true)} className="hover:text-yellow-400 transition-colors">
            Esqueci minha senha
          </button>
          <span>|</span>
          <button onClick={() => setShowRegisterModal(true)} className="hover:text-yellow-400 transition-colors">
            Cadastre-se
          </button>
        </div>
      </div>

      <footer className="relative z-10 w-full max-w-md mx-auto text-center text-[10px] text-white/40 pb-1 pt-3 mt-6 shrink-0">
          <p>
            © Developed by:{' '}
            <span className="text-yellow-500 font-semibold">Matteus Tirado</span>
          </p>
      </footer>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden">
            <button onClick={() => { setShowResetModal(false); setResetStep('cpf'); setResetCpf(''); }} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={24} /></button>
            
            {resetStep === 'cpf' && (
              <div className="animate-fade-in">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mb-4 border border-yellow-500/20">
                  <KeyRound size={24} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Redefinir Senha</h2>
                <p className="text-sm text-white/50 mb-6">Digite seu CPF. O sistema verificará suas configurações de segurança.</p>
                
                <form onSubmit={handleResetCpfSubmit} className="space-y-4">
                  <input 
                    type="tel" 
                    value={resetCpf}
                    onChange={(e) => handleCpfChange(e, setResetCpf)}
                    placeholder="000.000.000-00"
                    className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white focus:border-yellow-500 outline-none transition-colors"
                    required
                  />
                  <button type="submit" disabled={modalLoading} className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors flex justify-center">
                    {modalLoading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Avançar'}
                  </button>
                </form>
              </div>
            )}

            {resetStep === '2fa' && (
              <div className="animate-fade-in text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 mx-auto border border-emerald-500/20">
                  <ShieldCheck size={24} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Autenticação 2FA</h2>
                <p className="text-sm text-white/50 mb-6">Digite o código de 6 dígitos gerado pelo seu app autenticador.</p>
                
                <input 
                  type="text" 
                  maxLength={6}
                  value={reset2FACode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setReset2FACode(val);
                    if (val.length === 6) {
                      handleVerifyReset2FA(val);
                    }
                  }}
                  placeholder="000000"
                  className="w-full bg-black border border-white/10 rounded-xl py-4 px-4 text-white text-center text-2xl tracking-[0.5em] focus:border-yellow-500 outline-none transition-colors mb-4 font-mono"
                />
                
                {modalLoading && (
                  <div className="flex justify-center mt-2">
                    <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}

            {resetStep === 'success_rh' && (
              <div className="flex flex-col items-center justify-center py-6 animate-fade-in text-center">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/50 mb-4">
                  <CheckCircle2 size={40} className="text-blue-500" />
                </div>
                <h4 className="text-xl font-black text-white mb-2">Solicitação Enviada</h4>
                <p className="text-sm text-white/60">Como você não ativou a Segurança em 2 Fatores, uma solicitação de redefinição foi enviada ao RH. Aguarde o contato.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <RegisterModal 
        isOpen={showRegisterModal} 
        onClose={() => setShowRegisterModal(false)} 
      />

      <TermsModal 
        isOpen={showTermsModal} 
        onClose={() => setShowTermsModal(false)} 
        onAgree={() => setTermosAceitos(true)} 
      />

      {welcomeName && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.4)]">
              <BananasIcon type="filled" size={50} className="text-black" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2 animate-fade-in-up">
                Bem-vindo, {welcomeName}!
              </h2>
              
              {!showPhrases ? (
                <p className="text-sm font-bold text-yellow-500 uppercase tracking-widest animate-pulse">
                  Iniciando...
                </p>
              ) : (
                <div className="h-6 overflow-hidden relative w-64 mx-auto mt-2">
                  <p 
                    key={phraseIndex} 
                    className="text-sm font-bold text-yellow-500 uppercase tracking-widest animate-slide-right absolute inset-0"
                  >
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