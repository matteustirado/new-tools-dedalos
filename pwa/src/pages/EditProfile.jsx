import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Camera, LogOut, AlertOctagon, Save, X, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function EditProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [confirmCpf, setConfirmCpf] = useState('');
  
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    username: '',
    bio: '',
    instagram: '',
    telefone: '',
    departamento: '',
    contato_emergencia: '',
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: ''
  });

  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [removerFoto, setRemoverFoto] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('gym_user');
    
    if (!storedUser) {
      navigate('/login');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const tempData = sessionStorage.getItem('temp_profile_data');
    const tempPreview = sessionStorage.getItem('temp_profile_preview');
    
    if (tempData) {
      setFormData(JSON.parse(tempData));
      sessionStorage.removeItem('temp_profile_data');
    }
    
    if (location.state?.croppedImage) {
      const croppedBase64 = location.state.croppedImage;
      setFotoPreview(croppedBase64);
      setRemoverFoto(false);
      sessionStorage.removeItem('temp_profile_preview');
      
      const arr = croppedBase64.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      const file = new File([u8arr], "perfil.jpg", { type: mime });
      setFotoFile(file);
    } else if (tempData) {
      if (tempPreview) {
        setFotoPreview(tempPreview);
        sessionStorage.removeItem('temp_profile_preview');
      }
    } else {
      fetchCurrentData(parsedUser.cpf);
    }
  }, [navigate, location.state]);

  const fetchCurrentData = async (cpf) => {
    try {
      const res = await axios.get(`${API_URL}/api/gym/profile/${cpf}?type=cpf`);
      const data = res.data;
      
      setFormData(prev => ({
        ...prev,
        nome: data.nome || '',
        username: data.username || '',
        bio: data.bio !== 'Focado nos treinos! 💪' ? data.bio : '',
        instagram: data.instagram || '',
        telefone: data.telefone || '',
        departamento: data.departamento || '',
        contato_emergencia: data.contato_emergencia || '',
      }));

      if (data.foto_perfil) {
        setUser(prev => prev ? { ...prev, foto_perfil: data.foto_perfil } : prev);
      }
    } catch (err) {
      toast.error('Erro ao carregar seus dados.');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  const handleSave = async () => {
    if (showPasswordForm) {
      if (!formData.senha_atual || !formData.nova_senha || !formData.confirmar_senha) {
        toast.warning('Preencha todos os campos de senha ou cancele a alteração.');
        return;
      }
      
      if (formData.nova_senha !== formData.confirmar_senha) {
        toast.error('A nova senha e a confirmação não coincidem.');
        return;
      }
      
      if (formData.nova_senha.length < 6) {
        toast.warning('A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }

    setLoading(true);
    
    try {
      const data = new FormData();
      data.append('cpf', user.cpf);
      
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          data.append(key, formData[key]);
        }
      });

      if (fotoFile) {
        data.append('foto_perfil', fotoFile);
      }

      if (removerFoto) {
        data.append('remover_foto', 'true');
      }

      const res = await axios.put(`${API_URL}/api/gym/profile/edit`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const updatedUser = { 
        ...user, 
        nome: formData.nome || user.nome,
        username: formData.username || user.username,
        foto_perfil: removerFoto ? null : (res.data.nova_foto_url || user.foto_perfil) 
      };
      
      localStorage.setItem('gym_user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      toast.success('Perfil atualizado com sucesso! 🎉');
      navigate('/profile');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar perfil.');
    } finally {
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
        await axios.put(`${API_URL}/api/gym/users/${userCleanCpf}/toggle-block`, { is_blocked: 1 });
        toast.info('Conta desativada. Até logo! 👋');
        handleLogout();
      } catch (err) {
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

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-x-hidden pb-10">
      
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-black tracking-tight">Editar Perfil</h1>
        <button onClick={handleSave} disabled={loading} className="p-2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50">
          {loading ? <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div> : <Save size={24} />}
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
            <input type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Username (@)</label>
            <input type="text" name="username" value={formData.username} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Bio</label>
            <textarea name="bio" value={formData.bio} onChange={handleChange} placeholder="Focado nos treinos! 💪" rows="3" className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors resize-none"></textarea>
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Instagram</label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">@</span>
              <input type="text" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="seu.instagram" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-10 pr-4 text-white focus:border-yellow-500 outline-none transition-colors" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2 flex justify-between items-end">
            <span className="flex items-center gap-1.5"><Lock size={12} /> Dados Pessoais</span>
            <span className="text-[9px] text-white/30 tracking-normal normal-case">Somente a empresa vê</span>
          </h2>
          
          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Celular / WhatsApp</label>
            <input type="tel" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 00000-0000" className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Departamento / Unidade</label>
            <input type="text" name="departamento" value={formData.departamento} onChange={handleChange} placeholder="Ex: Marketing - Matriz" className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 ml-1">Contato de Emergência</label>
            <input type="text" name="contato_emergencia" value={formData.contato_emergencia} onChange={handleChange} placeholder="Nome e Telefone" className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white mt-1 focus:border-yellow-500 outline-none transition-colors" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">
            Segurança
          </h2>
          
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
              </div>
              
              <div>
                <label className="text-xs font-bold text-white/70 ml-1">Confirmar Nova Senha <span className="text-red-500">*</span></label>
                <div className="relative mt-1">
                  <input 
                    type={showConfirmarSenha ? "text" : "password"} 
                    name="confirmar_senha" 
                    value={formData.confirmar_senha} 
                    onChange={handleChange} 
                    placeholder="••••••••" 
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-white focus:border-yellow-500 outline-none transition-colors" 
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
            disabled={loading}
            className="w-full bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-500 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-emerald-500/10"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
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

      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
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

    </div>
  );
}