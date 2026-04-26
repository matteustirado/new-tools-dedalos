import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Share, Image as ImageIcon, Loader2, Zap, Flame, Trophy } from 'lucide-react';
import { toast } from 'react-toastify';
import { toPng } from 'html-to-image'; 

import BananasIcon from './BananasIcon';
import { SHARE_PROFILE_PHRASES } from '../constants/phrases';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const getBase64ImageFromUrl = async (imageUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      console.error("Falha ao pré-carregar imagem via Canvas. Usando fallback.");
      resolve(null);
    };
    img.src = imageUrl;
  });
};

export default function ShareProfile({ isOpen, onClose, profileData }) {
  const offscreenRef = useRef(null);
  const profilePicCacheRef = useRef(null);

  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [format, setFormat] = useState('feed'); 
  const [isGenerating, setIsGenerating] = useState(true);
  const [loadingText, setLoadingText] = useState('Preparando estúdio...');
  const [randomPhrase, setRandomPhrase] = useState('');
  const [translateY, setTranslateY] = useState('translate-y-full');

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setTranslateY('translate-y-0'), 10);
      setRandomPhrase(prev => prev || SHARE_PROFILE_PHRASES[Math.floor(Math.random() * SHARE_PROFILE_PHRASES.length)]);
    } else {
      setTranslateY('translate-y-full');
      setRandomPhrase('');
      profilePicCacheRef.current = null; 
      setFormat('feed'); 
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !randomPhrase) return;

    const generateCard = async () => {
      setIsGenerating(true);
      setGeneratedImageUrl(null);
      setGeneratedBlob(null);

      const targetWidth = 1080;
      const targetHeight = format === 'story' ? 1920 : 1350;

      try {
        if (!profilePicCacheRef.current && profileData.foto_perfil) {
          setLoadingText('Baixando a foto...');
          const url = `${API_URL}${profileData.foto_perfil}`;
          profilePicCacheRef.current = await getBase64ImageFromUrl(url);
        }

        setLoadingText(format === 'story' ? 'Pintando Story...' : 'Pintando Post...');
        await new Promise(res => setTimeout(res, 500)); 

        if (!offscreenRef.current) return;

        await toPng(offscreenRef.current, {
          width: targetWidth, height: targetHeight, pixelRatio: 1, style: { transform: 'scale(1)', margin: '0' }
        });

        const dataUrl = await toPng(offscreenRef.current, {
          backgroundColor: '#050505',
          width: targetWidth, height: targetHeight, pixelRatio: 1, 
          style: { transform: 'scale(1)', margin: '0' }
        });

        if (!dataUrl) throw new Error("Falha na renderização");

        setGeneratedImageUrl(dataUrl);
        
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        setGeneratedBlob(blob);

      } catch (error) {
        console.error("Erro ao gerar card:", error);
        toast.error("Ocorreu um erro ao montar a imagem.");
      } finally {
        setIsGenerating(false);
      }
    };

    generateCard();
  }, [isOpen, profileData, format, randomPhrase]);

  const handleClose = () => {
    setTranslateY('translate-y-full');
    setTimeout(onClose, 300);
  };

  if (!isOpen && translateY === 'translate-y-full') return null;

  const handleShareLink = () => {
    const url = `${window.location.origin}/${profileData.username}`;
    const shareText = SHARE_PROFILE_PHRASES[Math.floor(Math.random() * SHARE_PROFILE_PHRASES.length)];
    
    if (navigator.share) {
      navigator.share({ title: "Banana's Gym", text: shareText, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareText} ${url}`);
      toast.success('Link copiado!');
    }
  };

  const handleShareImage = async () => {
    if (!generatedBlob) return;
    const file = new File([generatedBlob], `bananas-gym-${profileData.username}-${format}.png`, { type: 'image/png' });
    const shareText = SHARE_PROFILE_PHRASES[Math.floor(Math.random() * SHARE_PROFILE_PHRASES.length)];
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Banana's Gym", text: shareText });
      } catch (err) { if (err.name !== 'AbortError') console.error(err); }
    } else {
      const objectUrl = URL.createObjectURL(generatedBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `bananas-gym-${profileData.username}-${format}.png`;
      link.click();
      toast.success('Card salvo na galeria! 📸');
    }
  };

  return createPortal(
    <>
      <div style={{ position: 'fixed', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div 
          ref={offscreenRef}
          style={{
            width: '1080px', 
            height: format === 'story' ? '1920px' : '1350px', 
            backgroundColor: '#050505',
            padding: format === 'story' ? '100px 70px' : '70px',
            boxSizing: 'border-box',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}
        >
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(180deg, #1a1a1a 0%, #050505 100%)',
            border: '16px solid #eab308', borderRadius: '70px',
            display: 'flex', flexDirection: 'column', 
            justifyContent: format === 'story' ? 'space-evenly' : 'space-between',
            alignItems: 'center', 
            padding: format === 'story' ? '80px 50px' : '50px', 
            boxSizing: 'border-box',
            boxShadow: '0 0 100px rgba(234, 179, 8, 0.2)', position: 'relative', overflow: 'hidden'
          }}>
            
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '100%', height: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BananasIcon type="filled" size={56} />
                </div>
                <span style={{ fontSize: '36px', fontWeight: '900', color: 'white', letterSpacing: '-1px' }}>Banana's Gym</span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: '900', color: 'rgba(255,255,255,0.7)', border: '4px solid rgba(255,255,255,0.1)', padding: '10px 24px', borderRadius: '30px', letterSpacing: '4px' }}>ATLETA</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 10, width: '100%' }}>
              <div style={{ width: '300px', height: '300px', borderRadius: '100px', backgroundColor: '#000', border: '12px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {profilePicCacheRef.current ? (
                  <img src={profilePicCacheRef.current} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Perfil" />
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '120px', fontWeight: '900' }}>{profileData.username?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              
              <div style={{ textAlign: 'center', width: '100%' }}>
                <h2 style={{ color: 'white', fontSize: '56px', fontWeight: '900', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '-2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profileData.nome}
                </h2>
                <p style={{ color: '#eab308', fontSize: '28px', fontWeight: 'bold', margin: '0' }}>
                  @{profileData.username}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: format === 'story' ? '40px' : '24px', zIndex: 10, width: '100%' }}>
              
              <div style={{ display: 'flex', width: '100%', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '40px', padding: '30px 0', border: '4px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '4px solid rgba(255,255,255,0.1)' }}>
                  <Trophy size={42} color="#eab308" style={{ marginBottom: '12px' }} />
                  <span style={{ color: 'white', fontSize: '56px', fontWeight: '900', lineHeight: '1' }}>{profileData.posicao}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', fontWeight: 'bold', letterSpacing: '6px', marginTop: '10px' }}>RANKING</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Flame size={42} color="#f97316" style={{ marginBottom: '12px' }} />
                  <span style={{ color: 'white', fontSize: '56px', fontWeight: '900', lineHeight: '1' }}>{profileData.totalPosts}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', fontWeight: 'bold', letterSpacing: '6px', marginTop: '10px' }}>TREINOS</span>
                </div>
              </div>

              <div style={{ width: '100%', backgroundColor: '#eab308', borderRadius: '30px', padding: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', boxSizing: 'border-box' }}>
                <Zap size={32} color="black" fill="black" />
                <span style={{ color: 'black', fontSize: '24px', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center', lineHeight: '1.2' }}>
                  {randomPhrase}
                </span>
              </div>
              
            </div>
          </div>
        </div>
      </div>

      <div 
        className="fixed inset-0 z-[400] flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300" 
        onClick={handleClose}
      >
        <div 
          className={`bg-[#111] rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 border-t border-white/10 transition-transform duration-300 ease-out shadow-2xl ${translateY}`} 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-white">Compartilhar Perfil</h3>
            <button onClick={handleClose} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex bg-black/50 p-1.5 rounded-2xl mb-6 border border-white/5 relative">
            <button 
              onClick={() => setFormat('feed')}
              className={`flex-1 py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 z-10 ${format === 'feed' ? 'text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              Feed (4:5)
            </button>
            <button 
              onClick={() => setFormat('story')}
              className={`flex-1 py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 z-10 ${format === 'story' ? 'text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              Stories (9:16)
            </button>
            <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-yellow-500 rounded-xl transition-all duration-300 ease-out ${format === 'story' ? 'translate-x-[calc(100%+6px)]' : 'translate-x-0'}`} />
          </div>

          <div className={`w-full flex justify-center transition-all duration-300 ${format === 'story' ? 'mb-6' : 'mb-8'}`}>
            <div className={`relative overflow-hidden shadow-2xl flex items-center justify-center border border-white/10 rounded-3xl transition-all duration-500 bg-[#050505] ${
              format === 'story' ? 'w-[200px] aspect-[9/16]' : 'w-[260px] aspect-[4/5]'
            }`}>
              {isGenerating ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 size={36} className="animate-spin text-yellow-500" />
                  <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{loadingText}</span>
                </div>
              ) : (
                <img src={generatedImageUrl} alt="Pré-visualização" className="w-full h-full object-contain animate-fade-in" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleShareImage} 
              disabled={isGenerating} 
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              <ImageIcon size={20} /> {isGenerating ? 'AGUARDE...' : `COMPARTILHAR ${format === 'story' ? 'STORIES' : 'CARD'}`}
            </button>
            <button 
              onClick={handleShareLink} 
              className="w-full bg-white/5 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
            >
              <Share size={18} className="text-white/40" /> Copiar Link do Perfil
            </button>
          </div>

        </div>
      </div>
    </>,
    document.body
  );
}