import React, { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { ChevronLeft, Crop, Loader2, Activity, Users, Flame } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ImageCropper() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const rawImage = location.state?.photo || location.state?.image;
  const gpsData = location.state?.location;
  const runData = location.state?.runData; 
  const isRunBackground = location.state?.isRunBackground;
  
  const isDuo = location.state?.isDuo || false;
  const socialInvite = location.state?.socialInvite || null;
  const returnToUrl = location.state?.returnTo;
  const isProfilePhoto = returnToUrl === '/edit-profile';

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback((croppedArea, currentCroppedAreaPixels) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  if (!rawImage) {
    navigate('/feed');
    return null;
  }

  const createCropPreview = async (imageSrc, pixelCrop) => {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', (error) => reject(error));
      img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleConfirmCrop = async () => {
    if (!croppedAreaPixels) return;
    
    setLoading(true);
    try {
      const croppedImageBase64 = await createCropPreview(rawImage, croppedAreaPixels);
      const locationToSend = gpsData === 'error' ? null : gpsData;

      if (returnToUrl) {
        navigate(returnToUrl, { 
          state: { 
             croppedImage: croppedImageBase64,
             runData: runData,
             isRun: isRunBackground
          },
          replace: true
        });
      } else {
        navigate('/edit-post', { 
          state: { 
            photo: croppedImageBase64, 
            location: locationToSend, 
            isUpload: true,
            isRealTime: false,
            isDuo: isDuo,
            socialInvite: socialInvite 
          },
          replace: true
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao recortar imagem.');
    } finally {
      setLoading(false);
    }
  };

  const formatPace = (seconds, meters) => {
    if (!seconds || !meters) return '0:00 /km';
    const minsPerKm = (seconds / 60) / (meters / 1000);
    const mins = Math.floor(minsPerKm);
    const secs = Math.floor((minsPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0m 0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-md z-50 relative">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-black tracking-tight">Recortar Foto</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 relative bg-[#050505] z-10 flex items-center justify-center overflow-hidden">
        <Cropper
          image={rawImage}
          crop={crop}
          zoom={zoom}
          aspect={isProfilePhoto ? 1 : 4 / 5}
          cropShape={isProfilePhoto ? "round" : "rect"}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          theme={{
            containerClassName: 'bg-[#050505]',
            mediaClassName: '',
            cropAreaClassName: `border-2 border-yellow-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.8)] relative`
          }}
        />

        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className={`relative w-full ${isProfilePhoto ? 'max-w-xs aspect-square' : 'max-w-sm aspect-[4/5]'} max-h-full`}>
              
              {(isDuo || socialInvite) && (
                <div className={`absolute top-4 left-4 bg-black/60 backdrop-blur-md border px-3 py-1.5 rounded-full flex items-center gap-2 z-30 ${socialInvite ? 'border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.3)]'}`}>
                  {socialInvite ? <Flame size={14} className="text-orange-500" /> : <Users size={14} className="text-yellow-500" />}
                  <span className={`text-xs font-black tracking-wider ${socialInvite ? 'text-orange-500' : 'text-yellow-500'}`}>
                    {socialInvite ? 'REGISTRO DO ROLÊ' : 'TREINO EM DUPLA'}
                  </span>
                </div>
              )}

              {isRunBackground && runData && (
                <>
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-[#FC4C02]/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(252,76,2,0.3)]">
                    <Activity size={14} className="text-[#FC4C02]" />
                    <span className="text-xs font-black text-[#FC4C02] tracking-wider">STRAVA</span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                    <div>
                      <div className="text-white/80 font-bold text-xs uppercase tracking-widest mb-1 drop-shadow-md">Distância</div>
                      <div className="text-[#FC4C02] font-black text-5xl leading-none drop-shadow-lg">
                        {(runData.distance / 1000).toFixed(2)}<span className="text-xl text-[#FC4C02]/70 ml-1">km</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col gap-2">
                      <div>
                        <div className="text-white/70 font-bold text-[10px] uppercase tracking-wider drop-shadow-md">Tempo</div>
                        <div className="text-white font-black text-lg leading-none drop-shadow-lg">{formatTime(runData.moving_time)}</div>
                      </div>
                      <div>
                        <div className="text-white/70 font-bold text-[10px] uppercase tracking-wider drop-shadow-md">Pace Médio</div>
                        <div className="text-white font-black text-lg leading-none drop-shadow-lg">{formatPace(runData.moving_time, runData.distance)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
        </div>
      </main>

      <div className="p-6 bg-gradient-to-t from-black via-black to-transparent z-50 relative pb-10">
        <div className="flex items-center gap-4 mb-6 bg-white/5 p-4 rounded-full border border-white/10">
          <span className="text-xs font-bold text-white/60">Zoom:</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(e.target.value)}
            className="flex-1 accent-yellow-500 h-1"
          />
        </div>

        <button
          onClick={handleConfirmCrop}
          disabled={loading}
          className="w-full max-w-md mx-auto bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl shadow-[0_10px_30px_rgba(234,179,8,0.2)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Crop size={20} />
              CONFIRMAR RECORTE
            </>
          )}
        </button>
      </div>
    </div>
  );
}