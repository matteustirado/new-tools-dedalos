import React, { useState, useEffect } from 'react';
import { MessageCircle, MapPin, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PostCard({ post, onLike, onComment }) {
  const [infoIndex, setInfoIndex] = useState(0);

  const infos = [
    { 
      id: 'local', 
      icon: MapPin, 
      text: post.academia_nome || `Unidade ${post.unidade}` 
    },
    { 
      id: 'tempo', 
      icon: Clock, 
      text: new Date(post.created_at).toLocaleDateString('pt-BR', { 
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
      }) 
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setInfoIndex((prev) => (prev + 1) % infos.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const avatarUrl = post.colaborador_foto ? `${API_URL}${post.colaborador_foto}` : null;
  const imageUrl = post.foto_treino_url ? `${API_URL}${post.foto_treino_url}` : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden mb-6 shadow-xl">
      <div className="flex items-center p-4 gap-3">
        <div className="w-10 h-10 rounded-full bg-black/50 overflow-hidden border border-white/20 shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={post.colaborador_nome} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined flex items-center justify-center w-full h-full text-white/30 text-lg">
              person
            </span>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col justify-center h-10">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate">{post.colaborador_nome}</span>
            <span className="text-xs" title="Atleta de Destaque">🌟</span>
          </div>

          <div className="relative h-4 mt-0.5 w-full">
            {infos.map((info, idx) => {
              const Icon = info.icon;
              return (
                <div 
                  key={info.id}
                  className={`absolute top-0 left-0 flex items-center gap-1 text-[11px] text-white/50 transition-all duration-500 ease-in-out ${
                    idx === infoIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}
                >
                  <Icon size={12} />
                  <span className="truncate">{info.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full aspect-[4/5] bg-black relative">
        {imageUrl ? (
          <img src={imageUrl} alt="Treino" className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-white/20">Sem foto</div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-4 mb-3">
          <button 
            onClick={() => onLike && onLike(post.id, 'banana')}
            className="flex items-center gap-1.5 hover:scale-110 active:scale-90 transition-transform"
          >
            <span className="text-2xl drop-shadow-md filter grayscale hover:grayscale-0 transition-all">🍌</span>
          </button>

          <button 
            onClick={() => onLike && onLike(post.id, 'heart')}
            className="flex items-center gap-1.5 hover:scale-110 active:scale-90 transition-transform"
          >
            <span className="text-2xl drop-shadow-md filter grayscale hover:grayscale-0 transition-all">❤️</span>
          </button>

          <button 
            onClick={() => onComment && onComment(post.id)}
            className="flex items-center gap-1.5 text-white/80 hover:text-white hover:scale-110 active:scale-90 transition-all ml-2"
          >
            <MessageCircle size={26} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mb-2">
          <span className="text-xs font-bold text-white/80">
            {post.likes_count || 0} reações
          </span>
        </div>

        {post.mensagem && (
          <div className="text-sm">
            <span className="font-bold text-white mr-2">{post.colaborador_nome}</span>
            <span className="text-white/80">{post.mensagem}</span>
          </div>
        )}

        {(post.comments_count > 0) && (
          <button 
            onClick={() => onComment && onComment(post.id)}
            className="text-xs text-white/40 mt-2 hover:text-white/60 transition-colors"
          >
            Ver todos os {post.comments_count} comentários...
          </button>
        )}
      </div>
    </div>
  );
}