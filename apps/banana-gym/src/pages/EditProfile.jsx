import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronLeft, Camera, LogOut, AlertOctagon, Save, X, 
  Lock, Eye, EyeOff, Activity, CheckCircle2, ShieldCheck, Check, BellRing
} from 'lucide-react';
import { toast } from 'react-toastify';
import PhoneInputModule from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

import api from '../services/api';
import { validateEmail } from '../utils/validators';
import TwoFactorModal from '../components/TwoFactorModal';
import { subscribeToPushNotifications } from '../utils/push';

const PhoneInput = PhoneInputModule.default || PhoneInputModule;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const LIMITS = {
  nome: 30,
  username: 20,
  bio: 150,
  instagram: 30,
  departamento: 40,
  contato_emergencia: 20
};

export default function EditProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [hasStrava, setHasStrava] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return !!parsed.has_strava;
    }
    return false;
  });

  const [has2FA, setHas2FA] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return !!parsed.two_factor_enabled;
    }
    return false;
  });

  const [hasPushEnabled, setHasPushEnabled] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  const [formData, setFormData] = useState(() => {
    const tempData = sessionStorage.getItem('temp_profile_data');
    if (tempData) return JSON.parse(tempData);
    
    return {
      nome: '',
      username: '',
      email: '',
      bio: '',
      instagram: '',
      telefone: '',
      departamento: '',
      contato_emergencia: '',
      senha_atual: '',
      nova_senha: '',
      confirmar_senha: ''
    };
  });

  const [fotoPreview, setFotoPreview] = useState(() => {
    if (location.state?.croppedImage) return location.state.croppedImage;
    const tempPreview = sessionStorage.getItem('temp_profile_preview');
    if (tempPreview) return tempPreview;
    return null;
  });

  const [fotoFile, setFotoFile] = useState(() => {
    if (location.state?.croppedImage) {
      const croppedBase64 = location.state.croppedImage;
      const arr = croppedBase64.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      return new File([u8arr], "perfil.jpg", { type: mime });
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showStravaDisconnectModal, setShowStravaDisconnectModal] = useState(false);
  const [showStravaRedirectModal, setShowStravaRedirectModal] = useState(false); 
  const [confirmCpf, setConfirmCpf] = useState('');
  
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [removerFoto, setRemoverFoto] = useState(false);

  const [show2FAModal, setShow2FAModal] = useState(() => {
    return sessionStorage.getItem('2fa_modal_open') === 'true';
  });

  useEffect(() => {
    if (!user?.cpf) {
      navigate('/login');
      return;
    }

    const fetchCurrentData = async (cpf) => {
      try {
        const res = await api.get(`/api/gym/profile/${cpf}?type=cpf`);
        const data = res.data;
        
        setFormData(prev => ({
          ...prev,
          nome: data.nome || '',
          username: data.username || '',
          email: data.email || '',
          bio: data.bio !== 'Focado nos treinos! 💪' ? data.bio : '',
          instagram: data.instagram || '',
          telefone: data.telefone || '',
          departamento: data.departamento || '',
          contato_emergencia: data.contato_emergencia || '',
        }));

        setHasStrava(!!data.has_strava);
        setHas2FA(!!data.two_factor_enabled);

        setUser(prevUser => {
          if (!prevUser) return prevUser;
          const updatedUser = { ...prevUser, has_strava: !!data.has_strava, two_factor_enabled: !!data.two_factor_enabled };
          if (data.foto_perfil) updatedUser.foto_perfil = data.foto_perfil;
          localStorage.setItem('gym_user', JSON.stringify(updatedUser));
          return updatedUser;
        });

      } catch (err) {
        console.error("[EditProfile] Erro ao carregar dados:", err);
        toast.error('Erro ao carregar seus dados.');
      }
    };

    const hasTempData = !!sessionStorage.getItem('temp_profile_data');
    const hasCroppedImage = !!location.state?.croppedImage;

    sessionStorage.removeItem('temp_profile_data');
    sessionStorage.removeItem('temp_profile_preview');

    if (!hasTempData && !hasCroppedImage) {
      fetchCurrentData(user.cpf);
    }
  }, [navigate, location.state, user?.cpf]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUsernameChange = (e) => {
    let val = e.target.value;
    val = val.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setFormData({ ...formData, username: val });
  };

  const handlePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handleRemovePhoto = () => {
    setFotoPreview(null);
    setFotoFile(null);
    setRemoverFoto(true);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione apenas imagens.');
        return;
      }

      sessionStorage.setItem('temp_profile_data', JSON.stringify(formData));
      
      if (fotoPreview) {
        sessionStorage.setItem('temp_profile_preview', fotoPreview);
      }

      const reader = new FileReader();
      
      reader.onloadend = () => {
        navigate('/crop', { 
          state: { 
            photo: reader.result, 
            returnTo: '/edit-profile' 
          } 
        });
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handlePushToggle = async () => {
    if (hasPushEnabled) {
      toast.info("Para desativar as notificações, você precisa bloqueá-las nas configurações do seu navegador/celular.");
    } else {
      if ('Notification' in window && Notification.permission === 'denied') {
        toast.warning("Você bloqueou as notificações no passado. Desbloqueie nas configurações do seu celular.");
        return;
      }
      
      const success = await subscribeToPushNotifications(user.cpf);
      if (success) {
        setHasPushEnabled(true);
      }
    }
  };

  const handleStravaToggle = async () => {
    if (hasStrava) {
      setShowStravaDisconnectModal(true);
    } else {
      setShowStravaRedirectModal(true); 
    }
  };

  const handle2FAToggle = async () => {
    if (has2FA) {
      const confirmDisable = window.confirm("Deseja realmente desativar a Autenticação de 2 Fatores? Sua conta ficará menos segura.");
      if (confirmDisable) {
        setHas2FA(false);
        const updatedUser = { ...user, two_factor_enabled: false };
        localStorage.setItem('gym_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        toast.info("A2F desativado.");
      }
    } else {
      setShow2FAModal(true);
      sessionStorage.setItem('2fa_modal_open', 'true');
    }
  };

  const handle2FASuccess = useCallback(() => {
    setHas2FA(true);
    setUser(prev => {
      const updatedUser = { ...prev, two_factor_enabled: true };
      localStorage.setItem('gym_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
    setShow2FAModal(false);
    sessionStorage.removeItem('2fa_modal_open');
    sessionStorage.removeItem('2fa_step');
    sessionStorage.removeItem('2fa_qr');
    sessionStorage.removeItem('2fa_secret');
  }, []);

  const handle2FAClose = useCallback(() => {
    setShow2FAModal(false);
    sessionStorage.removeItem('2fa_modal_open');
    sessionStorage.removeItem('2fa_step');
    sessionStorage.removeItem('2fa_qr');
    sessionStorage.removeItem('2fa_secret');
  }, []);

  const confirmStravaRedirect = async () => {
    sessionStorage.setItem('temp_profile_data', JSON.stringify(formData));
    if (fotoPreview) {
      sessionStorage.setItem('temp_profile_preview', fotoPreview);
    }

    try {
      const res = await api.get('/api/gym/strava/auth-url');
      window.location.href = res.data.url;
    } catch (err) {
      console.error("[EditProfile] Erro Strava auth:", err);
      toast.error('Não foi possível iniciar a conexão com o Strava.');
      setShowStravaRedirectModal(false);
    }
  };

  const confirmDisconnectStrava = async () => {
    try {
      await api.post('/api/gym/strava/disconnect', { cpf: user.cpf });
      setHasStrava(false);
      setShowStravaDisconnectModal(false);
      
      const updatedUser = { ...user, has_strava: false };
      localStorage.setItem('gym_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
    } catch (err) {
      console.error("[EditProfile] Erro Strava disconnect:", err);
      toast.error('Erro ao desconectar do Strava.');
    }
  };

  const handleCancelPassword = () => {
    setShowPasswordForm(false);
    setShowSenhaAtual(false);
    setShowNovaSenha(false);
    setShowConfirmarSenha(false);
    
    setFormData(prev => ({
      ...prev,
      senha_atual: '',
      nova_senha: '',
      confirmar_senha: ''
    }));
  };

  const isPasswordValid = {
    length: formData.nova_senha.length >= 8,
    uppercase: /[A-Z]/.test(formData.nova_senha),
    number: /[0-9]/.test(formData.nova_senha),
    special: /[^A-Za-z0-9]/.test(formData.nova_senha)
  };

  const isPasswordFullyValid = isPasswordValid.length && isPasswordValid.uppercase && isPasswordValid.number && isPasswordValid.special;
  const passwordsMatch = formData.nova_senha === formData.confirmar_senha || formData.confirmar_senha === '';
  const isSaveDisabled = loading || (showPasswordForm && (!isPasswordFullyValid || formData.nova_senha !== formData.confirmar_senha || !formData.senha_atual));

  const handleSave = async () => {
    if (formData.email && !validateEmail(formData.email)) {
      return toast.warning("O formato do e-mail é inválido.");
    }

    if (showPasswordForm) {
      if (!formData.senha_atual || !formData.nova_senha || !formData.confirmar_senha) {
        toast.warning('Preencha todos os campos de senha ou cancele a alteração.');
        return;
      }

      if (!isPasswordFullyValid) {
        toast.warning('A nova senha não atende aos requisitos mínimos de segurança.');
        return;
      }
      
      if (formData.nova_senha !== formData.confirmar_senha) {
        toast.error('A nova senha e a confirmação não coincidem.');
        return;
      }
    }

    setLoading(true);

    if (showPasswordForm) {
      try {
        await api.put('/api/gym/change-password', {
          cpf: user.cpf,
          senha_atual: formData.senha_atual,
          nova_senha: formData.nova_senha
        });
      } catch (err) {
        console.error("[EditProfile] Erro ao alterar senha:", err);
        toast.error(err.response?.data?.error || 'A senha atual está incorreta. Tente novamente.');
        setLoading(false);
        return; 
      }
    }
    
    try {
      const data = new FormData();
      data.append('cpf', user.cpf);
      
      Object.keys(formData).forEach(key => {
        if (key !== 'senha_atual' && key !== 'nova_senha' && key !== 'confirmar_senha') {
          if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
            data.append(key, formData[key]);
          }
        }
      });

      if (fotoFile) {
        data.append('foto_perfil', fotoFile);
      }

      if (removerFoto) {
        data.append('remover_foto', 'true');
      }

      const res = await api.put('/api/gym/profile/edit', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const updatedUser = { 
        ...user, 
        nome: formData.nome || user.nome,
        username: formData.username || user.username,
        email: formData.email || user.email,
        foto_perfil: removerFoto ? null : (res.data.nova_foto_url || user.foto_perfil) 
      };
      
      localStorage.setItem('gym_user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      setShowSuccessScreen(true);
      setTimeout(() => navigate('/profile'), 1500);

    } catch (err) {
      console.error("[EditProfile] Erro ao atualizar perfil:", err);
      toast.error(err.response?.data?.error || 'Erro ao atualizar perfil.');
      setLoading(false);
    } 
  };

  const handleLogout = () => {
    localStorage.removeItem('gym_user');
    navigate('/login');
  };

  const handleDeactivate = async () => {
    const cleanCpf = confirmCpf.replace(/\D/g, '');
    const userCleanCpf = user.cpf.replace(/\D/g, '');

    if (cleanCpf !== userCleanCpf) {
      toast.error('O CPF digitado não confere.');
      return;
    }

    const confirmAction = window.confirm("Tem certeza absoluta? Esta ação desativará seu acesso e você precisará do RH para voltar.");
    
    if (confirmAction) {
      try {
        await api.put(`/api/gym/users/${userCleanCpf}/toggle-block`, { is_blocked: 1 });
        toast.info('Conta desativada. Até logo! 👋'); 
        handleLogout();
      } catch (err) {
        console.error("[EditProfile] Erro ao desativar conta:", err);
        toast.error('Erro ao desativar conta.');
      }
    }
  };

  if (!user) return null;

  let displayPhoto = null;
  if (fotoPreview) {
    displayPhoto = fotoPreview;
  } else if (user?.foto_perfil && !removerFoto) {
    displayPhoto = `${API_URL}${user.foto_perfil}`;
  }

  const bioLength = formData.bio.length;
  const bioLeft = LIMITS.bio - bioLength;
  let bioCounterColor = 'text-white/40';
  if (bioLeft <= 10) bioCounterColor = 'text-red-500 font-black';
  else if (bioLeft <= 25) bioCounterColor = 'text-yellow-500 font-bold';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-x-hidden pb-10">
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-black tracking-tight">Editar Perfil</h1>
        <button onClick={handleSave} disabled={isSaveDisabled} className="p-2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 transition-all">
          {loading ? <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" /> : <Save size={24} />}
        </button>
      </header>

      <div className="max-w-md mx-auto w-full p-5 space-y-8 animate-fade-in-up">
        <div className="flex flex-col items-center">
          <div 
            onClick={handlePhotoClick}
            className="w-24 h-24 rounded-full bg-white/5 border-2 border-white/10 overflow-hidden relative cursor-pointer group shadow-lg"
          >
            {displayPhoto ? (
              <img src={displayPhoto} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 font-black text-2xl">
                {user.username ? user.username.charAt(0).toUpperCase() : user.nome.charAt(0)}
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={24} className="text-white" />
            </div>
          </div>
          
          <button type="button" onClick={handlePhotoClick} className="text-sm font-bold text-yellow-500 mt-4 hover:underline">
            Alterar foto de perfil
          </button>

          {displayPhoto && (
            <button type="button" onClick={handleRemovePhoto} className="text-sm font-bold text-red-500 mt-2 hover:underline transition-colors">
              Remover foto de perfil
            </button>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handlePhotoChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <section className="space-y-4">
          <h2 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">
            Informações de Perfil
          </h2>
          
          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Nome de Exibição</label>
            <input 
              type="text" 
              name="nome" 
              value={formData.nome} 
              onChange={handleChange} 
              maxLength={LIMITS.nome}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Username (@)</label>
            <input 
              type="text" 
              name="username" 
              value={formData.username} 
              onChange={handleUsernameChange} 
              maxLength={LIMITS.username}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" 
            />
          </div>

          <div>
            <label className="text-xs font-bold ml-1 mb-1 flex items-center justify-between">
              <span className="text-white/70">Bio</span>
              <span className={`text-[10px] ${bioCounterColor}`}>
                {bioLength} / {LIMITS.bio}
              </span>
            </label>
            <textarea 
              name="bio" 
              value={formData.bio} 
              onChange={handleChange} 
              maxLength={LIMITS.bio}
              placeholder="Focado nos treinos! 💪" 
              rows="3" 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Instagram</label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">@</span>
              <input 
                type="text" 
                name="instagram" 
                value={formData.instagram} 
                onChange={handleChange} 
                maxLength={LIMITS.instagram}
                placeholder="seu.instagram" 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-10 pr-4 text-white focus:border-yellow-500 outline-none transition-colors" 
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">
            Aplicativos Conectados
          </h2>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPushEnabled ? 'bg-blue-500/10' : 'bg-white/5'}`}>
                <BellRing size={20} className={hasPushEnabled ? 'text-blue-400' : 'text-white/40'} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white">Notificações Push</span>
                <span className="text-[10px] font-medium text-white/50">
                  {hasPushEnabled ? 'Alertas ativados neste celular' : 'Receba alertas de curtidas'}
                </span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handlePushToggle}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out relative ${hasPushEnabled ? 'bg-blue-500' : 'bg-white/20'}`}
            >
              <div 
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${hasPushEnabled ? 'translate-x-5' : 'translate-x-0'}`} 
              />
            </button>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FC4C02]/10 flex items-center justify-center">
                <Activity size={20} className="text-[#FC4C02]" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white">Strava</span>
                <span className="text-[10px] font-medium text-white/50">
                  {hasStrava ? 'Registrando corridas (+0.5 pt)' : 'Conecte para ganhar pontos'}
                </span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleStravaToggle}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out relative ${hasStrava ? 'bg-emerald-500' : 'bg-white/20'}`}
            >
              <div 
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${hasStrava ? 'translate-x-5' : 'translate-x-0'}`} 
              />
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2 flex justify-between items-end">
            <span className="flex items-center gap-1.5"><Lock size={12} /> Dados Pessoais</span>
            <span className="text-[9px] text-white/30 tracking-normal normal-case">Somente a empresa vê</span>
          </h2>
          
          <div>
            <label className="text-xs font-bold text-white/70 ml-1 flex justify-between items-center">
              <span>E-mail</span>
              {formData.email && !validateEmail(formData.email) && (
                 <span className="text-[10px] text-red-500 font-bold">Formato Inválido</span>
              )}
            </label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="seu@email.com"
              className={`w-full bg-white/5 border rounded-xl p-3.5 text-white mt-1 outline-none transition-colors ${formData.email && !validateEmail(formData.email) ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-yellow-500'}`} 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Celular / WhatsApp</label>
            <div className="mt-1 phone-input-container">
              <PhoneInput
                country={'br'}
                value={formData.telefone}
                onChange={phone => setFormData({ ...formData, telefone: phone })}
                inputStyle={{ 
                  width: '100%', 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '0.75rem', 
                  color: 'white', 
                  paddingLeft: '48px', 
                  height: '52px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s ease-in-out'
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
            <label className="text-xs font-bold text-white/70 ml-1">Departamento / Unidade</label>
            <input 
              type="text" 
              name="departamento" 
              value={formData.departamento} 
              onChange={handleChange} 
              maxLength={LIMITS.departamento}
              placeholder="Ex: Marketing - Matriz" 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Contato de Emergência</label>
            <input 
              type="text" 
              name="contato_emergencia" 
              value={formData.contato_emergencia} 
              onChange={handleChange} 
              maxLength={LIMITS.contato_emergencia}
              placeholder="Nome e Telefone" 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" 
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">
            Segurança
          </h2>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${has2FA ? 'bg-emerald-500/10' : 'bg-yellow-500/10'}`}>
                <ShieldCheck size={20} className={has2FA ? 'text-emerald-500' : 'text-yellow-500'} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white">Autenticação 2 Fatores</span>
                <span className="text-[10px] font-medium text-white/50">
                  {has2FA ? 'Proteção ativada (Recomendado)' : 'Ative para proteger sua conta'}
                </span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handle2FAToggle}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out relative ${has2FA ? 'bg-emerald-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${has2FA ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          
          {!showPasswordForm ? (
            <button 
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl transition-all"
            >
              Alterar Senha
            </button>
          ) : (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-4 animate-fade-in">
              <div>
                <label className="text-xs font-bold text-white/70 ml-1">Senha Atual <span className="text-red-500">*</span></label>
                <div className="relative mt-1">
                  <input 
                    type={showSenhaAtual ? "text" : "password"} 
                    name="senha_atual" 
                    value={formData.senha_atual} 
                    onChange={handleChange} 
                    placeholder="••••••••" 
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-white focus:border-yellow-500 outline-none transition-colors" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showSenhaAtual ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-white/70 ml-1">Nova Senha <span className="text-red-500">*</span></label>
                <div className="relative mt-1">
                  <input 
                    type={showNovaSenha ? "text" : "password"} 
                    name="nova_senha" 
                    value={formData.nova_senha} 
                    onChange={handleChange} 
                    placeholder="••••••••" 
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-white focus:border-yellow-500 outline-none transition-colors" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {formData.nova_senha && (
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
              
              <div>
                <label className="text-xs font-bold text-white/70 ml-1 flex justify-between">
                  Confirmar Nova Senha <span className="text-red-500">*</span>
                  {!passwordsMatch && <span className="text-red-500 font-black animate-fade-in normal-case">Senhas não coincidem</span>}
                </label>
                <div className="relative mt-1">
                  <input 
                    type={showConfirmarSenha ? "text" : "password"} 
                    name="confirmar_senha" 
                    value={formData.confirmar_senha} 
                    onChange={handleChange} 
                    placeholder="••••••••" 
                    className={`w-full bg-black/50 border rounded-xl py-3.5 pl-4 pr-12 text-white outline-none transition-colors ${!passwordsMatch ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-yellow-500'}`} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="button" 
                  onClick={handleCancelPassword}
                  className="text-xs font-bold text-white/50 hover:text-white py-2 px-4 transition-colors"
                >
                  Cancelar Alteração
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="pt-8 space-y-4">
          <button 
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="w-full bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-500 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-emerald-500/10"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            Salvar Alterações
          </button>

          <button 
            onClick={handleLogout}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} /> Sair da Conta
          </button>

          <button 
            onClick={() => setShowDeactivateModal(true)}
            className="w-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <AlertOctagon size={20} /> Desativar Conta
          </button>
        </section>
      </div>

      {show2FAModal && (
        <TwoFactorModal 
          user={user} 
          onClose={handle2FAClose} 
          onSuccess={handle2FASuccess} 
        />
      )}

      {showDeactivateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#111] border border-red-500/30 rounded-3xl w-full max-w-sm p-6 shadow-[0_0_40px_rgba(239,68,68,0.2)] relative">
            <button onClick={() => setShowDeactivateModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={24} /></button>
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 border border-red-500/20">
              <AlertOctagon size={24} />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Zona de Perigo</h2>
            <p className="text-sm text-white/60 mb-6">
              Para desativar sua conta, confirme seu <b>CPF</b> abaixo. Você precisará contatar o RH se quiser voltar a usar o app.
            </p>
            
            <input 
              type="tel" 
              value={confirmCpf}
              onChange={(e) => setConfirmCpf(e.target.value)}
              placeholder="Digite seu CPF (apenas números)"
              className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white focus:border-red-500 outline-none transition-colors mb-4"
            />
            <button 
              onClick={handleDeactivate} 
              className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-500 transition-colors"
            >
              Sim, desativar minha conta
            </button>
          </div>
        </div>
      )}

      {showStravaDisconnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowStravaDisconnectModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={24} /></button>
            <div className="w-12 h-12 bg-[#FC4C02]/10 rounded-full flex items-center justify-center text-[#FC4C02] mb-4 border border-[#FC4C02]/20">
              <Activity size={24} />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Desconectar Strava?</h2>
            <p className="text-sm text-white/60 mb-6">
              O Banana's Gym não conseguirá mais ler suas corridas e você não ganhará pontos automáticos por correr.
            </p>
            
            <button 
              onClick={confirmDisconnectStrava} 
              className="w-full bg-[#FC4C02] text-white font-black py-3.5 rounded-xl hover:bg-[#E34402] transition-colors shadow-lg shadow-[#FC4C02]/20"
            >
              Desconectar
            </button>
          </div>
        </div>
      )}

      {showStravaRedirectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowStravaRedirectModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={24} /></button>
            <div className="w-12 h-12 bg-[#FC4C02]/10 rounded-full flex items-center justify-center text-[#FC4C02] mb-4 border border-[#FC4C02]/20">
              <Activity size={24} />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Conectar Strava</h2>
            <p className="text-sm text-white/60 mb-6">
              Você será redirecionado para o site oficial do Strava para autorizar o Banana's Gym. Salvaremos seus dados preenchidos aqui para quando você voltar!
            </p>
            
            <button 
              onClick={confirmStravaRedirect} 
              className="w-full bg-[#FC4C02] text-white font-black py-3.5 rounded-xl hover:bg-[#E34402] transition-colors shadow-lg shadow-[#FC4C02]/20"
            >
              Ir para o Strava
            </button>
          </div>
        </div>
      )}

      {showSuccessScreen && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center gap-6 animate-fade-in-up text-center">
            <div className="w-28 h-28 bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={56} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Perfil Atualizado!</h2>
              <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                Redirecionando...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}