import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Send, CornerDownRight, Crown, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'react-toastify';

import api from '../services/api';
import { getSocket } from '../socket';

export default function CreateComments({ isOpen, onClose, post, currentUser, onCommentAdded, onCommentDeleted }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [translateY, setTranslateY] = useState('translate-y-full');
  
  const inputRef = useRef(null);
  const timeouts = useRef([]);

  const [startY, setStartY] = useState(null);
  const [currentY, setCurrentY] = useState(0);

  const fetchComments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const identifier = post.post_slug || post.id; 
      const res = await api.get(`/api/gym/post/${identifier}`);
      setComments(res.data.comments || []);
    } catch (err) {
      console.error(err);
      if (!silent) toast.error('Erro ao carregar comentários.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [post]);

  useEffect(() => {
    if (isOpen) {
      const currentScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${currentScrollY}px`;
      document.body.style.width = '100%';
      
      const t = setTimeout(() => setTranslateY('translate-y-0'), 10);
      timeouts.current.push(t);

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, currentScrollY);
        timeouts.current.forEach(clearTimeout);
        timeouts.current = [];
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && post) {
      fetchComments();
      setCurrentY(0);
    } else {
      setComments([]);
      setReplyingTo(null);
      setNewComment('');
    }
  }, [isOpen, post, fetchComments]);

  useEffect(() => {
    if (!isOpen || !post) return;
    
    const socket = getSocket();

    const handleNewComment = (data) => {
      if (data.checkin_id === post.id && data.colaborador_cpf !== currentUser?.cpf) {
        fetchComments(true);
      }
    };

    socket.on('gym:new_comment', handleNewComment);

    return () => {
      socket.off('gym:new_comment', handleNewComment);
    };
  }, [isOpen, post, currentUser, fetchComments]);

  const handleClose = () => {
    setTranslateY('translate-y-full');
    const t = setTimeout(() => {
      onClose();
      setNewComment('');
      setReplyingTo(null);
    }, 300);
    timeouts.current.push(t);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser || !post) return;

    setSending(true);
    try {
      const payload = {
        checkin_id: post.id,
        texto: newComment,
        parent_id: replyingTo ? replyingTo.id : null 
      };

      const res = await api.post('/api/gym/comment', payload);

      const newCommentObj = {
        id: res.data.comment_id,
        texto: newComment,
        username: currentUser.username,
        foto_perfil: currentUser.foto_perfil,
        created_at: new Date().toISOString(),
        parent_id: replyingTo ? replyingTo.id : null,
        colaborador_cpf: currentUser.cpf
      };

      setComments([...comments, newCommentObj]);
      setNewComment('');
      setReplyingTo(null);
      
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar comentário.');
    } finally {
      setSending(false);
    }
  };

  const handleReplyClick = (commentId, username) => {
    setReplyingTo({ id: commentId, username });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleDeleteComment = async (commentId) => {
    if (!currentUser) return;
    
    const prevComments = [...comments];
    setComments(current => current.filter(c => c.id !== commentId && c.parent_id !== commentId));

    try {
      await api.delete(`/api/gym/comment/${commentId}`);
      
      if (onCommentDeleted) {
        onCommentDeleted();
      }
    } catch (err) {
      console.error(err);
      setComments(prevComments);
      toast.error(err.response?.data?.error || "Erro de conexão ao apagar o comentário.");
    }
  };

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!startY) return;
    const y = e.touches[0].clientY;
    const diff = y - startY;
    
    if (diff > 0) {
      setCurrentY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 80) {
      handleClose();
    }
    setStartY(null);
    setCurrentY(0);
  };

  if (!isOpen || !post) return null;

  const parentComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);
  const isOwnerOfPost = currentUser?.cpf === post.colaborador_cpf;

  const AuthorBadge = () => (
    <span className="bg-yellow-500/20 text-yellow-500 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider ml-2">
      <Crown size={10} strokeWidth={3} /> Autor
    </span>
  );

  const MAX_COMMENT_CHARS = 2200;
  const charsLeft = MAX_COMMENT_CHARS - newComment.length;
  let counterColor = 'text-white/30';
  if (charsLeft <= 20) counterColor = 'text-red-500 font-bold';

  return createPortal(
    <div 
      className="fixed inset-0 z-[300] flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      onClick={handleClose}
    >
      <div 
        className={`bg-[#111] rounded-t-3xl w-full max-w-md mx-auto flex flex-col h-[75vh] border-t border-white/10 transition-transform duration-300 ease-out ${translateY}`}
        style={{ transform: `translateY(calc(${translateY === 'translate-y-0' ? '0px' : '100%'} + ${currentY}px))` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="flex flex-col items-center pt-4 pb-4 border-b border-white/10 shrink-0 cursor-grab active:cursor-grabbing px-6"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
          <div className="flex justify-between items-center w-full">
            <h3 className="text-lg font-black text-white">Comentários</h3>
            <button onClick={handleClose} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {post.mensagem && (
            <div className="flex gap-3 pb-6 border-b border-white/5">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-yellow-500/50 overflow-hidden shrink-0">
                {post.colaborador_foto ? (
                  <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${post.colaborador_foto}`} alt="Autor" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                    {(post.colaborador_username || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <span className="text-sm font-bold text-white">@{post.colaborador_username}</span>
                  <AuthorBadge />
                </div>
                <p className="text-sm text-white/80 leading-relaxed">{post.mensagem}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={32} className="text-yellow-500 animate-spin" />
            </div>
          ) : parentComments.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              <MessageCircle size={40} className="mx-auto mb-3 text-white/30" />
              <p className="text-sm font-bold text-white">Nenhum comentário ainda.</p>
              <p className="text-xs text-white/60">Seja o primeiro a interagir!</p>
            </div>
          ) : (
            <div className="space-y-5 pb-4">
              {parentComments.map((comment) => {
                const isAuthor = comment.username === post.colaborador_username;
                const replies = getReplies(comment.id);
                const canDelete = isOwnerOfPost || currentUser?.cpf === comment.colaborador_cpf;

                return (
                  <div key={comment.id} className="animate-fade-in">
                    <div className="flex gap-3">
                      <Link to={`/${comment.username}`} onClick={handleClose} className="w-8 h-8 rounded-full bg-white/10 border border-white/20 overflow-hidden shrink-0 mt-1">
                        {comment.foto_perfil ? (
                          <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${comment.foto_perfil}`} alt={comment.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold">
                            {comment.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center mb-0.5">
                          <Link to={`/${comment.username}`} onClick={handleClose} className="text-xs font-bold text-white/90 mr-2">
                            @{comment.username}
                          </Link>
                          {isAuthor && <AuthorBadge />}
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed mb-1 break-words">{comment.texto}</p>
                        
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleReplyClick(comment.id, comment.username)}
                            className="text-[11px] font-bold text-white/40 hover:text-yellow-500 transition-colors"
                          >
                            Responder
                          </button>
                          
                          {canDelete && (
                            <button 
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-[11px] font-bold text-red-500/60 hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                              Apagar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {replies.length > 0 && (
                      <div className="mt-3 space-y-4">
                        {replies.map(reply => {
                          const isReplyAuthor = reply.username === post.colaborador_username;
                          const canDeleteReply = isOwnerOfPost || currentUser?.cpf === reply.colaborador_cpf;

                          return (
                            <div key={reply.id} className="flex gap-3 pl-11 relative">
                              <div className="absolute left-6 top-[-10px] w-4 h-6 border-b-2 border-l-2 border-white/10 rounded-bl-xl" />
                              <Link to={`/${reply.username}`} onClick={handleClose} className="w-6 h-6 rounded-full bg-white/10 border border-white/20 overflow-hidden shrink-0 mt-1 z-10">
                                {reply.foto_perfil ? (
                                  <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${reply.foto_perfil}`} alt={reply.username} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/50 text-[10px] font-bold">
                                    {reply.username?.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </Link>
                              <div className="flex-1">
                                <div className="flex items-center mb-0.5">
                                  <Link to={`/${reply.username}`} onClick={handleClose} className="text-[11px] font-bold text-white/90 mr-2">
                                    @{reply.username}
                                  </Link>
                                  {isReplyAuthor && <AuthorBadge />}
                                </div>
                                <p className="text-xs text-white/80 leading-relaxed break-words">{reply.texto}</p>
                                
                                {canDeleteReply && (
                                  <button 
                                    onClick={() => handleDeleteComment(reply.id)}
                                    className="text-[10px] font-bold text-red-500/60 hover:text-red-500 transition-colors mt-1 block"
                                  >
                                    Apagar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#050505] border-t border-white/10 p-4 shrink-0 flex flex-col relative pb-8">
          <div className={`absolute -top-5 right-4 text-[9px] uppercase tracking-wider ${counterColor}`}>
            {newComment.length} / {MAX_COMMENT_CHARS}
          </div>

          {replyingTo && (
            <div className="flex items-center justify-between bg-white/5 rounded-t-xl px-4 py-2 -mt-4 mb-3 border-x border-t border-white/5">
              <span className="text-xs text-white/60 flex items-center gap-1.5">
                <CornerDownRight size={14} className="text-yellow-500" />
                Respondendo a <strong className="text-white">@{replyingTo.username}</strong>
              </span>
              <button onClick={() => setReplyingTo(null)} className="text-white/40 hover:text-white p-1 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 overflow-hidden shrink-0">
              {currentUser?.foto_perfil ? (
                <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${currentUser.foto_perfil}`} alt="Você" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 font-bold text-sm">
                  {currentUser?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              maxLength={MAX_COMMENT_CHARS}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyingTo ? "Escreva sua resposta..." : "Adicione um comentário..."}
              className={`flex-1 bg-white/5 border border-white/10 py-3 px-4 text-sm text-white focus:border-yellow-500 focus:bg-white/10 outline-none transition-all ${replyingTo ? 'rounded-b-2xl rounded-tr-2xl' : 'rounded-full'}`}
            />
            
            <button 
              type="submit" 
              disabled={!newComment.trim() || sending}
              className="p-3 bg-yellow-500 text-black rounded-full hover:bg-yellow-400 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30 transition-all active:scale-95"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}