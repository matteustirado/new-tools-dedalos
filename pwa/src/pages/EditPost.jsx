import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, MapPin, Zap, Send, Navigation, Save, Image as ImageIcon, Globe, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function EditPost() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mensagem, setMensagem] = useState('');
  const [academiaNome, setAcademiaNome] = useState('');
  const [isArchived, setIsArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const capturedData = location.state || {};
  const photo = capturedData.photo || null;
  const isUpload = capturedData.isUpload || false;
  const existingPost = capturedData.post || null; 
  const isEditing = !!existingPost;

  const [localGpsData, setLocalGpsData] = useState(capturedData.location || null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('gym_user');

    if (!storedUser) {
      toast.error('Sessão expirada.');
      navigate('/login');
      return;
    }

    setUser(JSON.parse(storedUser));

    if (isEditing) {
      setMensagem(existingPost.mensagem || '');
      setAcademiaNome(existingPost.unidade || '');
      setIsArchived(existingPost.arquivado === 1);
    } else if (!photo) {
      toast.warning('Nenhuma foto capturada.');
      navigate('/feed');
    }
  }, [navigate, photo, isEditing, existingPost]);

  useEffect(() => {
    if (!isEditing && !localGpsData && !isLocating) {
      handleGetLocation();
    }
  }, []);

  const handleGetLocation = () => {
    setIsLocating(true);
    
    if (!navigator.geolocation) {
      toast.error('Geolocalização não é suportada pelo seu navegador.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocalGpsData({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        toast.success('Localização obtida com sucesso! 📍');
        setIsLocating(false);
      },
      (error) => {
        console.warn("Erro ao buscar GPS no EditPost:", error);
        toast.error('Falha ao obter GPS. Verifique se a localização está ativada no celular.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  };

  const handleAction = async () => {
    if (!user) return;
    
    if (!academiaNome.trim()) {
      toast.warning('Por favor, informe onde você treinou!');
      return;
    }

    if (!isEditing && !localGpsData) {
      toast.error('A localização (GPS) é obrigatória para validar o check-in!');
      return;
    }

    setLoading(true);

    if (isEditing) {
      try {
        await axios.put(`${API_URL}/api/gym/post/${existingPost.id}/edit`, {
          colaborador_cpf: user.cpf,
          mensagem,
          academia_digitada: academiaNome
        });

        const wasArchived = existingPost.arquivado === 1;
        if (isArchived !== wasArchived) {
          const endpoint = isArchived ? 'archive' : 'unarchive';
          await axios.put(`${API_URL}/api/gym/post/${existingPost.id}/${endpoint}`, {
            colaborador_cpf: user.cpf
          });
        }

        toast.success('Publicação atualizada!');
        navigate(-1); 
      } catch (err) {
        toast.error(err.response?.data?.error || 'Erro ao atualizar a publicação.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!photo) {
        setLoading(false);
        return;
      }
      
      try {
        const formData = new FormData();
        formData.append('colaborador_cpf', user.cpf);
        formData.append('mensagem', mensagem);
        formData.append('academia_digitada', academiaNome);
        formData.append('foto_treino', dataURLtoFile(photo, 'treino.jpg'));
        formData.append('pontos', isUpload ? '0.5' : '1');

        if (localGpsData) {
          formData.append('latitude', localGpsData.lat);
          formData.append('longitude', localGpsData.lng);
        }

        const res = await axios.post(`${API_URL}/api/gym/checkin`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (isArchived && res.data.checkin_id) {
          await axios.put(`${API_URL}/api/gym/post/${res.data.checkin_id}/archive`, {
            colaborador_cpf: user.cpf
          });
        }

        toast.success(`Check-in registrado com sucesso! +${isUpload ? '0.5' : '1'} Ponto 🍌`);
        
        if (isArchived) {
          navigate(`/${user.username}`);
        } else {
          navigate('/feed');
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Erro ao publicar o check-in.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!photo && !isEditing) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-emerald-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-md z-10 relative">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-black tracking-tight">{isEditing ? 'Editar Post' : 'Novo Post'}</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full z-10 flex flex-col gap-6 animate-fade-in-up pb-8">
        <div className="w-full aspect-[4/5] bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
          <img
            src={isEditing ? `${API_URL}${existingPost.foto_treino_url}` : photo}
            alt="Treino"
            className={`w-full h-full object-cover transition-all duration-500 ${isArchived ? 'grayscale opacity-70' : ''}`}
          />

          {!isEditing && (
            <>
              {isUpload ? (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-orange-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                  <ImageIcon size={14} className="text-orange-400" />
                  <span className="text-xs font-black text-orange-400 tracking-wider">
                    GALERIA (+0.5 PT)
                  </span>
                </div>
              ) : (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Zap size={14} className="text-emerald-400" />
                  <span className="text-xs font-black text-emerald-400 tracking-wider">
                    TEMPO REAL (+1 PT)
                  </span>
                </div>
              )}

              <div className={`absolute bottom-4 left-4 bg-black/70 backdrop-blur-md border ${localGpsData ? 'border-emerald-500/40' : 'border-red-500/40'} px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg transition-all`}>
                {isLocating ? (
                  <Loader2 size={12} className="text-red-400 animate-spin" />
                ) : (
                  <Navigation size={12} className={localGpsData ? 'text-emerald-400' : 'text-red-400'} />
                )}
                
                {localGpsData ? (
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    GPS Gravado
                  </span>
                ) : (
                  <button 
                    type="button"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className="text-[10px] font-bold text-red-400 uppercase tracking-wider disabled:opacity-50"
                  >
                    {isLocating ? 'Buscando GPS...' : 'Obter Localização'}
                  </button>
                )}
              </div>
            </>
          )}

          {isArchived && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex flex-col items-center gap-2 pointer-events-none">
               <EyeOff size={24} className="text-white/50" />
               <span className="text-xs font-black text-white/70 uppercase tracking-widest">Privado</span>
             </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-white/70 ml-1 uppercase tracking-wider">
            Privacidade
          </label>
          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1.5">
            <button
              type="button"
              onClick={() => setIsArchived(false)}
              className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl text-sm transition-all duration-300 ${
                !isArchived 
                  ? 'bg-yellow-500 text-black font-black shadow-md' 
                  : 'text-white/50 hover:text-white font-medium'
              }`}
            >
              <Globe size={16} />
              Público
            </button>
            <button
              type="button"
              onClick={() => setIsArchived(true)}
              className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl text-sm transition-all duration-300 ${
                isArchived 
                  ? 'bg-[#1a1a1a] text-white font-black shadow-md border border-white/10' 
                  : 'text-white/50 hover:text-white font-medium'
              }`}
            >
              <EyeOff size={16} />
              Arquivado
            </button>
          </div>
          <p className="text-[10px] font-medium text-white/40 ml-2 mt-0.5">
            {isArchived 
              ? 'Apenas você poderá ver esta foto na aba de Arquivos do seu perfil.' 
              : 'Sua foto ficará visível no Feed para todos do Banana\'s Gym.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <label className="text-xs font-bold text-white/70 ml-1 flex items-center gap-2 uppercase tracking-wider">
            <MapPin size={14} className="text-yellow-500" />
            Onde você treinou? <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={academiaNome}
            onChange={(e) => setAcademiaNome(e.target.value)}
            placeholder="Ex: Smart Fit - Paulista"
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all font-bold"
          />
        </div>

        <div className="flex-1 flex flex-col">
          <label className="text-xs font-bold text-white/70 ml-1 mb-2 uppercase tracking-wider">
            Legenda (Opcional)
          </label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Compartilhe como foi o seu treino!"
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all resize-none h-24"
          />
        </div>
      </main>

      <div className="p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent z-10 pb-10 mt-auto">
        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full max-w-md mx-auto bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl shadow-[0_10px_30px_rgba(234,179,8,0.2)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              {isEditing ? <Save size={20} /> : <Send size={20} />}
              {isEditing ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR CHECK-IN'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}