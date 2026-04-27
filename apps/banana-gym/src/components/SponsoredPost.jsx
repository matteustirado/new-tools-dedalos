import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';

export default function SponsoredPost() {
  const adLoaded = useRef(false);

  useEffect(() => {
    // Garante que o AdSense só será chamado UMA vez por componente, 
    // evitando crashs em re-renderizações do React.
    if (!adLoaded.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        adLoaded.current = true;
      } catch (error) {
        console.error('Erro ao carregar o anúncio do AdSense:', error);
      }
    }
  }, []);

  return (
    <div className="w-full bg-[#111] rounded-3xl border border-white/10 mb-6 overflow-hidden flex flex-col shadow-2xl relative">
      
      {/* Brilho de fundo sutil para destacar que é um conteúdo especial */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />

      {/* Cabeçalho do Post Patrocinado */}
      <div className="flex justify-between items-center p-4 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-yellow-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-tight">
              Parceiros Banana's
            </span>
            <span className="text-yellow-500 font-black text-[10px] tracking-widest uppercase mt-0.5">
              Patrocinado
            </span>
          </div>
        </div>
      </div>

      {/* Corpo do Anúncio (A arte do Google AdSense) */}
      <div className="w-full bg-[#050505] p-3 flex items-center justify-center min-h-[200px] relative z-10">
        
        <ins 
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-format="fluid"
          data-ad-layout-key="+2u+rg+2h-1b-47"
          data-ad-client="ca-pub-6128252974412894"
          data-ad-slot="2637174768"
        />

      </div>
    </div>
  );
}