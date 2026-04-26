import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, MessageCircle, MoreVertical, Edit2, Archive, MapPin, Share2, Eye } from 'lucide-react';
import { toast } from 'react-toastify';

import api from '../services/api';
import BananasIcon from './BananasIcon';
import SharePost from './SharePost';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PostCard({ post, onLike, onBanana, onComment, onArchive }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false); 
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  
  const [currentUser] = useState(() => {
    const stored = localStorage.getItem('gym_user');
    return stored ? JSON.parse(stored) : null;
  });

  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleArchive = async () => {
    setIsMenuOpen(false);
    if (!currentUser || !post) return;
    
    const isArchived = post.arquivado === 1;
    const endpoint = isArchived ? 'unarchive' : 'archive';
    
    try {
      await api.put(`/api/gym/post/${post.id}/${endpoint}`, {
        colaborador_cpf: currentUser.cpf
      });

      if (isArchived) {
        toast.success('Foto desarquivada com sucesso!');
      }

      if (onArchive) {
        onArchive(post.id, !isArchived);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Erro de conexão ao ${isArchived ? 'desarquivar' : 'arquivar'} o post.`);
    }
  };

  const handleEdit = () => {
    setIsMenuOpen(false);
    navigate('/edit-post', { state: { post } });
  };

  const userName = post.colaborador_username || post.colaborador_nome.split(' ')[0].toLowerCase();

  const handleNavigateToPost = () => {
    const slugOrId = post.post_slug || post.id;
    navigate(`/${userName}/post/${slugOrId}`);
  };

  const isMyPost = currentUser?.cpf === post.colaborador_cpf;
  const avatarUrl = post.colaborador_foto ? `${API_URL}${post.colaborador_foto}` : null;
  const imageUrl = post.foto_treino_url ? `${API_URL}${post.foto_treino_url}` : null;

  const formattedDate = new Date(post.created_at).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <article className="w-full bg-transparent border-b border-white/10 mb-0 pb-6 relative">
      <div className="flex items-center justify-between p-4">
        <Link to={`/${userName}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/20 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
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

      <div 
        className="w-full aspect-[4/5] bg-[#111] relative cursor-pointer"
        onClick={handleNavigateToPost}
      >
        {imageUrl ? (
          <>
            <img 
              src={imageUrl} 
              alt="Treino" 
              className={`w-full h-full object-cover ${post.arquivado === 1 ? 'grayscale opacity-80' : ''}`} 
            />
            {post.arquivado === 1 && (
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <Eye size={14} className="text-white/70" />
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Arquivado</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-white/20">
            Sem foto
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-5">
            <button 
              onClick={() => onBanana && onBanana(post.id)}
              className="flex items-center gap-1.5 active:scale-75 transition-transform"
            >
              <BananasIcon type={post.bananadByMe ? 'filled' : 'outline'} size={28} />
              <span className="text-sm font-black text-white/80">
                {post.bananas_count || 0}
              </span>
            </button>

            <button 
              onClick={() => onLike && onLike(post.id)}
              className="flex items-center gap-1.5 active:scale-75 transition-transform"
            >
              <Heart 
                size={26} 
                className={`transition-colors duration-300 ${post.likedByMe ? 'fill-red-500 text-red-500' : 'text-white stroke-[1.5px]'}`} 
              />
              <span className="text-sm font-black text-white/80">
                {post.likes_count || 0}
              </span>
            </button>

            <button 
              className="flex items-center gap-1.5 text-white hover:text-blue-400 active:scale-75 transition-transform"
              onClick={() => onComment && onComment(post)}
            >
              <MessageCircle size={26} className="stroke-[1.5px]" />
              <span className="text-sm font-black">
                {post.comments_count || 0}
              </span>
            </button>
          </div>

          <button 
            onClick={() => setIsShareOpen(true)} 
            className="p-1 text-white/80 hover:text-yellow-500 transition-colors active:scale-90"
          >
            <Share2 size={24} />
          </button>
        </div>

        {post.mensagem && (
          <div className="mb-2">
            <p className="text-sm text-white/90 leading-relaxed break-words">
              <Link to={`/${userName}`} className="font-bold mr-2 text-white hover:text-yellow-400 transition-colors">
                {userName}
              </Link>
              
              {post.mensagem.length > 125 && !isCaptionExpanded ? (
                <>
                  {post.mensagem.substring(0, 125)}...
                  <button 
                    onClick={() => setIsCaptionExpanded(true)}
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

      <SharePost 
        isOpen={isShareOpen} 
        onClose={() => setIsShareOpen(false)} 
        postData={post} 
      />
    </article>
  );
}