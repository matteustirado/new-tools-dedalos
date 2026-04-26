import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronLeft, MapPin, Zap, Send, Navigation, Save, 
  Image as ImageIcon, Globe, EyeOff, Loader2, Activity, 
  Camera, X, Users, Search, CheckCircle2 
} from 'lucide-react';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Polyline as LeafletPolyline } from 'react-leaflet';
import polyline from '@mapbox/polyline';
import 'leaflet/dist/leaflet.css';

import api from '../services/api';
import { usePost } from '../contexts/PostContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const INVITE_DICTIONARY = {
  'park': 'Passeio no parque',
  'lunch': 'Almoço especial',
  'dinner': 'Jantar de negócios',
  'bike': 'Pedalada ao ar livre',
  'gym': 'Academia do prédio',
  'bananada': 'Bananada'
};

const MAX_LOCATION_CHARS = 50;
const MAX_CAPTION_CHARS = 2200;

export default function EditPost() {
  const navigate = useNavigate();
  const location = useLocation();
  const runFileInputRef = useRef(null);
  
  const { uploadPost } = usePost();

  const [user, setUser] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [academiaNome, setAcademiaNome] = useState('');
  const [isArchived, setIsArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [showPhotoChoiceModal, setShowPhotoChoiceModal] = useState(false);

  const capturedData = location.state || {};
  const photo = capturedData.photo || null;
  const isUpload = capturedData.isUpload || false;
  const isRealTime = capturedData.isRealTime || false;
  
  const existingPost = capturedData.post || null; 
  const isEditing = !!existingPost;
  
  const isRun = isEditing ? existingPost.activity_type === 'RUN' : (capturedData.isRun || false);
  const runData = isEditing ? null : (capturedData.runData || null);
  const [runBackgroundImage, setRunBackgroundImage] = useState(capturedData.croppedImage || null); 

  const isDuo = capturedData.isDuo || false;
  const socialInvite = capturedData.socialInvite || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [taggedUser, setTaggedUser] = useState(null); 

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

    const tempMsg = sessionStorage.getItem('temp_post_mensagem');
    const tempAc = sessionStorage.getItem('temp_post_academia');
    
    if (tempMsg) { 
      setMensagem(tempMsg); 
      sessionStorage.removeItem('temp_post_mensagem'); 
    }
    
    if (tempAc) { 
      setAcademiaNome(tempAc); 
      sessionStorage.removeItem('temp_post_academia'); 
    }

    if (isEditing) {
      if (!tempMsg) setMensagem(existingPost.mensagem || '');
      if (!tempAc) setAcademiaNome(existingPost.unidade || '');
      setIsArchived(existingPost.arquivado === 1);
    } else if (!photo && !isRun && !runBackgroundImage) {
      navigate('/feed');
    }
    
    if (isRun && runData && !isEditing && !tempMsg && !tempAc) {
      setAcademiaNome('Corrida Outdoor - Strava');
      setMensagem(`Treino finalizado: ${runData.name} 🏃‍♂️💨`);
    }

    if (socialInvite && !isEditing) {
      setTaggedUser({
        cpf: socialInvite.amigo_cpf,
        nome: socialInvite.amigo_nome,
        username: socialInvite.amigo_username || socialInvite.amigo_nome.split(' ')[0].toLowerCase(), 
        foto_perfil: socialInvite.amigo_foto
      });
      
      if (!tempMsg) {
         const tipoRole = INVITE_DICTIONARY[socialInvite.invite_type] || 'Evento';
         setMensagem(`Registro do encontro: ${tipoRole} com @${socialInvite.amigo_username || socialInvite.amigo_nome.split(' ')[0].toLowerCase()} 📸`);
      }
    }

  }, [navigate, photo, isEditing, existingPost, isRun, runData, runBackgroundImage, socialInvite]);

  useEffect(() => {
    if (!isEditing && !localGpsData && !isLocating && !isRun) {
      handleGetLocation();
    }
  }, [isRun, isEditing, localGpsData, isLocating]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2 && !socialInvite) {
        setIsSearching(true);
        try {
          const res = await api.get(`/api/gym/users/search?q=${searchQuery}`);
          const filteredResults = res.data.filter(u => u.cpf !== user?.cpf);
          setSearchResults(filteredResults);
        } catch (err) {
          console.error("Erro ao buscar usuários", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        searchResults.length > 0 && setSearchResults([]);
      }
    }, 500); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user, socialInvite, searchResults.length]);

  const handleSelectUser = (selectedUser) => {
    setTaggedUser(selectedUser);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveTaggedUser = () => {
    if (!socialInvite) {
      setTaggedUser(null);
    } else {
      toast.info("A marcação é obrigatória para registrar este convite!");
    }
  };

  const handleGetLocation = () => {
    setIsLocating(true);
    
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada.');
      setIsLocating(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocalGpsData({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const dataURLtoFile = async (dataurl, filename) => {
    const res = await fetch(dataurl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
  };

  const navigateToCapture = (destination) => {
    sessionStorage.setItem('temp_post_mensagem', mensagem);
    sessionStorage.setItem('temp_post_academia', academiaNome);
    
    navigate(destination, { 
      state: { 
        runData: runData, 
        returnTo: '/edit-post',
        isRunBackground: true 
      } 
    });
  };

  const handleOpenGallery = () => {
    setShowPhotoChoiceModal(false);
    runFileInputRef.current?.click();
  };

  const handleRunBackgroundChange = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas imagens.');
      return;
    }
    
    sessionStorage.setItem('temp_post_mensagem', mensagem);
    sessionStorage.setItem('temp_post_academia', academiaNome);
    
    const reader = new FileReader();
    
    reader.onloadend = () => {
      navigate('/crop', { 
        state: { 
          photo: reader.result, 
          runData: runData, 
          returnTo: '/edit-post',
          isRunBackground: true 
        } 
      });
    };
    
    reader.readAsDataURL(file);
  };

  const handleAction = async () => {
    if (!user) return;
    
    if (!academiaNome.trim()) { 
      toast.warning('Informe o local da foto!'); 
      return; 
    }
    
    if (!isEditing && !localGpsData && !isRun) { 
      toast.error('A localização GPS é obrigatória!'); 
      return; 
    }
    
    if ((isDuo || socialInvite) && !taggedUser && !isEditing) {
      toast.warning('Você precisa marcar alguém neste post!');
      return;
    }

    setLoading(true);

    if (isEditing) {
      try {
        await api.put(`/api/gym/post/${existingPost.id}/edit`, {
          colaborador_cpf: user.cpf, 
          mensagem, 
          academia_digitada: academiaNome
        });
        
        const wasArchived = existingPost.arquivado === 1;
        
        if (isArchived !== wasArchived) {
          const endpoint = isArchived ? 'archive' : 'unarchive';
          await api.put(`/api/gym/post/${existingPost.id}/${endpoint}`, { colaborador_cpf: user.cpf });
        }
        
        setShowSuccessScreen(true);
        setTimeout(() => navigate(-1), 1500); 

      } catch (err) { 
        console.error(err);
        toast.error('Erro ao atualizar.'); 
        setLoading(false);
      }
    } else {
      try {
        const formData = new FormData();
        formData.append('colaborador_cpf', user.cpf);
        formData.append('mensagem', mensagem);
        formData.append('academia_digitada', academiaNome);
        
        if (taggedUser) {
          formData.append('tagged_cpf', taggedUser.cpf || socialInvite?.amigo_username); 
        }

        if (isRun) {
          formData.append('is_run', 'true');
          formData.append('pontos', '0.5');
          formData.append('strava_activity_id', runData.id);
          formData.append('run_distance_km', (runData.distance / 1000).toFixed(2));
          formData.append('run_duration_seconds', runData.moving_time);
          formData.append('run_timestamp', runData.start_date_local);
          formData.append('run_polyline', runData.map?.summary_polyline || '');
          
          if (runBackgroundImage) {
            formData.append('foto_treino', await dataURLtoFile(runBackgroundImage, 'run_background.jpg'));
          }
        } else {
          formData.append('foto_treino', await dataURLtoFile(photo, 'treino.jpg'));
          
          if (socialInvite) {
            formData.append('pontos', '0');
            formData.append('is_real_time', 'false');
            
            const finalActivity = socialInvite.invite_type ? `SOCIAL_${socialInvite.invite_type}` : 'SOCIAL';
            formData.append('activity_type', finalActivity);
            formData.append('social_invite_id', socialInvite.post_id); 
          } else {
            formData.append('pontos', isUpload ? '0.5' : '1');
            formData.append('is_real_time', isRealTime);
            formData.append('activity_type', 'PHOTO');
          }
          
          if (localGpsData) {
            formData.append('latitude', localGpsData.lat);
            formData.append('longitude', localGpsData.lng);
          }
        }

        uploadPost(formData, isArchived);

        setShowSuccessScreen(true);
        setTimeout(() => isArchived ? navigate(`/${user.username}`) : navigate('/feed'), 1500);
        
      } catch (err) {
        console.error(err);
        toast.error('Erro ao processar imagem para envio.');
        setLoading(false);
      }
    }
  };

  if (!photo && !isEditing && !isRun && !runBackgroundImage) return null;

  let decodedPositions = [];
  let mapBounds = null;
  const polylineString = isEditing ? existingPost.run_polyline : runData?.map?.summary_polyline;
  const finalBackgroundImage = isEditing && existingPost.foto_treino_url ? `${API_URL}${existingPost.foto_treino_url}` : runBackgroundImage;

  if (isRun && polylineString && !finalBackgroundImage) {
    decodedPositions = polyline.decode(polylineString);
    if (decodedPositions.length > 0) {
      const lats = decodedPositions.map(p => p[0]);
      const lngs = decodedPositions.map(p => p[1]);
      mapBounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ];
    }
  }

  const formatPace = (seconds, meters) => {
    const minsPerKm = (seconds / 60) / (meters / 1000);
    const mins = Math.floor(minsPerKm);
    const secs = Math.floor((minsPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden animate-page-transition">
      <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[50%] bg-emerald-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <header className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-md z-10 relative">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-black tracking-tight">{isEditing ? 'Editar Post' : 'Novo Post'}</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full z-10 flex flex-col gap-6 animate-fade-in-up pb-8">
        
        <div className="flex flex-col gap-3">
          <div className="w-full aspect-[4/5] bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group pointer-events-none">
            {isRun ? (
              <div className="w-full h-full relative bg-[#111]">
                {finalBackgroundImage ? (
                  <img src={finalBackgroundImage} alt="Fundo da Corrida" className="w-full h-full object-cover" />
                ) : (
                  mapBounds && (
                    <MapContainer bounds={mapBounds} zoomControl={false} scrollWheelZoom={false} dragging={false} className="w-full h-full z-0">
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" />
                      <LeafletPolyline positions={decodedPositions} color="#FC4C02" weight={5} opacity={0.9} />
                    </MapContainer>
                  )
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 z-10" />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-[#FC4C02]/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(252,76,2,0.3)] z-20">
                  <Activity size={14} className="text-[#FC4C02]" />
                  <span className="text-xs font-black text-[#FC4C02] tracking-wider">STRAVA (+0.5 PT)</span>
                </div>
                <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-end">
                  <div>
                    <div className="text-white/80 font-bold text-xs uppercase tracking-widest mb-1 drop-shadow-md">Distância</div>
                    <div className="text-[#FC4C02] font-black text-5xl leading-none drop-shadow-lg">
                      {isEditing ? existingPost.run_distance_km : (runData.distance / 1000).toFixed(2)}<span className="text-xl text-[#FC4C02]/70 ml-1">km</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col gap-2">
                    <div>
                      <div className="text-white/70 font-bold text-[10px] uppercase tracking-wider drop-shadow-md">Tempo</div>
                      <div className="text-white font-black text-lg leading-none drop-shadow-lg">
                        {formatTime(isEditing ? existingPost.run_duration_seconds : runData.moving_time)}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/70 font-bold text-[10px] uppercase tracking-wider drop-shadow-md">Pace Médio</div>
                      <div className="text-white font-black text-lg leading-none drop-shadow-lg">
                        {formatPace(isEditing ? existingPost.run_duration_seconds : runData.moving_time, isEditing ? (existingPost.run_distance_km * 1000) : runData.distance)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <img src={isEditing ? `${API_URL}${existingPost.foto_treino_url}` : photo} alt="Treino" className={`w-full h-full object-cover transition-all duration-500 ${isArchived ? 'grayscale opacity-70' : ''}`} />
                
                {!isEditing && (
                  <>
                    {(isDuo || socialInvite) && (
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-yellow-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        <Users size={14} className="text-yellow-500" />
                        <span className="text-xs font-black tracking-wider uppercase text-yellow-500">
                          {socialInvite ? 'NOVO POST' : 'DUPLA (+2 PTS)'}
                        </span>
                      </div>
                    )}

                    {!isDuo && !socialInvite && isUpload ? (
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-yellow-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        <ImageIcon size={14} className="text-yellow-400" />
                        <span className="text-xs font-black text-yellow-400 tracking-wider">GALERIA (+0.5 PT)</span>
                      </div>
                    ) : !isDuo && !socialInvite && !isUpload ? (
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <Zap size={14} className="text-emerald-400" />
                        <span className="text-xs font-black text-emerald-400 tracking-wider">TEMPO REAL (+1 PT)</span>
                      </div>
                    ) : null}

                    <div className={`absolute bottom-4 left-4 bg-black/70 backdrop-blur-md border ${localGpsData ? 'border-emerald-500/40' : 'border-red-500/40'} px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg transition-all`}>
                      {isLocating ? <Loader2 size={12} className="text-red-400 animate-spin" /> : <Navigation size={12} className={localGpsData ? 'text-emerald-400' : 'text-red-400'} />}
                      {localGpsData ? (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">GPS OK</span>
                      ) : (
                        <button onClick={handleGetLocation} disabled={isLocating} className="text-[10px] font-bold text-red-400 uppercase tracking-wider disabled:opacity-50 pointer-events-auto">
                          {isLocating ? 'Buscando GPS...' : 'Sem GPS'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
            
            {isArchived && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex flex-col items-center gap-2 pointer-events-none z-30">
                <EyeOff size={24} className="text-white/50" />
                <span className="text-xs font-black text-white/70 uppercase tracking-widest">Privado</span>
              </div>
            )}
          </div>

          {isRun && !isEditing && (
            <div className="flex justify-end px-1">
              <button 
                type="button" 
                onClick={() => runBackgroundImage ? setRunBackgroundImage(null) : setShowPhotoChoiceModal(true)} 
                className="text-xs font-black text-[#FC4C02] flex items-center gap-2 bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 border border-[#FC4C02]/20 px-4 py-2.5 rounded-xl transition-colors uppercase tracking-wider"
              >
                {runBackgroundImage ? (
                  <> <X size={16} /> Remover Fundo </>
                ) : (
                  <> <Camera size={16} /> Adicionar Foto </>
                )}
              </button>
              <input 
                type="file" 
                ref={runFileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleRunBackgroundChange} 
              />
            </div>
          )}
        </div>

        {(isDuo || socialInvite) && !isEditing && (
          <div className="flex flex-col gap-2 mt-2 relative z-50">
            <label className="text-xs font-bold ml-1 flex items-center gap-2 uppercase tracking-wider text-yellow-500">
              <Users size={14} /> 
              {socialInvite ? 'Com quem você está?' : 'Quem treinou com você?'} <span className="text-red-500">*</span>
            </label>
            
            {taggedUser ? (
              <div className="flex items-center justify-between border rounded-2xl p-3 animate-fade-in bg-yellow-500/10 border-yellow-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/50 overflow-hidden border border-yellow-500/50">
                    {taggedUser.foto_perfil ? (
                      <img src={`${API_URL}${taggedUser.foto_perfil}`} alt={taggedUser.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                        {taggedUser.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm leading-tight">{taggedUser.nome}</span>
                    <span className="text-xs font-semibold text-yellow-500">@{taggedUser.username}</span>
                  </div>
                </div>
                {!socialInvite && (
                  <button onClick={handleRemoveTaggedUser} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X size={18} />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  {isSearching ? <Loader2 size={18} className="text-yellow-500 animate-spin" /> : <Search size={18} className="text-white/40" />}
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Digite o nome ou @username" 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all font-bold" 
                />

                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#111] border border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-50">
                    {searchResults.map(result => (
                      <button 
                        key={result.cpf}
                        onClick={() => handleSelectUser(result)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-black/50 overflow-hidden shrink-0">
                          {result.foto_perfil ? (
                            <img src={`${API_URL}${result.foto_perfil}`} alt={result.nome} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/50 text-[10px] font-bold">
                              {result.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-white text-xs">{result.nome}</span>
                          <span className="text-[10px] text-white/50">@{result.username}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {socialInvite ? (
               <p className="text-[10px] text-yellow-500/80 ml-1 font-bold">Acompanhante selecionado pelo convite.</p>
            ) : (
               <p className="text-[10px] text-white/40 ml-1">Seu amigo precisará aprovar este post para os pontos caírem.</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1.5">
            <button type="button" onClick={() => setIsArchived(false)} className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl text-sm transition-all duration-300 ${!isArchived ? 'bg-yellow-500 text-black font-black shadow-md' : 'text-white/50 hover:text-white font-medium'}`}>
              <Globe size={16} /> Público
            </button>
            <button type="button" onClick={() => setIsArchived(true)} className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl text-sm transition-all duration-300 ${isArchived ? 'bg-[#1a1a1a] text-white font-black shadow-md border border-white/10' : 'text-white/50 hover:text-white font-medium'}`}>
              <EyeOff size={16} /> Arquivado
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2 relative">
          <label className="text-xs font-bold ml-1 flex items-center justify-between uppercase tracking-wider text-white/70">
            <span className="flex items-center gap-2">
              <MapPin size={14} className="text-yellow-500" />
              Onde você está? <span className="text-red-500">*</span>
            </span>
            <span className={`text-[10px] ${MAX_LOCATION_CHARS - academiaNome.length <= 10 ? 'text-red-500 font-black' : 'text-white/40'}`}>
              {academiaNome.length} / {MAX_LOCATION_CHARS}
            </span>
          </label>
          <input 
            type="text" 
            value={academiaNome} 
            onChange={(e) => setAcademiaNome(e.target.value)} 
            maxLength={MAX_LOCATION_CHARS}
            placeholder={socialInvite ? "Ex: Parque do Ibirapuera" : "Ex: Smart Fit - Paulista"} 
            className="w-full bg-white/5 border rounded-2xl p-4 text-white placeholder:text-white/30 focus:outline-none transition-all font-bold border-white/10 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50" 
          />
        </div>

        <div className="flex-1 flex flex-col relative">
          <label className="text-xs font-bold ml-1 mb-2 uppercase tracking-wider text-white/70 flex items-center justify-between">
            <span>Legenda (Opcional)</span>
            <span className={`text-[10px] ${MAX_CAPTION_CHARS - mensagem.length <= 10 ? 'text-red-500 font-black' : 'text-white/40'}`}>
              {mensagem.length} / {MAX_CAPTION_CHARS}
            </span>
          </label>
          <textarea 
            value={mensagem} 
            onChange={(e) => setMensagem(e.target.value)} 
            maxLength={MAX_CAPTION_CHARS}
            placeholder="Compartilhe como foi!" 
            className="w-full bg-white/5 border rounded-2xl p-4 text-white placeholder:text-white/30 focus:outline-none transition-all resize-none h-24 border-white/10 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50" 
          />
        </div>

      </main>

      <div className="p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent z-10 pb-10 mt-auto">
        <button 
          onClick={handleAction} 
          disabled={loading} 
          className="w-full max-w-md mx-auto font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100 text-black bg-yellow-500 hover:bg-yellow-400 shadow-[0_10px_30px_rgba(234,179,8,0.2)]"
        >
          {loading ? <Loader2 size={20} className="animate-spin text-black" /> : <>{isEditing ? <Save size={20} /> : <Send size={20} />}{isEditing ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR CHECK-IN'}</>}
        </button>
      </div>

      {showPhotoChoiceModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowPhotoChoiceModal(false)}>
          <div className="bg-[#111] rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 animate-fade-in-up border-t border-white/10" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-black text-white text-center mb-6">Escolher imagem de fundo</h3>
            <div className="flex gap-4">
              <button onClick={() => navigateToCapture('/camera')} className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Camera size={24} />
                </div>
                <span className="font-bold text-white text-sm">Câmera</span>
              </button>
              <button onClick={handleOpenGallery} className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <ImageIcon size={24} />
                </div>
                <span className="font-bold text-white text-sm">Galeria</span>
              </button>
            </div>
            <button onClick={() => setShowPhotoChoiceModal(false)} className="w-full mt-6 py-4 text-white/50 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showSuccessScreen && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center gap-6 animate-fade-in-up">
            <div className="w-28 h-28 bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={56} className="text-emerald-500" />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">
                {isEditing ? 'Atualizado!' : 'Publicado!'}
              </h2>
              <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                Redirecionando...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}