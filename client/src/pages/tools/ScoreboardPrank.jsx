import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

import prankAsset from '../../assets/prank.webp';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const PRANK_QUESTIONS = [
    {
        pergunta: "QUAL É A MENTIRA?",
        opcoes: [
            { texto: "No Dédalos sempre tem alguém comemorando alguma coisa.", isLie: false },
            { texto: "O Dédalos tem players fiéis que sempre voltam.", isLie: false },
            { texto: "No Dédalos todo mundo pede só um drink e vai embora.", isLie: true }
        ]
    },
    {
        pergunta: "QUAL É A MENTIRA?",
        opcoes: [
            { texto: "Já teve player que esqueceu pertences no Dédalos.", isLie: false },
            { texto: "Já teve player perguntando qual é o drink mais forte.", isLie: false },
            { texto: "Nunca ninguém reclamou de nada no Dédalos.", isLie: true }
        ]
    },
    {
        pergunta: "QUAL É A MENTIRA?",
        opcoes: [
            { texto: "Sempre tem player falando 'hoje eu vou beber pouco'.", isLie: false },
            { texto: "Sempre tem player pedindo a última rodada.", isLie: false },
            { texto: "Todo player respeita a hora de fechar sem insistir.", isLie: true }
        ]
    },
    {
        pergunta: "QUAL É A MENTIRA?",
        opcoes: [
            { texto: "A equipe do Dédalos trabalha para manter o ambiente seguro.", isLie: false },
            { texto: "Os bartenders tentam ser rápidos mesmo quando o bar está cheio.", isLie: false },
            { texto: "A equipe pode ignorar as regras quando quer.", isLie: true }
        ]
    },
    {
        pergunta: "QUAL É A MENTIRA?",
        opcoes: [
            { texto: "Já teve player que fez amizade no Dédalos.", isLie: false },
            { texto: "Já teve player que veio só 'dar uma passada rápida'.", isLie: false },
            { texto: "Todo player que entra quer ir embora cedo.", isLie: true }
        ]
    }
];

const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

