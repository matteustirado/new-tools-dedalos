import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function CameraCapture() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gpsData, setGpsData] = useState(null);

  useEffect(() => {
    let stream = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        setHasPermission(true);
      } catch (err) {
        console.error("Erro na câmera:", err);
        toast.error('Permita o acesso à câmera para tirar a foto!');
      } finally {
        setIsLoading(false);
      }
    };

    const getGPS = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGpsData({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (err) => {
            console.warn("Erro GPS:", err);
            toast.warning('Não conseguimos obter sua localização exata.');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    };

    startCamera();
    getGPS();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const targetRatio = 4 / 5;
    const videoRatio = video.videoWidth / video.videoHeight;
    
    let cropWidth;
    let cropHeight;

    if (videoRatio > targetRatio) {
      cropHeight = video.videoHeight;
      cropWidth = cropHeight * targetRatio;
    } else {
      cropWidth = video.videoWidth;
      cropHeight = cropWidth / targetRatio;
    }
    
    const startX = (video.videoWidth - cropWidth) / 2;
    const startY = (video.videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    ctx.drawImage(
      video,
      startX, startY, cropWidth, cropHeight, 
      0, 0, cropWidth, cropHeight            
    );
    
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);

    navigate('/edit-post', { 
      state: { 
        photo: photoDataUrl, 
        location: gpsData 
      } 
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <div className="absolute top-6 left-6 z-10">
        <button 
          onClick={() => navigate(-1)} 
          className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="absolute top-6 right-6 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
        <MapPin size={14} className={gpsData ? "text-emerald-400" : "text-yellow-400 animate-pulse"} />
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">
          {gpsData ? 'GPS OK' : 'Buscando GPS...'}
        </span>
      </div>

      <div className="relative w-full h-full max-w-md bg-[#111] overflow-hidden flex items-center justify-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-white/50">
            <Loader2 size={32} className="animate-spin text-yellow-500" />
            <p className="text-sm font-bold uppercase tracking-widest">Abrindo lente...</p>
          </div>
        )}
        
        <div className="w-full aspect-[4/5] relative overflow-hidden bg-black flex items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`absolute min-w-full min-h-full object-cover ${!hasPermission ? 'hidden' : ''}`}
          />
        </div>
        
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-center pb-8">
        {hasPermission && (
          <button 
            onClick={handleCapture}
            className="w-20 h-20 rounded-full bg-transparent border-4 border-white flex items-center justify-center p-1 active:scale-95 transition-transform group"
          >
            <div className="w-full h-full bg-white rounded-full group-active:bg-yellow-400 transition-colors"></div>
          </button>
        )}
      </div>
    </div>
  );
}