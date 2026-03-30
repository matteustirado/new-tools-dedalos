import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Medal, Hammer } from 'lucide-react';

export default function Badges() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-x-hidden">
      
      <header className="flex items-center p-4 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-black tracking-tight ml-4">Quadro de Emblemas</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in-up mt-[-10vh]">
        <div className="w-32 h-32 bg-yellow-500/10 rounded-full flex items-center justify-center mb-8 border-4 border-yellow-500/20 relative shadow-[0_0_50px_rgba(250,204,21,0.1)]">
          <Medal size={64} className="text-yellow-500" strokeWidth={1.5} />
          
          <div className="absolute -bottom-2 -right-2 bg-[#111] p-2.5 rounded-full border border-white/10 shadow-lg">
            <Hammer size={24} className="text-white/60" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Em Construção 🚧</h2>
        
        <p className="text-white/60 leading-relaxed max-w-xs text-sm">
          Nossos ferreiros estão forjando os emblemas mais pesados para você exibir no seu perfil. Continue treinando e volte em breve! 🦍🍌
        </p>

        <button
          onClick={() => navigate(-1)}
          className="mt-10 bg-white/5 border border-white/10 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-white/10 transition-colors active:scale-95"
        >
          Voltar para o Perfil
        </button>
      </main>
      
    </div>
  );
}