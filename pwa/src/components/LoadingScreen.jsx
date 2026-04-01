import React, { useState, useEffect } from 'react';
import BananasIcon from './BananasIcon';

const funnyPhrases = [
  "Bebendo água... 💧",
  "Descascando a banana... 🍌",
  "Se tem nome de fruta, é saudável! 🍎",
  "Aquecendo os músculos... 💪",
  "Preparando o shake... 🥤",
  "Ajeitando o fone de ouvido... 🎧",
  "Bora treinar! 🦍",
  "Procurando os pesos... 🏋️‍♂️",
  "Calculando o tempo de descanso... 🧮",
  "Fugindo do leg press... 🏃‍♂️"
];

export default function LoadingScreen() {
  const [phrase, setPhrase] = useState('');
  const [fadeState, setFadeState] = useState('opacity-100');

  useEffect(() => {
    let currentPhrase = funnyPhrases[Math.floor(Math.random() * funnyPhrases.length)];
    setPhrase(currentPhrase);

    const interval = setInterval(() => {
      setFadeState('opacity-0');
      
      setTimeout(() => {
        let newPhrase = currentPhrase;
        
        while (newPhrase === currentPhrase) {
          newPhrase = funnyPhrases[Math.floor(Math.random() * funnyPhrases.length)];
        }
        
        currentPhrase = newPhrase;
        setPhrase(currentPhrase);
        setFadeState('opacity-100');
      }, 300);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505] overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/20 rounded-full blur-[80px] animate-pulse pointer-events-none"></div>
      
      <div className="relative z-10 animate-bounce" style={{ animationDuration: '1.5s' }}>
        <BananasIcon 
          type="filled" 
          size={90} 
          className="drop-shadow-[0_0_30px_rgba(234,179,8,0.5)] animate-pulse" 
        />
      </div>

      <div className="relative z-10 mt-8 flex flex-col items-center gap-2 h-16">
        <p className="text-yellow-500 font-bold tracking-widest uppercase text-[10px] opacity-70">
          Iniciando
        </p>
        <p className={`text-white/90 font-medium text-sm text-center px-8 transition-opacity duration-300 ${fadeState}`}>
          {phrase}
        </p>
      </div>
    </div>
  );
}