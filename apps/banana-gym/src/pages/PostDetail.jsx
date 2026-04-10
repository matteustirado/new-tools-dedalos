import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Heart, MessageCircle, MoreVertical, Edit2, Archive, MapPin, Share2, Eye, EyeOff, Activity, Users, Loader2, X, ChevronLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';

import BananasIcon from '../components/BananasIcon';
import CreateComments from '../components/CreateComments';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [duoModalData, setDuoModalData] = useState(null);
  const [likesModal, setLikesModal] = useState({ isOpen: false, type: null, postId: null, users: [], loading: false });
  
  const menuRef = useRef(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('gym_user');
    
    if (!storedUser) {
      navigate('/login');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    setCurrentUser(parsedUser);
    fetchPostDetails(parsedUser.cpf);
  }, [id, navigate]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchPostDetails = async (cpfParam) => {
    try {
      const res = await axios.get(`${API_URL}/api/gym/post/${id}?cpf=${cpfParam}`);
      const loadedPost = res.data.post;
      
      loadedPost.likedByMe = loadedPost.likedByMe === 1 || loadedPost.likedByMe === true;
      loadedPost.bananadByMe = loadedPost.bananadByMe === 1 || loadedPost.bananadByMe === true;
      
      setPost(loadedPost);
    } catch (err) {
      toast.error('Post não encontrado.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const fetchInteractions = async (postId, type) => {
    setLikesModal({ isOpen: true, type, postId, users: [], loading: true });
    try {
      const res = await axios.get(`${API_URL}/api/gym/post/${postId}/interactions?type=${type}`);
      setLikesModal({ isOpen: true, type, postId, users: res.data, loading: false });
    } catch (error) {
      toast.error("Erro ao buscar interações.");
      setLikesModal({ isOpen: false, type: null, postId: null, users: [], loading: false });
    }
  };

  const handleLike = async () => {
    if (!currentUser || !post) return;

    if (post.colaborador_cpf === currentUser.cpf) {
        fetchInteractions(post.id, 'likes');
        return;
    }
    
    const isLiked = post.likedByMe;
    
    setPost((prev) => ({
      ...prev,
      likedByMe: !isLiked,
      likes_count: isLiked ? Math.max(0, prev.likes_count - 1) : prev.likes_count + 1
    }));

    try {
      await axios.post(`${API_URL}/api/gym/like`, {
        checkin_id: post.id,
        colaborador_cpf: currentUser.cpf
      });
    } catch (err) {
      setPost((prev) => ({
        ...prev,
        likedByMe: isLiked,
        likes_count: isLiked ? prev.likes_count + 1 : Math.max(0, prev.likes_count - 1)
      }));
      toast.error('Erro ao curtir.');
    }
  };

  const handleBanana = async () => {
    if (!currentUser || !post) return;

    if (post.colaborador_cpf === currentUser.cpf) {
        fetchInteractions(post.id, 'bananas');
        return;
    }

    const isBananad = post.bananadByMe;
    
    setPost((prev) => ({
      ...prev,
      bananadByMe: !isBananad,
      bananas_count: isBananad ? Math.max(0, (prev.bananas_count || 0) - 1) : (prev.bananas_count || 0) + 1
    }));

    try {
      await axios.post(`${API_URL}/api/gym/banana`, {
        checkin_id: post.id,
        colaborador_cpf: currentUser.cpf
      });
    } catch (err) {
      setPost((prev) => ({
        ...prev,
        bananadByMe: isBananad,
        bananas_count: isBananad ? (prev.bananas_count || 0) + 1 : Math.max(0, (prev.bananas_count || 0) - 1)
      }));
      toast.error('Erro ao dar banana.');
    }
  };

  const handleToggleArchive = async () => {
    setIsMenuOpen(false);
    if (!currentUser || !post) return;
    
    const isArchived = post.arquivado === 1;
    const endpoint = isArchived ? 'unarchive' : 'archive';
    
    try {
      await axios.put(`${API_URL}/api/gym/post/${post.id}/${endpoint}`, {
        colaborador_cpf: currentUser.cpf
      });
      
      if (isArchived) {
        toast.success('Foto desarquivada! Ela voltou para o seu perfil público.');
        setPost(prev => ({ ...prev, arquivado: 0 }));
      } else {
        toast.success('Foto movida para seus Arquivados!');
        navigate(-1);
      }
    } catch (err) {
      toast.error(`Erro ao ${isArchived ? 'desarquivar' : 'arquivar'} o post.`);
    }
  };

  const handleEdit = () => {
    setIsMenuOpen(false);
    navigate('/edit-post', { state: { post } });
  };

  const formatPace = (seconds, distanceKm) => {
    if (!seconds || !distanceKm) return '0:00 /km';
    const minsPerKm = (seconds / 60) / distanceKm;
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

  const getStaticMapUrl = (encodedPolyline) => {
    if (!encodedPolyline) return null;
    try {
        const decoded = polyline.decode(encodedPolyline);
        const simplified = decoded.filter((_, i) => i % 10 === 0);
        let pathStr = "color:0xFC4C02ff|weight:5"; 
        simplified.forEach(point => { pathStr += `|${point[0]},${point[1]}`; });
        const midPoint = decoded[Math.floor(decoded.length / 2)];
        return `https://open.mapquestapi.com/staticmap/v5/map?key=G0y0v5A4PGAgD6b8QY13Oq5t23zR06p0&type=dark&zoom=13&size=600,600&center=${midPoint[0]},${midPoint[1]}&shape=${pathStr}`;
    } catch(e) { return null; }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-yellow-500">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) return null;

  const isMyPost = currentUser?.cpf === post.colaborador_cpf;
  const isRunPost = post.activity_type === 'RUN'; 
  const userName = post.colaborador_username || post.colaborador_nome.split(' ')[0].toLowerCase();
  const profileUrl = `/${userName}`;
  const isDuoApproved = post.tagged_cpf && post.duo_status === 'APPROVED';
  const taggedUserName = post.tagged_username || (post.tagged_nome ? post.tagged_nome.split(' ')[0].toLowerCase() : '');

  const formattedDate = new Date(post.created_at).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="w-full relative text-white bg-[#050505] min-h-screen animate-page-transition flex flex-col pt-4">
      <div className="px-4 mb-4">
         <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors inline-block">
           <ChevronLeft size={24} />
         </button>
      </div>

      <main className="flex-1 flex flex-col pb-6 max-w-md mx-auto w-full border-t border-white/10">
        <div className="p-4 flex items-center justify-between">
          {isDuoApproved ? (
             <div onClick={() => setDuoModalData(post)} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer group">
               <div className="relative flex items-center">
                 <div className="w-10 h-10 rounded-full bg-black border-2 border-[#050505] overflow-hidden z-20">
                   {post.colaborador_foto ? (
                     <img src={`${API_URL}${post.colaborador_foto}`} className="w-full h-full object-cover" alt={userName} />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/50 text-xs font-bold">{userName.charAt(0).toUpperCase()}</div>
                   )}
                 </div>
                 <div className="w-10 h-10 rounded-full bg-black border-2 border-[#050505] overflow-hidden -ml-4 z-10 opacity-90 group-hover:opacity-100 transition-opacity">
                   {post.tagged_foto ? (
                     <img src={`${API_URL}${post.tagged_foto}`} className="w-full h-full object-cover" alt={taggedUserName} />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/50 text-xs font-bold">{taggedUserName.charAt(0).toUpperCase()}</div>
                   )}
                 </div>
               </div>
               
               <div className="flex flex-col justify-center">
                 <h3 className="font-bold text-sm text-white leading-tight flex items-center gap-1.5">
                   @{userName} <Users size={12} className="text-yellow-500" /> @{taggedUserName}
                 </h3>
                 <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5 ${isRunPost ? 'text-[#FC4C02]' : 'text-yellow-500'}`}>
                   <MapPin size={10} /> 
                   {post.unidade || post.academia_nome || 'Academia não informada'}
                 </p>
               </div>
             </div>
          ) : (
             <Link to={profileUrl} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
               <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 overflow-hidden">
                 {post.colaborador_foto ? (
                   <img src={`${API_URL}${post.colaborador_foto}`} alt={post.colaborador_nome} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-white/50 font-bold">
                     {userName?.charAt(0).toUpperCase()}
                   </div>
                 )}
               </div>
               <div>
                 <p className="text-sm font-bold text-white leading-tight">@{userName}</p>
                 <p className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 uppercase tracking-widest ${isRunPost ? 'text-[#FC4C02]' : 'text-yellow-500'}`}>
                   <MapPin size={10} /> 
                   {post.unidade || 'Academia não informada'}
                 </p>
               </div>
             </Link>
          )}

          {isMyPost && (
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 bg-transparent rounded-full hover:bg-white/10 transition-colors"
              >
                <MoreVertical size={20} className="text-white/60" />
              </button>
              
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-xl shadow-2xl py-1 z-[110] animate-fade-in">
                  <button 
                    onClick={handleEdit}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-white/90 hover:bg-white/5 hover:text-yellow-500 transition-colors"
                  >
                    <Edit2 size={16} />
                    Editar Legenda
                  </button>
                  <div className="w-full h-px bg-white/5 my-1" />
                  
                  <button 
                    onClick={handleToggleArchive}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                      post.arquivado === 1 
                        ? 'text-white/90 hover:bg-white/5 hover:text-emerald-400' 
                        : 'text-white/90 hover:bg-white/5 hover:text-red-400'
                    }`}
                  >
                    {post.arquivado === 1 ? (
                      <>
                        <Eye size={16} />
                        Desarquivar Foto
                      </>
                    ) : (
                      <>
                        <Archive size={16} />
                        Arquivar Foto
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full aspect-[4/5] bg-[#111] flex items-center justify-center relative overflow-hidden">
            {isRunPost ? (
               <div className="w-full h-full relative">
                 {post.foto_treino_url ? (
                     <img src={`${API_URL}${post.foto_treino_url}`} className={`w-full h-full object-cover ${post.arquivado === 1 ? 'grayscale opacity-80' : ''}`} alt="Fundo" />
                 ) : (
                     post.run_polyline && (
                       <img src={getStaticMapUrl(post.run_polyline)} className={`w-full h-full object-cover mix-blend-screen opacity-80 ${post.arquivado === 1 ? 'grayscale' : ''}`} alt="Mapa" />
                     )
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                 <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-[#FC4C02]/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20">
                    <Activity size={14} className="text-[#FC4C02]" />
                    <span className="text-xs font-black text-[#FC4C02] tracking-wider">STRAVA</span>
                 </div>
                 <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-end">
                    <div>
                      <div className="text-white/80 font-bold text-[10px] uppercase tracking-widest mb-1 drop-shadow-md">Distância</div>
                      <div className="text-[#FC4C02] font-black text-6xl leading-none drop-shadow-lg">
                        {post.run_distance_km}<span className="text-2xl text-[#FC4C02]/70 ml-1">km</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col gap-2">
                      <div>
                        <div className="text-white/70 font-bold text-[10px] uppercase tracking-wider drop-shadow-md">Tempo</div>
                        <div className="text-white font-black text-xl leading-none drop-shadow-lg">{formatTime(post.run_duration_seconds)}</div>
                      </div>
                      <div>
                        <div className="text-white/70 font-bold text-[10px] uppercase tracking-wider drop-shadow-md">Pace Médio</div>
                        <div className="text-white font-black text-xl leading-none drop-shadow-lg">{formatPace(post.run_duration_seconds, parseFloat(post.run_distance_km))}</div>
                      </div>
                    </div>
                 </div>
               </div>
            ) : (
               <div className="w-full h-full relative">
                 <img 
                   src={`${API_URL}${post.foto_treino_url}`} 
                   alt="Treino" 
                   className={`w-full h-full object-cover ${post.arquivado === 1 ? 'grayscale opacity-80' : ''}`} 
                 />
               </div>
            )}
            
            {post.arquivado === 1 && (
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 z-30">
                <EyeOff size={14} className="text-white/70" />
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Arquivado</span>
              </div>
            )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-5">
              <button 
                onClick={handleBanana}
                className="flex items-center gap-1.5 transition-transform active:scale-90"
              >
                <BananasIcon type={post.bananadByMe ? 'filled' : 'outline'} size={28} />
                <span className="text-sm font-bold text-white">{post.bananas_count || 0}</span>
              </button>
              
              <button onClick={handleLike} className="flex items-center gap-1.5 transition-transform active:scale-90">
                <Heart size={26} className={post.likedByMe ? 'fill-red-500 text-red-500' : 'text-white stroke-[1.5px]'} />
                <span className="text-sm font-bold text-white">{post.likes_count || 0}</span>
              </button>
              
              <button onClick={() => setIsCommentsOpen(true)} className="flex items-center gap-1.5 transition-transform active:scale-90">
                <MessageCircle size={26} className="text-white stroke-[1.5px]" />
                <span className="text-sm font-bold text-white">{post.comments_count || 0}</span>
              </button>
            </div>

            <button 
              onClick={() => toast.info('Em breve você poderá compartilhar os treinos! 🚀')} 
              className="p-1 text-white/80 hover:text-yellow-500 transition-colors active:scale-90"
            >
              <Share2 size={24} />
            </button>
          </div>
          
          {post.mensagem && (
            <p className="text-sm text-white/90 leading-relaxed mb-2">
              <span className="font-bold mr-2 text-white">{userName}</span>
              {post.mensagem}
            </p>
          )}

          {post.tagged_cpf && post.duo_status === 'PENDING' && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3 mt-2 flex items-center justify-between">
               <p className="text-[11px] font-bold text-white/50">Aguardando @{post.tagged_username || 'amigo'} aprovar o treino...</p>
               <Loader2 size={14} className="text-white/30 animate-spin" />
            </div>
          )}

          {post.comments_count > 0 && (
            <button 
              onClick={() => setIsCommentsOpen(true)}
              className="text-sm text-white/50 mb-2 hover:text-white/80 transition-colors block"
            >
              Ver todos os {post.comments_count} comentários
            </button>
          )}

          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-3">
            {formattedDate}
          </p>
        </div>
      </main>

      {/* 👈 Modais com z-index[100] garantido! */}

      {duoModalData && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDuoModalData(null)}>
          <div className="bg-[#111] rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 animate-fade-in-up border-t border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-white">Visitar perfil de quem?</h3>
              <button onClick={() => setDuoModalData(null)} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setDuoModalData(null); navigate(`/${duoModalData.colaborador_username}`); }} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-black overflow-hidden">
                  {duoModalData.colaborador_foto ? (
                    <img src={`${API_URL}${duoModalData.colaborador_foto}`} className="w-full h-full object-cover" alt="Perfil" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">{duoModalData.colaborador_username?.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-white text-base">{duoModalData.colaborador_nome}</span>
                  <span className="text-xs text-white/50">@{duoModalData.colaborador_username}</span>
                </div>
              </button>

              <button 
                onClick={() => { setDuoModalData(null); navigate(`/${duoModalData.tagged_username}`); }} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-black overflow-hidden">
                  {duoModalData.tagged_foto ? (
                    <img src={`${API_URL}${duoModalData.tagged_foto}`} className="w-full h-full object-cover" alt="Perfil" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">{duoModalData.tagged_username?.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-white text-base">{duoModalData.tagged_nome}</span>
                  <span className="text-xs text-yellow-500 font-semibold">@{duoModalData.tagged_username}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {likesModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setLikesModal({ isOpen: false, type: null, postId: null, users: [], loading: false })}>
          <div className="bg-[#111] rounded-t-3xl w-full max-w-md mx-auto p-6 pb-12 animate-fade-in-up border-t border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                {likesModal.type === 'likes' ? <Heart className="text-red-500 fill-red-500" size={24} /> : <span className="text-2xl">🍌</span>}
                <h3 className="text-lg font-black text-white">
                  {likesModal.type === 'likes' ? 'Curtidas' : 'Bananas'}
                </h3>
              </div>
              <button onClick={() => setLikesModal({ isOpen: false, type: null, postId: null, users: [], loading: false })} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {likesModal.loading ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin text-yellow-500" /></div>
              ) : likesModal.users.length === 0 ? (
                <div className="text-center py-6 text-white/50 text-sm font-bold">Ninguém interagiu ainda. 😢</div>
              ) : (
                likesModal.users.map(u => (
                  <button 
                    key={u.cpf}
                    onClick={() => { setLikesModal({ isOpen: false }); navigate(`/${u.username}`); }} 
                    className="w-full bg-transparent p-3 flex items-center gap-4 hover:bg-white/5 transition-colors rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/10">
                      {u.foto_perfil ? (
                        <img src={`${API_URL}${u.foto_perfil}`} className="w-full h-full object-cover" alt="Perfil" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">{u.username?.charAt(0).toUpperCase()}</div>
                      )}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-white text-sm">{u.nome}</span>
                      <span className="text-xs text-white/50">@{u.username}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Se o seu modal de comentários também tem esse problema, não se esqueça de ajustar o z-index dentro dele caso seja necessário, mas por via de regra o contêiner mãe deve permitir! */}
      <CreateComments 
        isOpen={isCommentsOpen} 
        onClose={() => setIsCommentsOpen(false)} 
        post={post} 
        currentUser={currentUser} 
      />
    </div>
  );
}