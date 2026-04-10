import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Activity, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function StravaCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const processCallback = async () => {
      const queryParams = new URLSearchParams(location.search);
      const code = queryParams.get('code');
      const error = queryParams.get('error');

      if (error) {
        toast.error('Você negou a autorização do Strava.');
        navigate('/edit-profile');
        return;
      }

      if (!code) {
        navigate('/edit-profile');
        return;
      }

      const storedUser = localStorage.getItem('gym_user');
      if (!storedUser) {
        navigate('/login');
        return;
      }
      
      const user = JSON.parse(storedUser);

      try {
        await axios.post(`${API_URL}/api/gym/strava/callback`, { 
          code, 
          cpf: user.cpf 
        });

        const updatedUser = { ...user, has_strava: true };
        localStorage.setItem('gym_user', JSON.stringify(updatedUser));
        
        setStatus('success');
        
        setTimeout(() => {
          navigate('/edit-profile');
        }, 2000);

      } catch (err) {
        console.error(err);
        setStatus('error');
        toast.error('Falha ao validar a conexão com o Strava.');
        setTimeout(() => navigate('/edit-profile'), 2000);
      }
    };

    processCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-8 flex flex-col items-center text-center shadow-2xl animate-fade-in-up">
        
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#FC4C02]/10 border-2 border-[#FC4C02]/30 flex items-center justify-center mb-4 relative">
              <Activity size={32} className="text-[#FC4C02] absolute" />
              <Loader2 size={64} className="text-[#FC4C02] animate-spin opacity-50" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">Sincronizando...</h2>
            <p className="text-sm text-white/50">Conectando sua conta com o Banana's Gym. Quase lá!</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">Conectado!</h2>
            <p className="text-sm text-white/50">Strava vinculado com sucesso. Retornando ao perfil...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-xl font-black text-red-500 mb-2">Erro na Conexão</h2>
            <p className="text-sm text-white/50">Redirecionando de volta...</p>
          </>
        )}

      </div>
    </div>
  );
}