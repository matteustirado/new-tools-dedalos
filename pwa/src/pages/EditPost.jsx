import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, MapPin, Zap, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function EditPost() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const capturedData = location.state || {};
  const photo = capturedData.photo || null;
  const gpsData = capturedData.location || null;

  useEffect(() => {
    const storedUser = localStorage.getItem('gym_user');
    
    if (!storedUser) {
      toast.error('Sessão expirada.');
      navigate('/login');
      return;
    }
    
    setUser(JSON.parse(storedUser));

    if (!photo) {
      toast.warning('Nenhuma foto capturada.');
      navigate('/feed');
    }
  }, [navigate, photo]);

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

  const handlePublish = async () => {
    if (!user || !photo) return;
    
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('cpf', user.cpf);
      formData.append('mensagem', mensagem);
      formData.append('foto_treino', dataURLtoFile(photo, 'treino.jpg'));
      
      if (gpsData) {
        formData.append('latitude', gpsData.lat);
        formData.append('longitude', gpsData.lng);
      }

      await axios.post(`${API_URL}/api/gym/checkin`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Check-in publicado com sucesso! +1 Ponto 🍌');
      navigate('/feed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao publicar o check-in.');
    } finally {
      setLoading(false);
    }
  };

  if (!photo) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-emerald-500/[0.03] rounded-full blur-[120px] pointer-events-none"></div>

      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-md z-10 relative">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-black tracking-tight">Novo Post</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full z-10 flex flex-col gap-6 animate-fade-in-up">
        <div className="w-full aspect-[4/5] bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
          <img src={photo} alt="Treino Capturado" className="w-full h-full object-cover" />
          
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Zap size={14} className="text-emerald-400" />
            <span className="text-xs font-black text-emerald-400 tracking-wider">TEMPO REAL (+1 PT)</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
          <div className={`p-2 rounded-full ${gpsData ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-0.5">Localização Detetada</p>
            <p className="text-sm font-bold text-white">
              {gpsData ? `Lat: ${gpsData.lat.toFixed(4)}, Lng: ${gpsData.lng.toFixed(4)}` : 'GPS Desativado/Não Permitido'}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <label className="text-xs font-bold text-white/70 ml-1 mb-2 uppercase tracking-wider">Legenda (Opcional)</label>
          <textarea 
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Como foi o treino de hoje, monstro?"
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all resize-none h-32"
          ></textarea>
        </div>
      </main>

      <div className="p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent z-10 pb-10">
        <button 
          onClick={handlePublish}
          disabled={loading}
          className="w-full max-w-md mx-auto bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl shadow-[0_10px_30px_rgba(234,179,8,0.2)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
          ) : (
            <>
              <Send size={20} />
              PUBLICAR CHECK-IN
            </>
          )}
        </button>
      </div>
    </div>
  );
}