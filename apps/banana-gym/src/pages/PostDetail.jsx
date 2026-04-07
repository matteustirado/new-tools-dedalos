import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Heart, MessageCircle, MoreVertical, Edit2, Archive, MapPin, Share2, Eye } from 'lucide-react';
import { toast } from 'react-toastify';

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

  const handleLike = async () => {
    if (!currentUser || !post) return;
    
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-yellow-500">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) return null;

  const isMyPost = currentUser?.cpf === post.colaborador_cpf;

  const formattedDate = new Date(post.created_at).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="w-full relative text-white">
      <main className="flex-1 flex flex-col pb-6">
        <div className="p-4 flex items-center justify-between">
          <Link to={`/${post.colaborador_username}`} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 overflow-hidden">
              {post.colaborador_foto ? (
                <img src={`${API_URL}${post.colaborador_foto}`} alt={post.colaborador_nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 font-bold">
                  {post.colaborador_username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">@{post.colaborador_username}</p>
              <p className="text-[10px] text-yellow-500 font-semibold flex items-center gap-1 mt-0.5 uppercase tracking-widest">
                <MapPin size={10} /> 
                {post.unidade || 'Academia não informada'}
              </p>
            </div>
          </Link>

          {isMyPost && (
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 bg-transparent rounded-full hover:bg-white/10 transition-colors"
              >
                <MoreVertical size={20} className="text-white/60" />
              </button>
              
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-fade-in">
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

        <div className="w-full aspect-[4/5] bg-[#111] flex items-center justify-center relative">
          <img 
            src={`${API_URL}${post.foto_treino_url}`} 
            alt="Treino" 
            className={`w-full h-full object-cover ${post.arquivado === 1 ? 'grayscale opacity-80' : ''}`} 
          />
          {post.arquivado === 1 && (
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
              <Eye size={14} className="text-white/70" />
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
                <Heart size={26} className={post.likedByMe ? 'fill-red-500 text-red-500' : 'text-white'} />
                <span className="text-sm font-bold text-white">{post.likes_count || 0}</span>
              </button>
              
              <button onClick={() => setIsCommentsOpen(true)} className="flex items-center gap-1.5 transition-transform active:scale-90">
                <MessageCircle size={26} className="text-white" />
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
              <span className="font-bold mr-2 text-white">{post.colaborador_username}</span>
              {post.mensagem}
            </p>
          )}
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-3">
            {formattedDate}
          </p>
        </div>
      </main>

      <CreateComments 
        isOpen={isCommentsOpen} 
        onClose={() => setIsCommentsOpen(false)} 
        post={post} 
        currentUser={currentUser} 
      />
    </div>
  );
}