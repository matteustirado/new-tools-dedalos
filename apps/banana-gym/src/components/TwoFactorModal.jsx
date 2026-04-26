import React, { useState, useEffect } from 'react';
import { X, QrCode, Lock, Key, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function TwoFactorModal({ user, onClose, onSuccess }) {
  const [twoFAStep, setTwoFAStep] = useState(() => parseInt(sessionStorage.getItem('2fa_step')) || 1);
  const [qrCodeUrl, setQrCodeUrl] = useState(() => sessionStorage.getItem('2fa_qr') || '');
  const [secretKey, setSecretKey] = useState(() => sessionStorage.getItem('2fa_secret') || '');
  
  const [twoFACode, setTwoFACode] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [dummyRecoveryKeys] = useState(['A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2', 'M3N4-O5P6', 'Q7R8-S9T0', 'U1V2-W3X4']);
  
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const changeStep = (step) => {
    setTwoFAStep(step);
    sessionStorage.setItem('2fa_step', step);
  };

  useEffect(() => {
    const fetch2FAData = async () => {
      try {
        const res = await api.post('/api/gym/generate-2fa', { cpf: user.cpf });
        setQrCodeUrl(res.data.qrCode);
        setSecretKey(res.data.secret);
        
        sessionStorage.setItem('2fa_qr', res.data.qrCode);
        sessionStorage.setItem('2fa_secret', res.data.secret);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao gerar configuração do A2F.");
        onClose();
      }
    };
    
    if (twoFAStep === 1 && !secretKey) {
      fetch2FAData();
    }
  }, [twoFAStep, secretKey, user.cpf, onClose]);

  useEffect(() => {
    let timer;
    if (twoFAStep === 3 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (twoFAStep === 3 && countdown === 0) {
      onSuccess();
    }
    return () => clearInterval(timer);
  }, [twoFAStep, countdown, onSuccess]);

  const verifyAndEnable = async (code) => {
    if (code.length !== 6) return;
    
    setLoading(true);
    try {
      await api.post('/api/gym/verify-enable-2fa', { 
        cpf: user.cpf, 
        token: code 
      });
      changeStep(3);
    } catch (err) {
      console.error(err);
      toast.error("Código inválido. Tente novamente.");
      setTwoFACode('');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (secretKey) {
      navigator.clipboard.writeText(secretKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-black/90 backdrop-blur-sm pt-20 px-4 animate-fade-in-down" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X size={24} />
        </button>
        
        {twoFAStep === 1 && (
          <div className="animate-fade-in text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 mx-auto border border-emerald-500/20">
              <QrCode size={24} />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Configure o Autenticador</h2>
            <p className="text-sm text-white/60 mb-6">Escaneie o QR Code com seu Google Authenticator ou Authy.</p>
            
            <div className="w-48 h-48 bg-white p-2 rounded-xl mx-auto mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code 2FA" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center border-4 border-dashed border-black/20 text-black/50">
                  <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                </div>
              )}
            </div>

            <p className="text-xs text-white/50 mb-1">Ou copie a chave secreta:</p>
            <button 
              onClick={handleCopySecret}
              className="w-full bg-black border border-white/10 hover:bg-white/5 transition-colors rounded-lg py-3 px-4 mb-6 flex items-center justify-center gap-2 group"
            >
              <span className="font-mono text-emerald-400 tracking-widest text-sm truncate max-w-[200px]">
                {secretKey || 'Carregando...'}
              </span>
              {copied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} className="text-white/40 group-hover:text-white" />}
            </button>

            <button 
              onClick={() => changeStep(2)} 
              disabled={!secretKey}
              className="w-full bg-emerald-500 text-black font-black py-3.5 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              Já escaneei, Avançar
            </button>
          </div>
        )}

        {twoFAStep === 2 && (
          <div className="animate-fade-in text-center">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mb-4 mx-auto border border-yellow-500/20">
              <Lock size={24} />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Código de Verificação</h2>
            <p className="text-sm text-white/60 mb-6">Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.</p>
            
            <input 
              type="tel" 
              maxLength={6}
              value={twoFACode}
              disabled={loading}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setTwoFACode(val);
                if (val.length === 6) {
                  verifyAndEnable(val);
                }
              }}
              placeholder="000000"
              className="w-full bg-black border border-white/10 rounded-xl py-4 px-4 text-white text-center text-2xl tracking-[0.5em] focus:border-yellow-500 outline-none transition-colors mb-4 font-mono disabled:opacity-50"
            />

            {loading && (
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {twoFAStep === 3 && (
          <div className="animate-fade-in text-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mb-4 mx-auto border border-blue-500/20">
              <Key size={24} />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Chaves de Recuperação</h2>
            <p className="text-xs text-white/60 mb-4 bg-red-500/10 border border-red-500/30 p-2 rounded-lg text-red-300">
              Tire um print ou anote! Sem estas chaves e sem o App, você perderá o acesso à conta permanentemente.
            </p>
            
            <div className="grid grid-cols-2 gap-2 mb-6">
              {dummyRecoveryKeys.map((key, i) => (
                <div key={i} className="bg-black border border-white/10 py-2 rounded font-mono text-xs text-blue-400">
                  {key}
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-white/50 mb-2">Fechando e ativando em...</span>
              <div className="w-12 h-12 rounded-full border-4 border-blue-500 flex items-center justify-center text-xl font-black text-blue-500">
                {countdown}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}