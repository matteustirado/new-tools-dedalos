import React from 'react';
import { MessageCircle, Wrench } from 'lucide-react';

export default function Inbox() {
  return (
    <div className="w-full relative overflow-x-hidden min-h-screen pb-24 bg-[#050505] flex flex-col">
      
      <header className="px-5 pt-6 pb-4 border-b border-white/10 sticky top-0 bg-[#050505]/95 backdrop-blur-xl z-20">
        <h1 className="text-xl font-black text-white tracking-tight">Caixa de Entrada</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in-up mt-[-5vh]">
        <div className="w-32 h-32 bg-yellow-500/10 rounded-full flex items-center justify-center mb-8 border-4 border-yellow-500/20 relative shadow-[0_0_50px_rgba(250,204,21,0.1)]">
          <MessageCircle size={64} className="text-yellow-500" strokeWidth={1.5} />
          
          <div className="absolute -bottom-2 -right-2 bg-[#111] p-2.5 rounded-full border border-white/10 shadow-lg">
            <Wrench size={24} className="text-white/60" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Em Construção 🚧</h2>
        
        <p className="text-white/60 leading-relaxed max-w-xs text-sm">
          O correio elegante do Banana's Gym está sendo preparado! Em breve você poderá mandar mensagens diretas e convidar a galera para treinar. 🦍💬
        </p>
      </main>
      
    </div>
  );
}