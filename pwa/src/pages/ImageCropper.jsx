import React, { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { ChevronLeft, Crop, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ImageCropper() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const rawImage = location.state?.photo;
  const gpsData = location.state?.location;
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!rawImage) {
    navigate('/feed');
    return null;
  }

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

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
      
      const returnUrl = location.state?.returnTo;

      if (returnUrl) {
        navigate(returnUrl, { 
          state: { croppedImage: croppedImageBase64 },
          replace: true
        });
      } else {
        navigate('/edit-post', { 
          state: { 
            photo: croppedImageBase64, 
            location: gpsData, 
            isUpload: true 
          },
          replace: true
        });
      }
      
    } catch (e) {
      toast.error('Erro ao processar imagem.');
      console.error(e);
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-lg font-black tracking-tight">Recortar Foto (4:5)</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 relative bg-[#050505] z-10">
        <Cropper
          image={rawImage}
          crop={crop}
          zoom={zoom}
          aspect={4 / 5}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          theme={{
            containerClassName: 'bg-[#050505]',
            mediaClassName: '',
            cropAreaClassName: 'border-2 border-yellow-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]'
          }}
        />
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