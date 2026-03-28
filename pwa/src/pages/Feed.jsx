import React, { useState, useEffect } from 'react';
import { MessageCircle, MapPin, Clock } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import PostCard from '../components/PostCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/gym/feed`);
      setPosts(res.data);
    } catch (err) {
      toast.error('Erro ao carregar o feed de treinos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleLike = (postId, type) => {
    toast.info(`Você enviou um(a) ${type === 'banana' ? '🍌' : '❤️'}!`);
  };

  const handleComment = (postId) => {
    toast.info('Área de comentários em construção! 💬');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
        <p className="text-yellow-500/50 font-medium animate-pulse">A carregar os treinos...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2">
      {posts.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center mt-10 shadow-xl backdrop-blur-sm">
          <span className="text-6xl mb-4 block drop-shadow-md">💪</span>
          <h2 className="text-xl font-black text-white mb-2">O Feed está vazio!</h2>
          <p className="text-white/60 text-sm">
            Seja o primeiro monstro a registar um check-in no Banana's Gym! Clique no <strong className="text-yellow-400">+</strong> lá em cima.
          </p>
        </div>
      )}

      {posts.map((post) => (
        <PostCard 
          key={post.id} 
          post={post} 
          onLike={handleLike}
          onComment={handleComment}
        />
      ))}
      
      {posts.length > 0 && (
        <div className="text-center py-6">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest">
            Você viu todos os treinos! 🍌
          </p>
        </div>
      )}
    </div>
  );
}