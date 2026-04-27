import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapPin, Heart, MessageCircle, Megaphone, Sparkles, Share2, MoreVertical, Edit2, Archive, Activity, Users, Loader2, RefreshCcw, BellRing } from 'lucide-react';
import polyline from '@mapbox/polyline';

import api from '../services/api';
import BananasIcon from '../components/BananasIcon';
import CreateComments from '../components/CreateComments';
import SharePost from '../components/SharePost'; 
import DuoProfileModal from '../components/DuoProfileModal';
import InteractionsModal from '../components/InteractionsModal';
import SponsoredPost from '../components/SponsoredPost'; // NOSSA NOVA ARMA SECRETA 💸
import { subscribeToPushNotifications } from '../utils/push';
import { getSocket } from '../socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Feed() {
  const navigate = useNavigate();
  
  const [user] = useState(() => {
    const storedUser = localStorage.getItem('gym_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [bananadPosts, setBananadPosts] = useState(new Set());
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState(new Set());
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharePostData, setSharePostData] = useState(null);
  const [duoModalData, setDuoModalData] = useState(null);
  const [likesModal, setLikesModal] = useState({ isOpen: false, type: null, postId: null, users: [], loading: false });
  const [showPushBanner, setShowPushBanner] = useState(false);

  const [devMessage] = useState({
    titulo: "Bem-vindo ao Banana's Gym! 🦍🍌",
    texto: "Essa é a nossa versão Beta! Bora treinar e encher esse feed de conquistas. Fique de olho aqui para novidades e atualizações dos DEVs. Bom treino!"
  });

  const observer = useRef();
  
  const lastPostElementRef = useCallback(node => {
    if (loading || loadingMore || feedError) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, feedError]);

  const fetchFeed = useCallback(async (pageNumber) => {
    let currentError = false;
    try {
      setFeedError(false); 
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const storedUser = JSON.parse(localStorage.getItem('gym_user'));
      const userCpf = storedUser?.cpf || '';
      
      const { data } = await api.get(`/api/gym/feed?limit=5&page=${pageNumber}&cpf=${userCpf}`);

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
      console.error(err);
      setFeedError(true);
      currentError = true;
    } finally {
      setLoading(false);
      setLoadingMore(false);
      
      if (pageNumber === 1 && !currentError) {
        setTimeout(() => {
          const savedPosition = sessionStorage.getItem(`scroll_pos_${window.location.pathname}`);
          if (savedPosition) {
            window.scrollTo({ top: parseInt(savedPosition, 10), behavior: 'instant' });
          }
        }, 50);
      }
    }
  }, []);

  useEffect(() => {
    fetchFeed(page);
  }, [page, fetchFeed]);

  useEffect(() => {
    const socket = getSocket();

    const handleNewPost = () => {
      if (window.scrollY < 150) {
        setPage(1);
        fetchFeed(1);
      }
    };

    const handleNewLike = (data) => {
      if (user && data.colaborador_cpf === user.cpf) return;
      
      setPosts(currentPosts => currentPosts.map(p => {
        if (p.id === data.checkin_id) {
          return {
            ...p,
            likes_count: data.action === 'liked' ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1)
          };
        }
        return p;
      }));
    };

    const handleNewBanana = (data) => {
      if (user && data.colaborador_cpf === user.cpf) return;
      
      setPosts(currentPosts => currentPosts.map(p => {
        if (p.id === data.checkin_id) {
          return {
            ...p,
            bananas_count: data.action === 'bananad' ? (p.bananas_count || 0) + 1 : Math.max(0, (p.bananas_count || 0) - 1)
          };
        }
        return p;
      }));
    };

    const handleNewComment = (data) => {
      if (user && data.colaborador_cpf === user.cpf) return;
      
      setPosts(currentPosts => currentPosts.map(p => {
        if (p.id === data.checkin_id && !data.isDelete) {
          return { ...p, comments_count: (p.comments_count || 0) + 1 };
        }
        if (p.id === data.checkin_id && data.isDelete) {
          return { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) };
        }
        return p;
      }));
    };

    socket.on('gym:new_post', handleNewPost);
    socket.on('gym:new_like', handleNewLike);
    socket.on('gym:new_banana', handleNewBanana);
    socket.on('gym:new_comment', handleNewComment);

    return () => {
      socket.off('gym:new_post', handleNewPost);
      socket.off('gym:new_like', handleNewLike);
      socket.off('gym:new_banana', handleNewBanana);
      socket.off('gym:new_comment', handleNewComment);
    };
  }, [user, fetchFeed]);

  useEffect(() => {
    const checkNotificationPermission = () => {
      if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
        if (Notification.permission === 'default' || Notification.permission === 'prompt') {
          setShowPushBanner(true);
        }
      }
    };
    checkNotificationPermission();
  }, []);

  const handleEnablePush = async () => {
    if (!user) return;
    const success = await subscribeToPushNotifications(user.cpf);
    if (success || Notification.permission === 'denied') {
      setShowPushBanner(false);
    }
  };

  const fetchInteractions = async (postId, type) => {
    setLikesModal({ isOpen: true, type, postId, users: [], loading: true });
    try {
      const res = await api.get(`/api/gym/post/${postId}/interactions?type=${type}`);
      setLikesModal({ isOpen: true, type, postId, users: res.data, loading: false });
    } catch (error) {
      console.error(error);
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
      await api.post('/api/gym/like', {
        checkin_id: post.id,
        colaborador_cpf: user.cpf
      });
    } catch (err) {
      console.error(err);
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
      await api.post('/api/gym/banana', {
        checkin_id: post.id,
        colaborador_cpf: user.cpf
      });
    } catch (err) {
      console.error(err);
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
      await api.put(`/api/gym/post/${postId}/archive`, {
        colaborador_cpf: user.cpf
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro de conexão ao arquivar o post. Tentando recarregar...');
      setPage(1);
    }
  };

  const toggleExpandPost = (postId) => {
    setExpandedPosts(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(postId)) {
        newExpanded.delete(postId);
      } else {
        newExpanded.add(postId);
      }
      return newExpanded;
    });
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
      console.error(e);
      return null;
    }
  };

  return (
    <div className="w-full relative overflow-x-hidden text-white animate-page-transition">
      
      {!loading && !feedError && (
        <div className="w-full px-4 mb-6 mt-2 flex flex-col gap-3">
          
          {showPushBanner && (
            <div className="bg-gradient-to-r from-blue-500/20 to-blue-900/20 border border-blue-500/30 rounded-2xl p-4 relative overflow-hidden shadow-[0_4px_20px_rgba(59,130,246,0.15)] animate-fade-in flex items-center justify-between">
              <div className="absolute -right-4 -bottom-4 opacity-10 blur-[2px]">
                <BellRing size={100} className="text-blue-400" />
              </div>
              
              <div className="relative z-10 flex gap-3 flex-1 items-center">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex shrink-0 items-center justify-center border border-blue-500/30 shadow-inner">
                  <BellRing size={18} className="text-blue-400 animate-pulse" />
                </div>
                <div className="flex flex-col pr-2">
                  <h3 className="text-sm font-black text-blue-300 tracking-tight">
                    Ative as Notificações
                  </h3>
                  <p className="text-[11px] text-white/80 leading-tight mt-0.5">
                    Seja o primeiro a saber quando curtirem seu treino!
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleEnablePush}
                className="relative z-10 shrink-0 bg-blue-500 hover:bg-blue-400 text-black text-xs font-black px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.4)]"
              >
                ATIVAR
              </button>
            </div>
          )}

          {devMessage && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-2xl p-4 relative overflow-hidden shadow-lg animate-fade-in">
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
          )}
        </div>
      )}

      {loading && page === 1 ? (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feedError ? ( 
        <div className="flex flex-col items-center justify-center h-[50vh] text-center px-6 animate-fade-in">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
            <Activity size={32} className="text-white/30" />
          </div>
          <h2 className="text-xl font-black mb-2 text-white/80">Sem Conexão</h2>
          <p className="text-sm text-white/50 mb-6">Não conseguimos carregar o feed. Verifique sua internet.</p>
          <button 
            onClick={() => fetchFeed(1)} 
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black px-6 py-3 rounded-xl transition-all active:scale-95"
          >
            <RefreshCcw size={18} />
            TENTAR NOVAMENTE
          </button>
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

            const handleNavigateToPost = () => {
               const slugOrId = post.post_slug || post.id;
               navigate(`/${userName}/post/${slugOrId}`);
            };

            return (
              <React.Fragment key={post.id || index}>
                <article 
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
                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
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
                     className="w-full aspect-[4/5] bg-[#111] relative overflow-hidden cursor-pointer"
                     onClick={handleNavigateToPost}
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
                          <BananasIcon type={bananadPosts.has(post.id) || isMyPost ? 'filled' : 'outline'} size={28} />
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
                            className={`transition-colors duration-300 ${likedPosts.has(post.id) || isMyPost ? 'fill-red-500 text-red-500' : 'text-white stroke-[1.5px]'}`} 
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
                        onClick={() => {
                          setSharePostData(post);
                          setIsShareOpen(true);
                        }} 
                        className="p-1 text-white/80 hover:text-yellow-500 transition-colors active:scale-90"
                      >
                        <Share2 size={24} />
                      </button>
                    </div>

                    {post.mensagem && (
                      <div className="mb-2">
                        <p className="text-sm text-white/90 leading-relaxed break-words">
                          <Link to={profileUrl} className="font-bold mr-2 text-white hover:text-yellow-400 transition-colors">
                            {userName}
                          </Link>
                          
                          {post.mensagem.length > 125 && !expandedPosts.has(post.id) ? (
                            <>
                              {post.mensagem.substring(0, 125)}...
                              <button 
                                onClick={() => toggleExpandPost(post.id)}
                                className="text-white/50 hover:text-white font-bold ml-1 transition-colors"
                              >
                                mais
                              </button>
                            </>
                          ) : (
                            post.mensagem
                          )}
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
                        onClick={handleNavigateToPost}
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

                {/* INJEÇÃO MATEMÁTICA DO ANÚNCIO (A cada 6 posts, 1 anúncio) */}
                {(index + 1) % 6 === 0 && (
                  <div className="px-4 mt-6">
                    <SponsoredPost />
                  </div>
                )}

              </React.Fragment>
            );
          })}

          {loadingMore && (
            <div className="py-6 flex justify-center w-full">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="py-8 text-center text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">
              Você chegou ao fim do feed 🍌
            </div>
          )}
        </div>
      )}

      <DuoProfileModal 
        isOpen={!!duoModalData} 
        onClose={() => setDuoModalData(null)} 
        duoModalData={duoModalData} 
      />

      <InteractionsModal 
        isOpen={likesModal.isOpen} 
        onClose={() => setLikesModal({ ...likesModal, isOpen: false })} 
        data={likesModal} 
      />

      <CreateComments 
        isOpen={isCommentsOpen} 
        onClose={handleCloseComments} 
        post={selectedPost} 
        currentUser={user} 
        onCommentAdded={() => {
          setPosts(currentPosts => currentPosts.map(p => 
            p.id === selectedPost?.id 
              ? { ...p, comments_count: (p.comments_count || 0) + 1 } 
              : p
          ));
        }}
        onCommentDeleted={() => {
          setPosts(currentPosts => currentPosts.map(p => 
            p.id === selectedPost?.id 
              ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } 
              : p
          ));
        }}
      />

      <SharePost 
        isOpen={isShareOpen} 
        onClose={() => setIsShareOpen(false)} 
        postData={sharePostData} 
      />
    </div>
  );
}