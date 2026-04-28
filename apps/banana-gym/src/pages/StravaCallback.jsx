import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function StravaCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('loading');
  
  const processedCode = useRef(null);

  useEffect(() => {
    const processCallback = async () => {
      const queryParams = new URLSearchParams(location.search);
      const code = queryParams.get('code');
      const state = queryParams.get('state');
      const error = queryParams.get('error');

      if (error) {
        toast.warning('Conexão cancelada pelo usuário.');
        navigate('/edit-profile');
        return;
      }

      if (!code || !state) {
        navigate('/edit-profile');
        return;
      }

      if (processedCode.current === code) {
        return;
      }
      
      processedCode.current = code;

      const storedUser = localStorage.getItem('gym_user');
      if (!storedUser) {
        navigate('/login');
        return;
      }
      
      const user = JSON.parse(storedUser);

      try {
        await api.post('/api/gym/strava/callback', { 
          code,
          state,
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
        toast.error('Falha de conexão com os servidores do Strava.');
        setTimeout(() => navigate('/edit-profile'), 2500);
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
            <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mb-4">
              <XCircle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">Falha na Conexão</h2>
            <p className="text-sm text-white/50">Não conseguimos vincular o Strava no momento. Retornando...</p>
          </>
        )}
      </div>
    </div>
  );
}