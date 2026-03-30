import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { MapPin, Heart, MessageCircle } from 'lucide-react';

import BananasIcon from '../components/BananasIcon';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const getTimeAgo = (dateString) => {
  const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
  
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  
  return `${Math.floor(diff / 86400)}d atrás`;
};

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [bananadPosts, setBananadPosts] = useState(new Set());

  useEffect(() => {
    const storedUser = localStorage.getItem('gym_user');
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/gym/feed?limit=20`);
      setPosts(data);
    } catch (err) {
      toast.error('Erro ao carregar o feed.');
    } finally {
      setLoading(false);
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
            likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1 
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

  const handleBanana = (checkinId) => {
    if (!user) return;
    
    const isBananad = bananadPosts.has(checkinId);
    const newBananad = new Set(bananadPosts);
    
    if (isBananad) {
      newBananad.delete(checkinId);
    } else {
      newBananad.add(checkinId);
    }
    
    setBananadPosts(newBananad);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 pt-20 w-full relative overflow-x-hidden">
      <div className="fixed top-[10%] left-[-20%] w-[70%] h-[50%] bg-yellow-500/[0.03] rounded-full blur-[120px] pointer-events-none"></div>

      {loading ? (
        <div className="space-y-2 mt-2 w-full px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white/5 h-[500px] w-full rounded-xl"></div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-50 px-4">
          <div className="w-24 h-24 mb-4 bg-white/5 rounded-full flex items-center justify-center">
            <span className="text-4xl grayscale">🍌</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Feed Vazio</h2>
          <p className="text-sm px-8">Seja o primeiro a treinar hoje e inaugure o feed!</p>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full pb-8">
          {posts.map((post) => {
            const userName = post.colaborador_username || post.colaborador_nome.split(' ')[0].toLowerCase();
            const profileUrl = `/${userName}`;

            return (
              <article key={post.id} className="w-full bg-transparent border-b border-white/10 mb-8 pb-4">
                <div className="w-full aspect-[4/5] bg-[#111] relative">
                  <img 
                    src={`${API_URL}${post.foto_treino_url}`} 
                    alt="Treino" 
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute top-0 left-0 w-full p-4 px-5 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex justify-between items-start z-10">
                    <Link to={profileUrl} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-black/80 overflow-hidden border border-white/30 shadow-lg shrink-0">
                        {post.colaborador_foto ? (
                          <img 
                            src={`${API_URL}${post.colaborador_foto}`} 
                            className="w-full h-full object-cover" 
                            alt={userName} 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/50 text-xs font-bold">
                            {(post.colaborador_username || post.colaborador_nome).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      <div className="drop-shadow-md">
                        <h3 className="font-bold text-sm text-white leading-tight drop-shadow-md">
                          @{userName}
                        </h3>
                        <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-1 mt-0.5 drop-shadow-md">
                          <MapPin size={10} className="drop-shadow-md" /> 
                          {post.unidade || 'Academia não informada'}
                        </p>
                      </div>
                    </Link>

                    <span className="text-[10px] text-white/90 font-bold uppercase drop-shadow-md mt-1 bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">
                      {getTimeAgo(post.created_at)}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-4 flex items-center gap-6 z-20 relative">
                  <button 
                    onClick={() => handleBanana(post.id)}
                    className="flex items-center gap-1.5 active:scale-75 transition-transform"
                  >
                    <BananasIcon 
                      type={bananadPosts.has(post.id) ? 'filled' : 'outline'} 
                      size={28} 
                    />
                    <span className="text-sm font-black text-white/80">
                      {bananadPosts.has(post.id) ? '+1' : '0'}
                    </span>
                  </button>

                  <button 
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 active:scale-75 transition-transform"
                  >
                    <Heart 
                      size={28} 
                      className={`transition-colors duration-300 ${likedPosts.has(post.id) ? 'fill-pink-500 text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'fill-transparent text-white/80 stroke-[1.5px]'}`} 
                    />
                    <span className="text-sm font-black text-white/80">
                      {post.likes_count}
                    </span>
                  </button>

                  <button 
                    className="flex items-center gap-1.5 text-white/80 hover:text-blue-400 active:scale-75 transition-transform"
                    onClick={() => toast.info('Comentários na versão 1.1! 🚧')}
                  >
                    <MessageCircle size={28} className="stroke-[1.5px]" />
                    <span className="text-sm font-black">
                      {post.comments_count}
                    </span>
                  </button>
                </div>

                {post.mensagem && (
                  <div className="px-5 pb-2">
                    <p className="text-sm text-white/90 leading-relaxed">
                      <Link to={profileUrl} className="font-black mr-2 text-white hover:text-yellow-400 transition-colors">
                        @{userName}
                      </Link>
                      <span className="opacity-90">{post.mensagem}</span>
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}