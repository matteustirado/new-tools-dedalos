import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { X, UserPlus, Eye, EyeOff, Check, CheckCircle2 } from 'lucide-react';
import PhoneInputModule from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { validateCPF, validateEmail } from '../utils/validators';
import api from '../services/api';

const PhoneInput = PhoneInputModule.default || PhoneInputModule;

export default function RegisterModal({ isOpen, onClose }) {
  const [registerStep, setRegisterStep] = useState('form');
  const [modalLoading, setModalLoading] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  const [cpfStatus, setCpfStatus] = useState({ state: 'idle', message: '' });
  const [usernameStatus, setUsernameStatus] = useState({ state: 'idle', message: '' });

  const [registerData, setRegisterData] = useState({
    cpf: '',
    nome: '',
    username: '',
    email: '',
    telefone: '',
    senha: '',
    confirmar_senha: ''
  });

  useEffect(() => {
    if (!registerData.cpf) {
      setCpfStatus({ state: 'idle', message: '' });
      return;
    }
    
    if (registerData.cpf.length === 14) {
      const cleanCpf = registerData.cpf.replace(/\D/g, '');
      
      if (!validateCPF(cleanCpf)) {
        setCpfStatus({ state: 'invalid', message: 'CPF inválido.' });
        return;
      }

      setCpfStatus({ state: 'validating', message: 'Verificando...' });
      
      const timer = setTimeout(async () => {
        try {
          const res = await api.get(`/api/gym/check-user?cpf=${cleanCpf}`);
          if (res.data.exists) {
            setCpfStatus({ state: 'exists', message: 'CPF já cadastrado.' });
          } else {
            setCpfStatus({ state: 'available', message: 'CPF liberado!' });
          }
        } catch (error) {
          console.error("[RegisterModal] Erro ao checar CPF:", error);
          setCpfStatus({ state: 'error', message: 'Erro ao verificar.' });
        }
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setCpfStatus({ state: 'idle', message: '' });
    }
  }, [registerData.cpf]);

  useEffect(() => {
    if (!registerData.username || registerData.username.length < 3) {
      setUsernameStatus({ state: 'idle', message: '' });
      return;
    }

    setUsernameStatus({ state: 'validating', message: 'Verificando...' });
    
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/gym/check-user?username=${registerData.username}`);
        if (res.data.exists) {
          setUsernameStatus({ state: 'taken', message: 'Username indisponível.' });
        } else {
          setUsernameStatus({ state: 'available', message: 'Username disponível!' });
        }
      } catch (error) {
        console.error("[RegisterModal] Erro ao checar Username:", error);
        setUsernameStatus({ state: 'error', message: 'Erro ao verificar.' });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [registerData.username]);

  const handleClose = () => {
    setRegisterStep('form');
    setRegisterData({ cpf: '', nome: '', username: '', email: '', telefone: '', senha: '', confirmar_senha: '' });
    setCpfStatus({ state: 'idle', message: '' });
    setUsernameStatus({ state: 'idle', message: '' });
    setShowRegPassword(false);
    onClose();
  };

  const handleCpfChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setRegisterData(prev => ({ ...prev, cpf: value }));
  };

  const handleRegisterDataChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({ ...prev, [name]: value }));
  };

  const isPasswordValid = {
    length: registerData.senha.length >= 8,
    uppercase: /[A-Z]/.test(registerData.senha),
    number: /[0-9]/.test(registerData.senha),
    special: /[^A-Za-z0-9]/.test(registerData.senha)
  };

  const isPasswordFullyValid = isPasswordValid.length && isPasswordValid.uppercase && isPasswordValid.number && isPasswordValid.special;
  const showPasswordMismatch = registerData.confirmar_senha.length > 0 && registerData.senha !== registerData.confirmar_senha;
  const doPasswordsMatch = registerData.senha === registerData.confirmar_senha && registerData.confirmar_senha.length > 0;

  const isFormValid = 
    registerData.nome.trim().length > 2 &&
    cpfStatus.state === 'available' &&
    usernameStatus.state === 'available' &&
    validateEmail(registerData.email) &&
    registerData.telefone.length >= 10 &&
    isPasswordFullyValid &&
    doPasswordsMatch;

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setModalLoading(true);
    try {
      await api.post('/api/gym/register', registerData);
      setRegisterStep('success');
      setTimeout(() => {
        handleClose();
      }, 4000);
    } catch (error) {
      console.error("[RegisterModal] Erro ao enviar cadastro:", error);
      toast.error(error.response?.data?.error || 'Erro ao solicitar cadastro.');
    } finally {
      setModalLoading(false);
    }
  };

  const getCpfBorderClass = () => {
    if (cpfStatus.state === 'invalid' || cpfStatus.state === 'exists' || cpfStatus.state === 'error') return 'border-red-500/50 focus:border-red-500';
    if (cpfStatus.state === 'available') return 'border-emerald-500/50 focus:border-emerald-500';
    return 'border-white/10 focus:border-yellow-500';
  };

  const getUsernameBorderClass = () => {
    if (usernameStatus.state === 'taken' || usernameStatus.state === 'error') return 'border-red-500/50 focus:border-red-500';
    if (usernameStatus.state === 'available') return 'border-emerald-500/50 focus:border-emerald-500';
    return 'border-white/10 focus:border-yellow-500';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-none">
        {registerStep === 'form' ? (
          <>
            <button onClick={handleClose} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={24} /></button>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mb-4 border border-yellow-500/20">
              <UserPlus size={24} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Novo Cadastro</h2>
            <p className="text-sm text-white/50 mb-6">Preencha seus dados. O RH avaliará sua solicitação em breve.</p>
            
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider ml-1">Nome Completo</label>
                <input 
                  type="text" 
                  name="nome"
                  value={registerData.nome}
                  onChange={handleRegisterDataChange}
                  placeholder="Seu nome completo"
                  className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white focus:border-yellow-500 transition-colors outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider ml-1 flex justify-between">
                  Username
                  {(usernameStatus.state === 'taken' || usernameStatus.state === 'error') && <span className="text-red-500 font-black animate-fade-in">{usernameStatus.message}</span>}
                  {usernameStatus.state === 'available' && <span className="text-emerald-500 font-black animate-fade-in">{usernameStatus.message}</span>}
                  {usernameStatus.state === 'validating' && <span className="text-yellow-500 animate-pulse">Verificando...</span>}
                </label>
                <input 
                  type="text" 
                  name="username"
                  value={registerData.username}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                    setRegisterData(prev => ({ ...prev, username: val }));
                  }}
                  placeholder="seunome"
                  className={`w-full bg-black border rounded-xl py-3 px-4 text-white outline-none mt-1 transition-colors ${getUsernameBorderClass()}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider ml-1 flex justify-between">
                  CPF
                  {(cpfStatus.state === 'invalid' || cpfStatus.state === 'exists' || cpfStatus.state === 'error') && <span className="text-red-500 font-black animate-fade-in">{cpfStatus.message}</span>}
                  {cpfStatus.state === 'available' && <span className="text-emerald-500 font-black animate-fade-in">{cpfStatus.message}</span>}
                  {cpfStatus.state === 'validating' && <span className="text-yellow-500 animate-pulse">Verificando...</span>}
                </label>
                <input 
                  type="tel" 
                  value={registerData.cpf}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  className={`w-full bg-black border rounded-xl py-3 px-4 text-white outline-none mt-1 transition-colors ${getCpfBorderClass()}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider ml-1">E-mail</label>
                <input 
                  type="email" 
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterDataChange}
                  placeholder="seu@email.com"
                  className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white focus:border-yellow-500 transition-colors outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider ml-1">Celular</label>
                <div className="mt-1 phone-input-container-login">
                  <PhoneInput
                    country={'br'}
                    value={registerData.telefone}
                    onChange={phone => setRegisterData(prev => ({ ...prev, telefone: phone }))}
                    inputStyle={{ 
                      width: '100%', 
                      background: 'black', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '0.75rem', 
                      color: 'white', 
                      paddingLeft: '48px', 
                      height: '50px',
                      fontSize: '1rem'
                    }}
                    buttonStyle={{ 
                      background: 'transparent', 
                      border: 'none', 
                      borderRadius: '0.75rem 0 0 0.75rem', 
                      paddingLeft: '8px' 
                    }}
                    dropdownStyle={{ 
                      background: '#111', 
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider ml-1 flex justify-between">
                  Senha
                </label>
                <div className="relative mt-1">
                  <input 
                    type={showRegPassword ? "text" : "password"} 
                    name="senha"
                    value={registerData.senha}
                    onChange={handleRegisterDataChange}
                    placeholder="••••••••"
                    className="w-full bg-black border border-white/10 rounded-xl py-3 pl-4 pr-12 text-white focus:border-yellow-500 transition-colors outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                
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
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider ml-1 flex justify-between">
                  Confirmar Senha
                  {showPasswordMismatch && <span className="text-red-500 font-black animate-fade-in">Senhas não coincidem</span>}
                </label>
                <input 
                  type={showRegPassword ? "text" : "password"} 
                  name="confirmar_senha"
                  value={registerData.confirmar_senha}
                  onChange={handleRegisterDataChange}
                  placeholder="••••••••"
                  className={`w-full bg-black border rounded-xl py-3 px-4 text-white outline-none mt-1 transition-colors ${showPasswordMismatch ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-yellow-500'}`}
                />
              </div>

              <button 
                type="submit" 
                disabled={modalLoading || !isFormValid} 
                className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center mt-4 ${isFormValid ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'}`}
              >
                {modalLoading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Enviar Solicitação'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 animate-fade-in text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/50 mb-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h4 className="text-xl font-black text-white mb-2">Solicitação Enviada!</h4>
            <p className="text-sm text-white/60">Seus dados foram enviados para o RH. Você será avisado quando seu acesso for liberado.</p>
          </div>
        )}
      </div>
    </div>
  );
}