import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  const handleNavigateHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col items-center justify-center p-4">
      <div className="liquid-glass rounded-xl p-10 flex flex-col items-center max-w-md text-center">
        
        <span className="material-symbols-outlined text-7xl text-primary mb-4">
          route
        </span>
        
        <h1 className="text-5xl font-bold text-white mb-2">
          404
        </h1>
        
        <h2 className="text-xl font-semibold text-white/90 mb-4">
          Página não encontrada
        </h2>
        
        <p className="text-text-muted mb-8 text-sm">
          A rota que você tentou acessar não existe ou está indisponível no momento.
        </p>
        
        <button
          onClick={handleNavigateHome}
          className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors w-full flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">
            home
          </span>
          Voltar para o Início
        </button>
        
      </div>
    </div>
  );
}