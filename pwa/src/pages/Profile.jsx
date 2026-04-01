import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Settings, 
  Grid3X3, 
  ClipboardList, 
  Utensils, 
  Medal, 
  Share2, 
  EyeOff, 
  MessageCircle 
} from 'lucide-react';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Profile() {
  const navigate = useNavigate();
  const { username } = useParams();

  const [user, setUser] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [activeTab, setActiveTab] = useState('photos');
  const [loading, setLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    nome: 'Carregando...',
    username: '',
    foto_perfil: null,
    totalPosts: 0,
    posicao: '-',
    bio: 'Focado nos treinos! 💪',
    instagram: null,
    posts: [],
    archivedPosts: [] 
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('gym_user');

    if (!storedUser) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    if (username && username !== parsedUser.username) {
      setIsOwnProfile(false);
      fetchUserProfile(username, true);
    } else {
      setIsOwnProfile(true);
      fetchUserProfile(parsedUser.cpf, false);
    }
  }, [navigate, username]);

  const fetchUserProfile = async (identifier, isUsername) => {
    setLoading(true);

    try {
      const endpoint = `${API_URL}/api/gym/profile/${identifier}?type=${isUsername ? 'username' : 'cpf'}`;
      const res = await axios.get(endpoint);

      const totalGeralDePosts = (res.data.posts?.length || 0) + (res.data.archivedPosts?.length || 0);

      setProfileData((prev) => ({
        ...prev,
        ...res.data,
        totalPosts: totalGeralDePosts,
        posicao: (res.data.posicao === 'Sem Rank' || !res.data.posicao) ? '-' : res.data.posicao,
      }));
    } catch (err) {
      console.warn("Erro ao buscar perfil.");
      toast.error("Perfil não encontrado.");
      
      if (isUsername) {
        navigate('/feed');
      }
    } finally {
      setLoading(false);
      
      setTimeout(() => {
        const savedPosition = sessionStorage.getItem(`scroll_pos_${window.location.pathname}`);
        if (savedPosition) {
          window.scrollTo({ top: parseInt(savedPosition, 10), behavior: 'instant' });
        }
      }, 50);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/${profileData.username}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Perfil de ${profileData.nome} no Banana's Gym`,
        url: url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link do perfil copiado para a área de transferência!');
    }
  };

  if (!user) return null;

  return (
    <div className="w-full relative overflow-x-hidden min-h-screen pb-8 bg-[#050505] animate-page-transition">
      <header className="px-5 pt-6 pb-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="relative shrink-0">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-black/80 overflow-hidden">
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
              onClick={handleShare}
              className="text-white/50 hover:text-white transition-colors p-1.5 bg-white/5 rounded-full shrink-0"
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
                onClick={() => navigate('/inbox')}
                className="text-white/50 hover:text-yellow-500 active:scale-90 transition-all p-1.5 bg-white/5 rounded-full shrink-0"
                title="Mandar Mensagem"
              >
                <MessageCircle size={16} />
              </button>
            )}
          </div>

          <p className="text-sm font-bold text-yellow-500 mb-2">
            @{profileData.username || '...'}
          </p>
          <p className="text-sm text-white/80 leading-relaxed mb-2">
            {profileData.bio}
          </p>

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
            loading ? (
              <div className="p-4 text-center text-white/50 text-sm">Carregando posts...</div>
            ) : profileData.posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-50">
                <div className="w-16 h-16 mb-4 bg-white/5 rounded-full flex items-center justify-center">
                  <span className="text-2xl grayscale">📷</span>
                </div>
                <p className="text-sm font-bold">Nenhum post registrado ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                {profileData.posts.map((post) => (
                  <div
                    key={post.id}
                    className="aspect-[4/5] bg-white/5 relative group cursor-pointer"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <img
                      src={`${API_URL}${post.foto_treino_url}`}
                      alt="Post"
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                  </div>
                ))}
              </div>
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
            loading ? (
              <div className="p-4 text-center text-white/50 text-sm">Carregando arquivados...</div>
            ) : profileData.archivedPosts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-50 text-center px-6">
                <EyeOff size={48} className="mb-4 text-white/30" />
                <h3 className="text-lg font-bold text-yellow-500 mb-2">Nenhum item arquivado</h3>
                <p className="text-sm">Os posts que você arquivar aparecerão aqui, visíveis apenas para você.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                {profileData.archivedPosts?.map((post) => (
                  <div
                    key={post.id}
                    className="aspect-[4/5] bg-[#0a0a0a] relative group cursor-pointer"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <img
                      src={`${API_URL}${post.foto_treino_url}`}
                      alt="Archived Post"
                      className="w-full h-full object-cover grayscale opacity-60 transition-all group-hover:opacity-80"
                    />
                    <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full border border-white/10">
                       <EyeOff size={12} className="text-white/70" />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </main>
      </section>
    </div>
  );
}