import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, MapPin, Loader2, Activity, Users, RefreshCcw, Zap, ZapOff, Search } from 'lucide-react';
import { toast } from 'react-toastify';

export default function CameraCapture() {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gpsData, setGpsData] = useState(null);

  // 👈 Novos estados para os controles avançados da câmera
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (traseira) ou 'user' (frontal)
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [capabilities, setCapabilities] = useState({});

  const runData = location.state?.runData; 
  const isRunBackground = location.state?.isRunBackground;
  const isDuo = location.state?.isDuo || false;

  // Função para iniciar ou reiniciar a câmera com as configurações atuais
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    
    // Para a stream atual antes de iniciar uma nova (importante ao virar a câmera)
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode }, 
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Lê as capacidades do hardware da câmera ativa
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      setCapabilities(caps);

      // Restaura o estado do flash e do zoom para o padrão ao trocar de câmera
      setFlashOn(false);
      setZoom(caps.zoom?.min || 1);
      
      setHasPermission(true);
    } catch (err) {
      console.error(err);
      toast.error('Permita o acesso à câmera para tirar a foto!');
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();

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
            console.warn(err);
            toast.warning('Não conseguimos obter sua localização exata.');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    };
    getGPS();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]); // O startCamera é recriado (via useCallback) se o facingMode mudar

  // 👈 Função para aplicar Zoom e Flash diretamente no Hardware
  const applyVideoConstraints = async (newConstraints) => {
    if (videoRef.current && videoRef.current.srcObject) {
      const track = videoRef.current.srcObject.getVideoTracks()[0];
      try {
        await track.applyConstraints({ advanced: [newConstraints] });
      } catch (err) {
        console.warn("Hardware não suporta esta constraint:", newConstraints, err);
      }
    }
  };

  const handleToggleFacingMode = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleToggleFlash = () => {
    if (!capabilities.torch) {
      toast.info('Flash (Lanterna) não suportado nesta câmera.');
      return;
    }
    const newFlashState = !flashOn;
    setFlashOn(newFlashState);
    applyVideoConstraints({ torch: newFlashState });
  };

  const handleZoomChange = (e) => {
    const newZoom = Number(e.target.value);
    setZoom(newZoom);
    applyVideoConstraints({ zoom: newZoom });
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Desliga o flash na hora de capturar para poupar bateria
    if (flashOn) {
        applyVideoConstraints({ torch: false });
    }
    
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

    // Se estiver usando a câmera frontal, inverte a imagem no canvas horizontalmente (efeito espelho)
    if (facingMode === 'user') {
      ctx.translate(cropWidth, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(
      video,
      startX, startY, cropWidth, cropHeight, 
      0, 0, cropWidth, cropHeight            
    );
    
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const returnUrl = location.state?.returnTo;

    if (returnUrl && isRunBackground) {
      navigate(returnUrl, { 
        state: { 
          croppedImage: photoDataUrl, 
          runData: runData, 
          isRun: true
        },
        replace: true
      });
    } else {
      navigate('/edit-post', { 
        state: { 
          photo: photoDataUrl, 
          location: gpsData,
          isRealTime: true,
          isDuo: isDuo
        } 
      });
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
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black">
      
      {/* 👈 CONTROLES DO TOPO */}
      <div className="absolute top-6 left-0 right-0 z-30 flex justify-between px-6">
        <button 
          onClick={() => navigate(-1)} 
          className="rounded-full bg-black/40 p-3 text-white transition-colors hover:bg-white/20 backdrop-blur-md"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3">
          {/* Flash (só mostra se o hardware suportar) */}
          {capabilities.torch && (
             <button 
               onClick={handleToggleFlash}
               className={`rounded-full p-3 transition-colors backdrop-blur-md ${flashOn ? 'bg-yellow-500 text-black' : 'bg-black/40 text-white hover:bg-white/20'}`}
             >
               {flashOn ? <Zap size={24} /> : <ZapOff size={24} />}
             </button>
          )}

          {/* Virar Câmera */}
          <button 
            onClick={handleToggleFacingMode}
            className="rounded-full bg-black/40 p-3 text-white transition-colors hover:bg-white/20 backdrop-blur-md"
          >
            <RefreshCcw size={24} />
          </button>
        </div>
      </div>

      {/* Indicador de GPS */}
      <div className="absolute right-6 top-24 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md pointer-events-none">
        <MapPin size={14} className={gpsData ? "text-emerald-400" : "animate-pulse text-yellow-400"} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white">
          {gpsData ? 'GPS OK' : 'Buscando...'}
        </span>
      </div>

      {/* ÁREA DE VISUALIZAÇÃO (VIEWFINDER) */}
      <div className="relative flex h-full w-full max-w-md items-center justify-center overflow-hidden bg-[#111] z-10">
        {isLoading && (
          <div className="absolute z-20 flex flex-col items-center gap-3 text-white/50">
            <Loader2 size={32} className="animate-spin text-yellow-500" />
            <p className="text-sm font-bold uppercase tracking-widest">Abrindo lente...</p>
          </div>
        )}
        
        <div className="relative flex w-full aspect-[4/5] items-center justify-center overflow-hidden bg-black z-10">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`absolute h-full w-full object-cover transition-transform duration-500 ${!hasPermission ? 'hidden' : ''} ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />

          {isDuo && (
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-yellow-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.3)] z-30">
              <Users size={14} className="text-yellow-500" />
              <span className="text-xs font-black text-yellow-500 tracking-wider">TREINO EM DUPLA</span>
            </div>
          )}

          {isRunBackground && runData && (
            <div className="absolute inset-0 pointer-events-none z-30">
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
            </div>
          )}
        </div>
        
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* 👈 CONTROLES DA BASE */}
      <div className="absolute bottom-0 left-0 flex flex-col w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-8 pb-10 z-30 px-6">
        
        {/* Controle de Zoom Slider */}
        {capabilities.zoom && (
          <div className="flex items-center gap-4 mb-8 max-w-xs mx-auto w-full">
             <Search size={16} className="text-white/50" />
             <input 
                type="range" 
                min={capabilities.zoom.min || 1} 
                max={capabilities.zoom.max || 5} 
                step={capabilities.zoom.step || 0.1}
                value={zoom}
                onChange={handleZoomChange}
                className="w-full accent-yellow-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
             />
             <span className="text-xs font-bold text-white w-8 text-right">{zoom.toFixed(1)}x</span>
          </div>
        )}

        <div className="flex justify-center items-center h-20">
          {hasPermission && (
            <button 
              onClick={handleCapture}
              className={`group flex h-20 w-20 items-center justify-center rounded-full border-4 ${isDuo ? 'border-yellow-500' : 'border-white'} bg-transparent p-1 transition-transform active:scale-90`}
            >
              <div className={`h-full w-full rounded-full ${isDuo ? 'bg-yellow-500' : 'bg-white'} transition-colors group-active:bg-yellow-400`}></div>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}