export default function ScoreboardPrank() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';

    const [viewState, setViewState] = useState('idle');
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [timeLeft, setTimeLeft] = useState(20);

    const resultTimerRef = useRef(null);

    // ==========================================
    // ROTA NOVA: Aponta para /prank usando os literais
    // ==========================================
    const sendPrankSignal = async (actionStatus) => {
        try {
            await fetch(`${API_URL}/api/scoreboard/prank`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unidade: currentUnit,
                    action: actionStatus
                })
            });
        } catch (e) {
            console.error('[Prank Signal] Falha ao notificar a recepção:', e);
        }
    };
    // ==========================================

    const clearTimers = () => {
        if (resultTimerRef.current) {
            clearTimeout(resultTimerRef.current);
        }
    };

    const resetToIdle = () => {
        setViewState('idle');
        setActiveSessionId(null);
        setCurrentQuestion(null);
        setTimeLeft(20);
    };

    const startGame = () => {
        clearTimers();
        
        const randomQuestionIndex = Math.floor(Math.random() * PRANK_QUESTIONS.length);
        const selectedQuestion = PRANK_QUESTIONS[randomQuestionIndex];
        
        setCurrentQuestion({
            pergunta: selectedQuestion.pergunta,
            opcoes: shuffleArray(selectedQuestion.opcoes)
        });

        setTimeLeft(20);
        setViewState('playing');
        sendPrankSignal('started'); // <-- Sinal de Início
    };

    const handleAnswer = (isLie) => {
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        clearTimers();
        
        if (isLie) {
            setViewState('won');
            sendPrankSignal('won'); // <-- Sinal de Acerto
        } else {
            setViewState('lost');
            sendPrankSignal('lost'); // <-- Sinal de Erro
        }

        resultTimerRef.current = setTimeout(resetToIdle, 5000);
    };

    const handleTimeout = () => {
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        
        clearTimers();
        setViewState('timeout');
        sendPrankSignal('lost'); // <-- Sinal de Erro por tempo esgotado
        
        resultTimerRef.current = setTimeout(resetToIdle, 5000);
    };

    useEffect(() => {
        if (viewState === 'playing' && timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timerId);
        } else if (viewState === 'playing' && timeLeft === 0) {
            handleTimeout();
        }
    }, [viewState, timeLeft]);

    useEffect(() => {
        const localSocket = io(API_URL);

        localSocket.on('checkin:novo', (data) => {
            const isTargetUnit = data?.unidade?.toLowerCase() === currentUnit;

            if (isTargetUnit) {
                if (data.cliente_id) {
                    setActiveSessionId(data.cliente_id);
                }

                setViewState(currentState => {
                    if (currentState !== 'playing') {
                        startGame();
                        return 'playing';
                    }
                    return currentState;
                });
            }
        });

        return () => {
            localSocket.disconnect();
            clearTimers();
        };
    }, [currentUnit]);

    const isPanic = viewState === 'playing' && timeLeft <= 5;

    const getBackgroundColors = () => {
        if (isPanic) {
            return { 
                glow1: 'bg-red-600/40', 
                glow2: 'bg-orange-500/30', 
                border: 'linear-gradient(135deg, #dc2626, #ea580c)' 
            };
        }
        
        switch (viewState) {
            case 'won': 
                return { glow1: 'bg-green-600/30', glow2: 'bg-emerald-500/20', border: 'linear-gradient(135deg, #10b981, #047857)' };
            case 'lost': 
                return { glow1: 'bg-red-700/30', glow2: 'bg-rose-600/20', border: 'linear-gradient(135deg, #e11d48, #9f1239)' };
            case 'timeout': 
                return { glow1: 'bg-neutral-700/40', glow2: 'bg-zinc-600/30', border: 'linear-gradient(135deg, #525252, #3f3f46)' };
            case 'playing': 
                return { glow1: 'bg-purple-600/20', glow2: 'bg-blue-500/10', border: 'linear-gradient(135deg, #9333ea, #3b82f6)' };
            default: 
                return { glow1: 'bg-orange-600/10', glow2: 'bg-yellow-500/5', border: 'linear-gradient(135deg, #ff4d00, #ffcc00)' };
        }
    };

    const colors = getBackgroundColors();
    const progressWidth = (timeLeft / 20) * 100;

    return (
        <div className={`min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-none flex flex-col items-center justify-center p-6 md:p-8 transition-colors ${isPanic ? 'duration-100' : 'duration-1000'}`}>
            <div className={`fixed inset-0 z-0 pointer-events-none transition-all ${isPanic ? 'duration-100 animate-pulse' : 'duration-1000'}`}>
                <div className={`absolute top-[-20%] left-[-20%] w-[800px] h-[800px] ${colors.glow1} rounded-full blur-[120px] animate-float-slow transition-colors duration-500`} />
                <div className={`absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] ${colors.glow2} rounded-full blur-[100px] animate-float-reverse transition-colors duration-500`} />
            </div>

            <main 
                className={`relative z-10 w-full max-w-[700px] h-[85vh] bg-black/60 backdrop-blur-md rounded-[2.5rem] border-[3px] border-transparent bg-clip-padding flex flex-col shadow-2xl transition-all ${isPanic ? 'duration-100' : 'duration-700'}`}
                style={{ borderImage: `${colors.border} 1`, borderRadius: '2.5rem' }}
            >
                {viewState === 'idle' && (
                    <div className="flex-1 flex flex-col justify-between p-8 text-center animate-fade-in h-full">
                        <div className="mt-8">
                            <span className="inline-block py-1 px-3 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs font-bold tracking-widest mb-6">
                                AÇÃO 1º DE ABRIL
                            </span>
                            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-400 mb-2 drop-shadow-sm tracking-tight">
                                2 VERDADES, 1 MENTIRA
                            </h1>
                            <p className="text-lg text-gray-400 font-medium tracking-wide">
                                Prove que você conhece o Dédalos.
                            </p>
                        </div>

                        <div className="flex flex-col items-center justify-center cursor-pointer group" onClick={startGame}>
                            <p className="text-gray-500 text-sm md:text-base mb-6 animate-pulse italic tracking-widest uppercase">
                              ...aguardando o próximo checkin...
                            </p>
                            <img 
                                src={prankAsset} 
                                alt="Dédalos Prank" 
                                className="w-56 h-auto drop-shadow-[0_0_30px_rgba(255,77,0,0.5)] animate-pulse" 
                            />
                        </div>

                        <div className="mb-8 cursor-pointer group" onClick={startGame}>
                            <p className="text-orange-500/90 text-sm md:text-base font-bold tracking-[0.2em] uppercase transition-colors animate-pulse">
                                FAÇA O SEU CHECKIN PARA LIBERAR O GAME!
                            </p>
                        </div>
                    </div>
                )}

                {viewState === 'playing' && currentQuestion && (
                    <div className="flex-1 flex flex-col h-full animate-scale-in relative overflow-hidden">
                        {isPanic && (
                            <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-20">
                                <span className="text-[25rem] font-black text-red-600 animate-ping">
                                    {timeLeft}
                                </span>
                            </div>
                        )}

                        <div className="pt-10 pb-6 px-8 text-center shrink-0 relative z-10">
                            <h1 className="text-3xl md:text-4xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 leading-tight drop-shadow-md">
                                {currentQuestion.pergunta}
                            </h1>
                            <p className="text-gray-400 text-sm mt-3 uppercase tracking-wide font-bold">
                                Encontre e clique na mentira para ganhar:
                            </p>
                        </div>

                        <div className="flex-1 flex flex-col gap-4 px-8 pb-8 justify-center overflow-y-auto custom-scrollbar relative z-10">
                            {currentQuestion.opcoes.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(opt.isLie)}
                                    className={`group relative bg-[#151515] border ${isPanic ? 'border-red-500/30 hover:border-red-500' : 'border-white/10 hover:border-purple-500/50'} rounded-2xl p-6 flex items-center justify-center text-center transition-all duration-200 active:scale-95 shadow-xl hover:-translate-y-1 w-full min-h-[100px]`}
                                >
                                    <span className="relative z-10 block text-lg md:text-xl font-bold text-gray-200 leading-tight px-2 group-hover:text-white drop-shadow-md">
                                        {opt.texto}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="pb-8 px-8 shrink-0 relative z-10">
                            <div className="flex justify-between text-xs font-bold tracking-widest uppercase mb-2">
                                <span className={isPanic ? 'text-red-500 animate-pulse' : 'text-purple-400'}>
                                    {isPanic ? 'RÁPIDO!' : 'Tempo Restante'}
                                </span>
                                <span className={isPanic ? 'text-red-500 animate-pulse text-lg' : 'text-blue-400'}>
                                    00:{timeLeft.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${isPanic ? 'bg-red-600' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}
                                    style={{ width: `${progressWidth}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                )}

                {viewState === 'won' && (
                    <div className="flex-1 flex flex-col justify-center items-center p-8 text-center animate-bounce-in h-full relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                            <div className="w-[200%] h-[200%] bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#10b981_50%,#000000_100%)] animate-spin-slow" />
                        </div>
                        
                        <span className="text-9xl mb-6 drop-shadow-[0_0_40px_rgba(16,185,129,0.8)] animate-pulse relative z-10">
                            🥃
                        </span>
                        <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 mb-4 drop-shadow-lg relative z-10 uppercase tracking-wider">
                            VOCÊ ACERTOU!
                        </h1>
                        <p className="text-xl md:text-2xl text-green-100 font-bold mb-8 relative z-10 bg-black/40 px-6 py-2 rounded-full border border-green-500/30">
                          Desce 1 Shot de Whisky pro meu campeão!
                        </p>
                    </div>
                )}

                {viewState === 'lost' && (
                    <div className="flex-1 flex flex-col justify-center items-center p-8 text-center animate-fade-in h-full relative">
                        <span className="text-8xl mb-6 drop-shadow-[0_0_40px_rgba(225,29,72,0.8)] grayscale animate-pulse">
                            💀
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400 mb-4 drop-shadow-lg uppercase tracking-wider">
                            NÃO FOI DESSA VEZ
                        </h1>
                        <p className="text-lg md:text-xl text-red-200/80 font-medium mb-8 max-w-[80%]">
                            Você errou a mentira, mas o labirinto ainda guarda muitas aventuras.
                        </p>
                    </div>
                )}

                {viewState === 'timeout' && (
                    <div className="flex-1 flex flex-col justify-center items-center p-8 text-center animate-fade-in h-full relative">
                        <span className="text-8xl mb-6 drop-shadow-[0_0_40px_rgba(163,163,163,0.8)] grayscale animate-bounce">
                            ⏳
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neutral-400 to-zinc-500 mb-4 drop-shadow-lg uppercase tracking-wider">
                            O TEMPO ESGOTOU!
                        </h1>
                        <p className="text-lg md:text-xl text-neutral-300/80 font-medium mb-8 max-w-[80%]">
                            Você vacilou e perdeu a chance. Mas não desanime, o labirinto ainda reserva muitas surpresas para a sua noite.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}