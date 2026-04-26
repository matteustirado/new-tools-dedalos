import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Settings, 
  Grid3X3, 
  ClipboardList, 
  Utensils, 
  Medal, 
  Share2, 
  EyeOff, 
  MessageCircle,
  Activity
} from 'lucide-react';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';

import api from '../services/api';
import InviteMenu from '../components/InviteMenu';
import ShareProfile from '../components/ShareProfile';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Profile() {
  const navigate = useNavigate();
  const { username } = useParams();

  const [user] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [activeTab, setActiveTab] = useState('photos');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreArchived, setHasMoreArchived] = useState(true);

  const [isInviteMenuOpen, setIsInviteMenuOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); 
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  const [profileData, setProfileData] = useState({
    nome: 'Carregando...',
    username: '',
    foto_perfil: null,
    totalPosts: 0,
    posicao: '-',
    classificacao: 'Iniciante',
    bio: 'Focado nos treinos! 💪',
    instagram: null,
    posts: [],
    archivedPosts: [] 
  });

  const observer = useRef();
  
  const lastElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (activeTab === 'photos' && hasMorePosts) {
          setPage(prevPage => prevPage + 1);
        } else if (activeTab === 'archived' && hasMoreArchived) {
          setPage(prevPage => prevPage + 1);
        }
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMorePosts, hasMoreArchived, activeTab]);

  const fetchUserProfile = useCallback(async (identifier, isUsername, pageNum) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const limit = pageNum === 1 ? 15 : 9;
      const endpoint = `/api/gym/profile/${identifier}?type=${isUsername ? 'username' : 'cpf'}&page=${pageNum}&limit=${limit}`;
      const res = await api.get(endpoint);

      if (res.data.posts && res.data.posts.length < limit) setHasMorePosts(false);
      if (res.data.archivedPosts && res.data.archivedPosts.length < limit) setHasMoreArchived(false);

      if (pageNum === 1) {
        setProfileData({
          ...res.data,
          totalPosts: res.data.totalCheckins || 0,
          posicao: (res.data.posicao === 'Sem Rank' || !res.data.posicao) ? '-' : res.data.posicao,
        });
      } else {
        setProfileData(prev => {
          const newPosts = res.data.posts ? [...prev.posts, ...res.data.posts] : prev.posts;
          const newArchived = res.data.archivedPosts ? [...prev.archivedPosts, ...res.data.archivedPosts] : prev.archivedPosts;
          
          return {
            ...prev,
            posts: newPosts,
            archivedPosts: newArchived
          };
        });
      }
    } catch (err) {
      console.error(err);
      if (pageNum === 1) {
        toast.error("Perfil não encontrado.");
        if (isUsername) navigate('/feed');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      
      if (pageNum === 1) {
        setTimeout(() => {
          const savedPosition = sessionStorage.getItem(`scroll_pos_${window.location.pathname}`);
          if (savedPosition) {
            window.scrollTo({ top: parseInt(savedPosition, 10), behavior: 'instant' });
          }
        }, 50);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    setPage(1);
    setHasMorePosts(true);
    setHasMoreArchived(true);
    setIsBioExpanded(false); 

    if (username && username !== user.username) {
      setIsOwnProfile(false);
      fetchUserProfile(username, true, 1);
    } else {
      setIsOwnProfile(true);
      fetchUserProfile(user.cpf, false, 1);
    }
  }, [navigate, username, user, fetchUserProfile]);

  useEffect(() => {
    if (page > 1 && user) {
      const isUsername = username && username !== user.username;
      const identifier = isUsername ? username : user.cpf;
      fetchUserProfile(identifier, isUsername, page);
    }
  }, [page, user, username, fetchUserProfile]);

  const getStaticMapUrl = (encodedPolyline) => {
    if (!encodedPolyline) return null;
    try {
        const decoded = polyline.decode(encodedPolyline);
        const simplified = decoded.filter((_, i) => i % 10 === 0);
        let pathStr = "color:0xFC4C02ff|weight:5"; 
        simplified.forEach(point => { pathStr += `|${point[0]},${point[1]}`; });
        const midPoint = decoded[Math.floor(decoded.length / 2)];
        return `https://open.mapquestapi.com/staticmap/v5/map?key=G0y0v5A4PGAgD6b8QY13Oq5t23zR06p0&type=dark&zoom=13&size=300,300&center=${midPoint[0]},${midPoint[1]}&shape=${pathStr}`;
    } catch(e) { 
        console.error(e);
        return null; 
    }
  };

  const renderBio = () => {
    if (!profileData.bio) return null;
    
    const lines = profileData.bio.split('\n');
    const isTooLong = lines.length > 4 || profileData.bio.length > 100;

    if (!isTooLong || isBioExpanded) {
      return (
        <span className="whitespace-pre-line">
          {profileData.bio}
          {isBioExpanded && (
            <button onClick={() => setIsBioExpanded(false)} className="text-white/50 font-bold ml-2 hover:text-white">
              menos
            </button>
          )}
        </span>
      );
    }

    const truncatedLines = lines.slice(0, 3).join('\n');
    const displayBio = truncatedLines.length > 90 ? truncatedLines.substring(0, 90) + "..." : truncatedLines + "...";

    return (
      <span className="whitespace-pre-line">
        {displayBio}
        <button onClick={() => setIsBioExpanded(true)} className="text-white/50 font-bold ml-1 hover:text-white">
          mais
        </button>
      </span>
    );
  };

  if (!user) return null;

  return (
    <div className="w-full relative overflow-x-hidden min-h-screen pb-8 bg-[#050505] animate-page-transition">
      <header className="px-5 pt-6 pb-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="relative shrink-0">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-black/80 overflow-hidden border-2 border-yellow-500/20">
              {profileData.foto_perfil ? (
                <img 
                  src={`${API_URL}${profileData.foto_perfil}`} 
                  alt={profileData.nome} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/50 text-3xl font-black">
                  {profileData.username ? profileData.username.charAt(0).toUpperCase() : profileData.nome.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-1 ml-4 md:ml-6">
            <div className="flex flex-col items-center justify-center">
              <span className="h-8 flex items-center justify-center text-lg md:text-xl font-black text-white leading-none">
                {profileData.totalPosts}
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/60 font-bold mt-1">
                Posts
              </span>
            </div>

            <div 
              className="flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              onClick={() => navigate('/ranking')}
              title="Ver Ranking Completo"
            >
              <span className="h-8 flex items-center justify-center text-lg md:text-xl font-black text-yellow-500 leading-none">
                {profileData.posicao}
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/60 font-bold mt-1">
                Posição
              </span>
            </div>

            <div 
              className="flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform opacity-40 grayscale" 
              onClick={() => navigate('/emblemas')}
              title="Ver Quadro de Emblemas"
            >
              <span className="h-8 flex items-center justify-center">
                <Medal size={22} strokeWidth={2.5} className="text-white" />
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/60 font-bold mt-1">
                Emblemas
              </span>
            </div>
          </div>
        </div>

        <div className="mb-2 mt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-black text-white leading-tight truncate">
              {profileData.nome}
            </h2>

            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="text-white/50 hover:text-white transition-colors p-1.5 bg-white/5 rounded-full shrink-0 active:scale-90"
              title="Compartilhar Perfil"
            >
              <Share2 size={16} />
            </button>

            {isOwnProfile ? (
              <button
                onClick={() => navigate('/edit-profile')}
                className="text-white/50 hover:text-yellow-500 active:scale-90 transition-all p-1.5 bg-white/5 rounded-full shrink-0"
                title="Editar Perfil"
              >
                <Settings size={16} />
              </button>
            ) : (
              <button
                onClick={() => setIsInviteMenuOpen(true)}
                className="text-white/50 hover:text-yellow-500 active:scale-90 transition-all p-1.5 bg-white/5 rounded-full shrink-0"
                title="Convidar"
              >
                <MessageCircle size={16} />
              </button>
            )}
          </div>

          <p className="text-sm font-bold text-yellow-500 mb-2">
            @{profileData.username || '...'}
          </p>
          
          <div className="text-sm text-white/80 leading-relaxed mb-2 break-words">
            {renderBio()}
          </div>

          <p className="text-sm font-bold text-white flex items-center gap-1">
            Instagram:
            {profileData.instagram ? (
              <a 
                href={`https://instagram.com/${profileData.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 cursor-pointer hover:underline transition-colors"
                title={`Acessar instagram de ${profileData.nome}`}
              >
                {profileData.instagram}
              </a>
            ) : (
              <span className="text-white/30 font-normal">-</span>
            )}
          </p>
        </div>
      </header>

      <section className="w-full">
        <nav className="flex items-center justify-around border-b border-white/10">
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex-1 py-3 flex justify-center border-b-2 transition-all duration-300 ${
              activeTab === 'photos' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Grid3X3 size={24} />
          </button>

          <button
            onClick={() => setActiveTab('workouts')}
            className={`flex-1 py-3 flex justify-center border-b-2 transition-all duration-300 ${
              activeTab === 'workouts' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <ClipboardList size={24} />
          </button>

          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex-1 py-3 flex justify-center border-b-2 transition-all duration-300 ${
              activeTab === 'recipes' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Utensils size={24} />
          </button>

          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('archived')}
              className={`flex-1 py-3 flex justify-center border-b-2 transition-all duration-300 ${
                activeTab === 'archived' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <EyeOff size={24} />
            </button>
          )}
        </nav>

        <main className="w-full">
          {activeTab === 'photos' && (
            loading && page === 1 ? (
              <div className="flex justify-center items-center h-48">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profileData.posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-50">
                <div className="w-16 h-16 mb-4 bg-white/5 rounded-full flex items-center justify-center">
                  <span className="text-2xl grayscale">📷</span>
                </div>
                <p className="text-sm font-bold">Nenhum post registrado ainda.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                  {profileData.posts.map((post, index) => {
                    const isLast = profileData.posts.length === index + 1;
                    const isRunPost = post.activity_type === 'RUN'; 
                    const slugOrId = post.post_slug || post.id;

                    return (
                      <div
                        key={post.id}
                        ref={isLast ? lastElementRef : null}
                        className="aspect-[4/5] bg-white/5 relative group cursor-pointer overflow-hidden"
                        onClick={() => navigate(`/${profileData.username}/post/${slugOrId}`)}
                      >
                        {isRunPost ? (
                          <>
                            {post.foto_treino_url ? (
                              <img src={`${API_URL}${post.foto_treino_url}`} alt="Post Corrida" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                            ) : (
                              post.run_polyline && (
                                <img src={getStaticMapUrl(post.run_polyline)} className="w-full h-full object-cover bg-black opacity-80 group-hover:opacity-60 mix-blend-screen transition-opacity" alt="Mapa" />
                              )
                            )}
                            <div className="absolute top-1.5 right-1.5 bg-[#111]/80 backdrop-blur p-1 rounded-md border border-[#FC4C02]/30 shadow-md">
                              <Activity size={12} className="text-[#FC4C02]" />
                            </div>
                          </>
                        ) : (
                          <img src={`${API_URL}${post.foto_treino_url}`} alt="Post" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {loadingMore && (
                  <div className="py-4 flex justify-center w-full">
                    <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            )
          )}

          {activeTab === 'workouts' && (
            <div className="flex flex-col items-center justify-center py-12 opacity-50 text-center px-6">
              <ClipboardList size={48} className="mb-4 text-white/30" />
              <h3 className="text-lg font-bold text-yellow-500 mb-2">Fichas de Treino</h3>
              <p className="text-sm">Em breve as fichas ficarão disponíveis aqui. 🚧</p>
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className="flex flex-col items-center justify-center py-12 opacity-50 text-center px-6">
              <Utensils size={48} className="mb-4 text-white/30" />
              <h3 className="text-lg font-bold text-yellow-500 mb-2">Receitas Fit</h3>
              <p className="text-sm">Em breve as receitas ficarão disponíveis aqui. 🚧</p>
            </div>
          )}

          {activeTab === 'archived' && isOwnProfile && (
            loading && page === 1 ? (
              <div className="flex justify-center items-center h-48">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profileData.archivedPosts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-50 text-center px-6">
                <EyeOff size={48} className="mb-4 text-white/30" />
                <h3 className="text-lg font-bold text-yellow-500 mb-2">Nenhum item arquivado</h3>
                <p className="text-sm">Os posts que você arquivar aparecerão aqui, visíveis apenas para você.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                  {profileData.archivedPosts?.map((post, index) => {
                    const isLast = profileData.archivedPosts.length === index + 1;
                    const isRunPost = post.activity_type === 'RUN'; 
                    const slugOrId = post.post_slug || post.id;

                    return (
                      <div
                        key={post.id}
                        ref={isLast ? lastElementRef : null}
                        className="aspect-[4/5] bg-[#0a0a0a] relative group cursor-pointer overflow-hidden"
                        onClick={() => navigate(`/${profileData.username}/post/${slugOrId}`)}
                      >
                        {isRunPost ? (
                          <>
                            {post.foto_treino_url ? (
                              <img src={`${API_URL}${post.foto_treino_url}`} alt="Archived" className="w-full h-full object-cover grayscale opacity-60 transition-all group-hover:opacity-80" />
                            ) : (
                              post.run_polyline && (
                                <img src={getStaticMapUrl(post.run_polyline)} className="w-full h-full object-cover bg-black grayscale opacity-60 transition-all group-hover:opacity-80 mix-blend-screen" alt="Mapa" />
                              )
                            )}
                            <div className="absolute top-1.5 right-1.5 bg-[#111]/80 backdrop-blur p-1 rounded-md border border-[#FC4C02]/30 shadow-md">
                              <Activity size={12} className="text-[#FC4C02] opacity-60" />
                            </div>
                          </>
                        ) : (
                          <img src={`${API_URL}${post.foto_treino_url}`} alt="Archived Post" className="w-full h-full object-cover grayscale opacity-60 transition-all group-hover:opacity-80" />
                        )}
                        <div className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-full border border-white/10">
                           <EyeOff size={12} className="text-white/70" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {loadingMore && (
                  <div className="py-4 flex justify-center w-full">
                    <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            )
          )}
        </main>
      </section>

      <InviteMenu 
        isOpen={isInviteMenuOpen}
        onClose={() => setIsInviteMenuOpen(false)}
        targetUsername={profileData.username}
        currentUser={user}
      />

      <ShareProfile 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        profileData={profileData} 
        isOwnProfile={isOwnProfile} 
      />
    </div>
  );
}