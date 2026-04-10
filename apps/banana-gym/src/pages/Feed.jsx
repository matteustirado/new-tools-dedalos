import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { MapPin, Heart, MessageCircle, Megaphone, Sparkles, Share2, MoreVertical, Edit2, Archive, Activity, Users, X, Loader2 } from 'lucide-react';
import polyline from '@mapbox/polyline';

import BananasIcon from '../components/BananasIcon';
import CreateComments from '../components/CreateComments';
import LoadingScreen from '../components/LoadingScreen';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Feed() {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [bananadPosts, setBananadPosts] = useState(new Set());
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  
  const [duoModalData, setDuoModalData] = useState(null);
  const [likesModal, setLikesModal] = useState({ isOpen: false, type: null, postId: null, users: [], loading: false });

  const [showSplash, setShowSplash] = useState(() => {
    const isJustLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
    if (isJustLoggedIn) {
      sessionStorage.removeItem('just_logged_in');
    }
    return isJustLoggedIn;
  });

  const [devMessage] = useState({
    titulo: "Bem-vindo ao Banana's Gym! 🦍🍌",
    texto: "Essa é a nossa versão Beta! Bora treinar e encher esse feed de conquistas. Fique de olho aqui para novidades e atualizações dos DEVs. Bom treino!"
  });

  const observer = useRef();
  
  const lastPostElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  useEffect(() => {
    const storedUser = localStorage.getItem('gym_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    fetchFeed(page);
  }, [page]);

  const fetchFeed = async (pageNumber) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const storedUser = JSON.parse(localStorage.getItem('gym_user'));
      const userCpf = storedUser?.cpf || '';
      
      const { data } = await axios.get(`${API_URL}/api/gym/feed?limit=5&page=${pageNumber}&cpf=${userCpf}`);

      if (data.length < 5) {
        setHasMore(false);
      }

      setPosts(prevPosts => {
        const processData = (items, existingUrlsSet) => {
          return items.filter(p => {
            if (p.foto_treino_url) {
              if (existingUrlsSet.has(p.foto_treino_url)) return false;
              existingUrlsSet.add(p.foto_treino_url);
            }
            return true;
          });
        };

        if (pageNumber === 1) {
          return processData(data, new Set());
        }
        
        const existingIds = new Set(prevPosts.map(p => p.id));
        const existingUrls = new Set(prevPosts.map(p => p.foto_treino_url).filter(Boolean));
        
        const newUniquePosts = data.filter(p => {
          if (existingIds.has(p.id)) return false;
          if (p.foto_treino_url && existingUrls.has(p.foto_treino_url)) return false;
          if (p.foto_treino_url) existingUrls.add(p.foto_treino_url);
          return true;
        });
        
        return [...prevPosts, ...newUniquePosts];
      });

      setLikedPosts(prev => {
        const newLikes = new Set(prev);
        data.forEach(p => { if (p.likedByMe) newLikes.add(p.id); });
        return newLikes;
      });

      setBananadPosts(prev => {
        const newBananas = new Set(prev);
        data.forEach(p => { if (p.bananadByMe) newBananas.add(p.id); });
        return newBananas;
      });

    } catch (err) {
      toast.error('Erro ao carregar o feed.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      
      if (pageNumber === 1) {
        setTimeout(() => {
          const savedPosition = sessionStorage.getItem(`scroll_pos_${window.location.pathname}`);
          if (savedPosition) {
            window.scrollTo({ top: parseInt(savedPosition, 10), behavior: 'instant' });
          }
        }, 50);
      }
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

  const handleLike = async (post) => {
    if (!user) return;
    
    if (post.colaborador_cpf === user.cpf) {
        fetchInteractions(post.id, 'likes');
        return;
    }
    
    const isLiked = likedPosts.has(post.id);
    const newLiked = new Set(likedPosts);
    
    if (isLiked) {
      newLiked.delete(post.id);
    } else {
      newLiked.add(post.id);
    }
    
    setLikedPosts(newLiked);
    setPosts((currentPosts) => 
      currentPosts.map((p) => {
        if (p.id === post.id) {
          return { 
            ...p, 
            likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 
          };
        }
        return p;
      })
    );

    try {
      await axios.post(`${API_URL}/api/gym/like`, {
        checkin_id: post.id,
        colaborador_cpf: user.cpf
      });
    } catch (err) {
      console.error('Erro ao registrar like.');
    }
  };

  const handleBanana = async (post) => {
    if (!user) return;

    if (post.colaborador_cpf === user.cpf) {
        fetchInteractions(post.id, 'bananas');
        return;
    }
    
    const isBananad = bananadPosts.has(post.id);
    const newBananad = new Set(bananadPosts);
    
    if (isBananad) {
      newBananad.delete(post.id);
    } else {
      newBananad.add(post.id);
    }
    
    setBananadPosts(newBananad);
    setPosts((currentPosts) => 
      currentPosts.map((p) => {
        if (p.id === post.id) {
          return { 
            ...p, 
            bananas_count: isBananad ? Math.max(0, (p.bananas_count || 0) - 1) : (p.bananas_count || 0) + 1 
          };
        }
        return p;
      })
    );

    try {
      await axios.post(`${API_URL}/api/gym/banana`, {
        checkin_id: post.id,
        colaborador_cpf: user.cpf
      });
    } catch (err) {
      console.error('Erro ao dar banana.');
    }
  };

  const handleOpenComments = (post) => {
    setSelectedPost(post);
    setIsCommentsOpen(true);
  };

  const handleCloseComments = () => {
    setIsCommentsOpen(false);
    setSelectedPost(null);
  };

  const handleArchivePost = async (postId) => {
    if (!user) return;
    
    setOpenMenuId(null);
    setPosts((currentPosts) => currentPosts.filter(p => p.id !== postId));

    try {
      await axios.put(`${API_URL}/api/gym/post/${postId}/archive`, {
        colaborador_cpf: user.cpf
      });
      toast.success('Foto movida para seus Arquivados!');
    } catch (err) {
      toast.error('Erro ao arquivar a foto.');
      setPage(1);
    }
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
      simplified.forEach(point => {
        pathStr += `|${point[0]},${point[1]}`;
      });
      
      const midPoint = decoded[Math.floor(decoded.length / 2)];
      
      return `https://open.mapquestapi.com/staticmap/v5/map?key=G0y0v5A4PGAgD6b8QY13Oq5t23zR06p0&type=dark&zoom=13&size=600,600&center=${midPoint[0]},${midPoint[1]}&shape=${pathStr}`;
    } catch(e) {
      return null;
    }
  };

  return (
    <div className="w-full relative overflow-x-hidden text-white animate-page-transition">
      {!loading && !showSplash && devMessage && (
        <div className="w-full px-4 mb-6 mt-2">
          <div className="bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-2xl p-4 relative overflow-hidden shadow-lg">
            <div className="absolute -right-4 -top-4 opacity-10">
              <Sparkles size={80} className="text-yellow-500" />
            </div>
            
            <div className="relative z-10 flex gap-3">
              <div className="shrink-0 mt-0.5">
                <Megaphone size={20} className="text-yellow-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-yellow-500 tracking-tight mb-1">
                  {devMessage.titulo}
                </h3>
                <p className="text-xs text-white/80 leading-relaxed font-medium">
                  {devMessage.texto}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSplash ? (
        <LoadingScreen />
      ) : loading && page === 1 ? (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-50 px-4">
          <div className="w-24 h-24 mb-4 bg-white/5 rounded-full flex items-center justify-center">
            <span className="text-4xl grayscale">🍌</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Feed Vazio</h2>
          <p className="text-sm px-8">Seja o primeiro a treinar hoje e inaugure o feed!</p>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full pb-8">
          {posts.map((post, index) => {
            const userName = post.colaborador_username || post.colaborador_nome.split(' ')[0].toLowerCase();
            const profileUrl = `/${userName}`;
            const isMyPost = user?.cpf === post.colaborador_cpf;
            
            const isRunPost = post.activity_type === 'RUN';
            
            const isDuoApproved = post.tagged_cpf && post.duo_status === 'APPROVED';
            const taggedUserName = post.tagged_username || (post.tagged_nome ? post.tagged_nome.split(' ')[0].toLowerCase() : '');

            const formattedDate = new Date(post.created_at).toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const isLastPost = posts.length === index + 1;

            return (
              <article 
                key={post.id} 
                ref={isLastPost ? lastPostElementRef : null}
                className="w-full bg-transparent border-b border-white/10 mb-0 pb-6"
              >
                <div className="flex items-center justify-between p-4">
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
                      <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0">
                        {post.colaborador_foto ? (
                          <img src={`${API_URL}${post.colaborador_foto}`} className="w-full h-full object-cover" alt={userName} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">{userName.charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-sm text-white leading-tight">@{userName}</h3>
                        <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5 ${isRunPost ? 'text-[#FC4C02]' : 'text-yellow-500'}`}>
                          <MapPin size={10} /> 
                          {post.unidade || post.academia_nome || 'Academia não informada'}
                        </p>
                      </div>
                    </Link>
                  )}

                  {isMyPost && (
                    <div className="relative">
                      <button 
                        onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}
                        className="p-2 bg-transparent rounded-full hover:bg-white/10 transition-colors"
                      >
                        <MoreVertical size={20} className="text-white/60" />
                      </button>
                      
                      {openMenuId === post.id && (
                        <>
                          <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)}></div>
                          <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-xl shadow-2xl py-1 z-[110] animate-fade-in">
                            <button 
                              onClick={() => navigate('/edit-post', { state: { post } })}
                              className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-white/90 hover:bg-white/5 hover:text-yellow-500 transition-colors"
                            >
                              <Edit2 size={16} />
                              Editar Legenda
                            </button>
                            
                            <div className="w-full h-px bg-white/5 my-1" />
                            
                            <button 
                              onClick={() => handleArchivePost(post.id)}
                              className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-white/90 hover:bg-white/5 hover:text-red-400 transition-colors"
                            >
                              <Archive size={16} />
                              Arquivar Foto
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div 
                   className="w-full aspect-[4/5] bg-[#111] relative overflow-hidden"
                   onClick={() => navigate(`/post/${post.id}`)}
                >
                  {isRunPost ? (
                    <div className="w-full h-full relative cursor-pointer group">
                      {post.foto_treino_url ? (
                        <img 
                          src={`${API_URL}${post.foto_treino_url}`} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          alt="Fundo da Corrida" 
                        />
                      ) : (
                        post.run_polyline && (
                          <img 
                            src={getStaticMapUrl(post.run_polyline)} 
                            className="w-full h-full object-cover opacity-80 mix-blend-screen"
                            alt="Mapa da Corrida"
                          />
                        )
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-[#FC4C02]/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20">
                        <Activity size={12} className="text-[#FC4C02]" />
                        <span className="text-[10px] font-black text-[#FC4C02] tracking-wider">STRAVA</span>
                      </div>
                      <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-end">
                        <div>
                          <div className="text-white/80 font-bold text-[10px] uppercase tracking-widest mb-1 drop-shadow-md">Distância</div>
                          <div className="text-[#FC4C02] font-black text-5xl leading-none drop-shadow-lg">
                            {post.run_distance_km}<span className="text-xl text-[#FC4C02]/70 ml-1">km</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col gap-2">
                          <div>
                            <div className="text-white/70 font-bold text-[9px] uppercase tracking-wider drop-shadow-md">Tempo</div>
                            <div className="text-white font-black text-base leading-none drop-shadow-lg">
                              {formatTime(post.run_duration_seconds)}
                            </div>
                          </div>
                          <div>
                            <div className="text-white/70 font-bold text-[9px] uppercase tracking-wider drop-shadow-md">Pace Médio</div>
                            <div className="text-white font-black text-base leading-none drop-shadow-lg">
                              {formatPace(post.run_duration_seconds, parseFloat(post.run_distance_km))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full relative cursor-pointer">
                      <img 
                        src={`${API_URL}${post.foto_treino_url}`} 
                        alt="Treino" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="px-4 pt-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-5">
                      <button 
                        onClick={() => handleBanana(post)}
                        className="flex items-center gap-1.5 active:scale-75 transition-transform"
                      >
                        <BananasIcon type={bananadPosts.has(post.id) ? 'filled' : 'outline'} size={28} />
                        <span className="text-sm font-black text-white/80">
                          {post.bananas_count || 0}
                        </span>
                      </button>

                      <button 
                        onClick={() => handleLike(post)}
                        className="flex items-center gap-1.5 active:scale-75 transition-transform"
                      >
                        <Heart 
                          size={26} 
                          className={`transition-colors duration-300 ${likedPosts.has(post.id) ? 'fill-red-500 text-red-500' : 'text-white stroke-[1.5px]'}`} 
                        />
                        <span className="text-sm font-black text-white/80">
                          {post.likes_count || 0}
                        </span>
                      </button>

                      <button 
                        className="flex items-center gap-1.5 text-white hover:text-blue-400 active:scale-75 transition-transform"
                        onClick={() => handleOpenComments(post)}
                      >
                        <MessageCircle size={26} className="stroke-[1.5px]" />
                        <span className="text-sm font-black">
                          {post.comments_count || 0}
                        </span>
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
                    <div className="mb-2">
                      <p className="text-sm text-white/90 leading-relaxed">
                        <Link to={profileUrl} className="font-bold mr-2 text-white hover:text-yellow-400 transition-colors">
                          {userName}
                        </Link>
                        {post.mensagem}
                      </p>
                    </div>
                  )}

                  {post.tagged_cpf && post.duo_status === 'PENDING' && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3 flex items-center justify-between">
                       <p className="text-[11px] font-bold text-white/50">Aguardando @{post.tagged_username || 'amigo'} aprovar o treino...</p>
                       <Loader2 size={14} className="text-white/30 animate-spin" />
                    </div>
                  )}

                  {post.comments_count > 0 && (
                    <button 
                      onClick={() => handleOpenComments(post)}
                      className="text-sm text-white/50 mb-2 hover:text-white/80 transition-colors block"
                    >
                      Ver todos os {post.comments_count} comentários
                    </button>
                  )}

                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">
                    {formattedDate}
                  </p>
                </div>
              </article>
            );
          })}

          {loadingMore && (
            <div className="py-6 flex justify-center w-full">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="py-8 text-center text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">
              Você chegou ao fim do feed 🍌
            </div>
          )}
        </div>
      )}

      {/* 👈 MODAIS NO NÍVEL MÁXIMO DE Z-INDEX */}
      
      {/* Modal de Escolha de Perfil da Dupla */}
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

      {/* Modal de Likes e Bananas */}
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

      {/* Modal de Comentários */}
      <CreateComments 
        isOpen={isCommentsOpen} 
        onClose={handleCloseComments} 
        post={selectedPost} 
        currentUser={user} 
        className="z-[100]"
      />
    </div>
  );
}