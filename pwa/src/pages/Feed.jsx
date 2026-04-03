import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { MapPin, Heart, MessageCircle, Megaphone, Sparkles, Share2, MoreVertical, Edit2, Archive } from 'lucide-react';

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
        if (pageNumber === 1) return data;
        
        const existingIds = new Set(prevPosts.map(p => p.id));
        const newUniquePosts = data.filter(p => !existingIds.has(p.id));
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

  const handleLike = async (checkinId) => {
    if (!user) return;
    
    const isLiked = likedPosts.has(checkinId);
    const newLiked = new Set(likedPosts);
    
    if (isLiked) {
      newLiked.delete(checkinId);
    } else {
      newLiked.add(checkinId);
    }
    
    setLikedPosts(newLiked);
    setPosts((currentPosts) => 
      currentPosts.map((post) => {
        if (post.id === checkinId) {
          return { 
            ...post, 
            likes_count: isLiked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1 
          };
        }
        return post;
      })
    );

    try {
      await axios.post(`${API_URL}/api/gym/like`, {
        checkin_id: checkinId,
        colaborador_cpf: user.cpf
      });
    } catch (err) {
      console.error('Erro ao registrar like.');
    }
  };

  const handleBanana = async (checkinId) => {
    if (!user) return;
    
    const isBananad = bananadPosts.has(checkinId);
    const newBananad = new Set(bananadPosts);
    
    if (isBananad) {
      newBananad.delete(checkinId);
    } else {
      newBananad.add(checkinId);
    }
    
    setBananadPosts(newBananad);
    setPosts((currentPosts) => 
      currentPosts.map((post) => {
        if (post.id === checkinId) {
          return { 
            ...post, 
            bananas_count: isBananad ? Math.max(0, (post.bananas_count || 0) - 1) : (post.bananas_count || 0) + 1 
          };
        }
        return post;
      })
    );

    try {
      await axios.post(`${API_URL}/api/gym/banana`, {
        checkin_id: checkinId,
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
                  <Link to={profileUrl} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0">
                      {post.colaborador_foto ? (
                        <img 
                          src={`${API_URL}${post.colaborador_foto}`} 
                          className="w-full h-full object-cover" 
                          alt={userName} 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-sm text-white leading-tight">
                        @{userName}
                      </h3>
                      <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> 
                        {post.unidade || post.academia_nome || 'Academia não informada'}
                      </p>
                    </div>
                  </Link>

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
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                          <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-fade-in">
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

                <div className="w-full aspect-[4/5] bg-[#111] relative">
                  <img 
                    src={`${API_URL}${post.foto_treino_url}`} 
                    alt="Treino" 
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="px-4 pt-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-5">
                      <button 
                        onClick={() => handleBanana(post.id)}
                        className="flex items-center gap-1.5 active:scale-75 transition-transform"
                      >
                        <BananasIcon type={bananadPosts.has(post.id) ? 'filled' : 'outline'} size={28} />
                        <span className="text-sm font-black text-white/80">
                          {post.bananas_count || 0}
                        </span>
                      </button>

                      <button 
                        onClick={() => handleLike(post.id)}
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

      <CreateComments 
        isOpen={isCommentsOpen} 
        onClose={handleCloseComments} 
        post={selectedPost} 
        currentUser={user} 
      />
    </div>
  );
}