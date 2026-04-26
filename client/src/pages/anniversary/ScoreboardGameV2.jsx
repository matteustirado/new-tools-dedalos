import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// CONSTANTES VISUAIS - GOLDEN ERA
const GOLDEN_GLASS = "bg-[#0a0a0a]/90 backdrop-blur-2xl border-2 border-yellow-500/40 shadow-[0_0_50px_rgba(234,179,8,0.15)]";
const GOLDEN_TEXT_GRADIENT = "bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600";

export default function ScoreboardGameV2() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';

    const [config, setConfig] = useState(null);
    const [viewState, setViewState] = useState('idle');
    const [votedOption, setVotedOption] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSessionId, setActiveSessionId] = useState(null);

    const idleTimerRef = useRef(null);
    const successTimerRef = useRef(null);

    const clearTimers = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };

    const startVotingSession = () => {
        clearTimers();
        setViewState('voting');

        idleTimerRef.current = setTimeout(() => {
            setViewState('idle');
            setActiveSessionId(null);
        }, 20000);
    };

    const fetchConfig = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/scoreboard/active/${currentUnit}`, {
                timeout: 5000
            });
            setConfig(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Erro ao buscar config (Tentando reconectar...):", error.message);
            setTimeout(fetchConfig, 3000);
        }
    };

    const handleVote = async (index, optionName) => {
        if (navigator.vibrate) navigator.vibrate(50);
        clearTimers();

        try {
            await axios.post(`${API_URL}/api/scoreboard/vote`, {
                unidade: currentUnit,
                optionIndex: index,
                optionLabel: optionName,
                cliente_id: activeSessionId
            });

            setVotedOption(optionName);
            setViewState('success');

            successTimerRef.current = setTimeout(() => {
                setViewState('idle');
                setVotedOption(null);
                setActiveSessionId(null);
            }, 5000);
        } catch (error) {
            console.error("Erro ao votar:", error);
            setTimeout(() => {
                setViewState('idle');
                setActiveSessionId(null);
            }, 2000);
        }
    };

    useEffect(() => {
        fetchConfig();

        const localSocket = io(API_URL);

        localSocket.on('scoreboard:config_updated', (data) => {
            if (data.unidade === currentUnit.toUpperCase()) {
                fetchConfig();
            }
        });

        localSocket.on('checkin:novo', (data) => {
            const isTargetUnit = data?.unidade?.toLowerCase() === currentUnit;

            if (isTargetUnit) {
                if (data.cliente_id) {
                    setActiveSessionId(data.cliente_id);
                }

                setViewState(currentState => {
                    if (currentState === 'idle' || currentState === 'success') {
                        startVotingSession();
                        return 'voting';
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

    const renderButtonBg = (opt) => {
        const tipo = opt.game_tipo || opt.tipo;
        const valor = opt.game_valor || opt.valor;

        if (tipo !== 'image' || !valor) return null;

        return (
            <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
                <img
                    src={`${API_URL}${valor}`}
                    alt=""
                    className="w-full h-full object-cover object-center opacity-50 grayscale-[0.2] sepia-[0.2]"
                />
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-yellow-500/50 font-black tracking-widest uppercase animate-pulse">
                Iniciando Golden Era...
            </div>
        );
    }

    const gridCols = config?.opcoes.length <= 2 ? 'grid-cols-1' : 'grid-cols-2';

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-none flex flex-col items-center justify-center p-6 md:p-8">
            
            {/* EFEITOS DE FUNDO GOLDEN ERA */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[60vh] font-black text-yellow-500/[0.03] tracking-tighter">7</div>
                <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-yellow-600/10 rounded-full blur-[120px] animate-float-slow" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-yellow-400/5 rounded-full blur-[100px] animate-float-reverse" />
            </div>

            <main 
                className={`relative z-10 w-full max-w-[600px] h-[85vh] rounded-[2.5rem] flex flex-col ${GOLDEN_GLASS}`}
            >
                {/* ESTADO IDLE (Aguardando Check-in) */}
                {viewState === 'idle' && (
                    <div className="flex-1 flex flex-col justify-between p-8 text-center animate-fade-in h-full relative z-10">
                        <div className="mt-8">
                            <h1 className={`text-4xl md:text-5xl font-black mb-2 drop-shadow-lg tracking-tight ${GOLDEN_TEXT_GRADIENT}`}>
                                OLÁ, PLAYER!
                            </h1>
                            <p className="text-lg text-yellow-500/60 font-medium tracking-wide uppercase text-[10px]">
                                Bem-vindo à Era de Ouro
                            </p>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                            <p className="text-yellow-500/40 text-sm md:text-base mb-6 animate-pulse italic tracking-widest uppercase">
                                ...aguardando seu check-in...
                            </p>
                            
                            {/* LOGO DEDALOS - TRAÇADO EM OURO */}
                            <svg className="w-56 h-auto drop-shadow-[0_0_30px_rgba(234,179,8,0.3)]" viewBox="0 0 600 485" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="logo-gradient-gold" x1="0%" y1="100%" x2="0%" y2="0%">
                                        <stop offset="0%" stopColor="#fef08a" />
                                        <stop offset="100%" stopColor="#a16207" />
                                    </linearGradient>
                                </defs>
                                <g fill="none" stroke="url(#logo-gradient-gold)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                                    <path className="animate-draw-logo" d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z" />
                                    <path className="animate-draw-logo delay-100" d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z" />
                                </g>
                            </svg>
                        </div>

                        <div className="mb-8 cursor-pointer group" onClick={startVotingSession}>
                            <p className="text-yellow-500/80 text-sm md:text-base font-black tracking-[0.2em] uppercase group-hover:text-yellow-400 transition-colors animate-pulse drop-shadow-md">
                                Faça seu check-in e libere o game!
                            </p>
                        </div>
                    </div>
                )}

                {/* ESTADO VOTING (Opções na tela) */}
                {viewState === 'voting' && (
                    <div className="flex-1 flex flex-col h-full animate-scale-in relative z-10">
                        <div className="pt-10 pb-6 px-8 text-center shrink-0">
                            <h1 className={`text-3xl md:text-4xl font-black uppercase leading-tight drop-shadow-lg ${GOLDEN_TEXT_GRADIENT}`}>
                                {config?.titulo || 'FAÇA SUA ESCOLHA!'}
                            </h1>
                            <p className="text-yellow-500/60 text-xs mt-3 uppercase tracking-[0.2em] font-bold">
                                Escolha a sua vibe desta noite:
                            </p>
                        </div>

                        <div className={`flex-1 grid ${gridCols} gap-6 px-8 pb-8 content-center overflow-y-auto custom-scrollbar`}>
                            {config?.opcoes.map((opt, idx) => {
                                const gameTipo = opt.game_tipo || opt.tipo;
                                const gameValor = opt.game_valor || opt.valor;

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleVote(idx, opt.nome)}
                                        className="group relative bg-[#0a0a0a] border border-yellow-500/20 hover:border-yellow-500/60 rounded-[2rem] p-4 flex flex-col items-center justify-center gap-3 transition-all duration-300 active:scale-95 shadow-xl hover:shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:-translate-y-1 overflow-hidden"
                                        style={{
                                            minHeight: 'auto',
                                            aspectRatio: config.opcoes.length <= 4 ? '4/3' : '3/2'
                                        }}
                                    >
                                        {renderButtonBg(opt)}
                                        
                                        {/* Overlay para escurecer a imagem e focar no texto e borda */}
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-300 z-0"></div>

                                        <div className="relative z-10 transform group-hover:scale-110 transition-transform duration-300">
                                            {gameTipo === 'emoji' && (
                                                <span className="text-6xl md:text-7xl drop-shadow-2xl filter-none">{gameValor}</span>
                                            )}
                                            {gameTipo === 'none' && (
                                                <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500/50 group-hover:text-yellow-400 group-hover:bg-yellow-500/20 transition-all">
                                                    <span className="material-symbols-outlined text-3xl">touch_app</span>
                                                </div>
                                            )}
                                        </div>

                                        <span className="relative z-10 block text-base md:text-lg font-black text-yellow-500/80 uppercase leading-tight px-1 group-hover:text-yellow-400 drop-shadow-md tracking-widest mt-2">
                                            {opt.nome}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pb-6 text-center shrink-0">
                            <button 
                                onClick={() => {
                                    clearTimers();
                                    setViewState('idle');
                                    setActiveSessionId(null);
                                }} 
                                className="text-[10px] text-yellow-500/30 uppercase tracking-widest font-bold hover:text-yellow-500/60 transition-colors py-2 px-4 border border-transparent hover:border-yellow-500/20 rounded-lg"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* ESTADO SUCCESS (Voto Confirmado) */}
                {viewState === 'success' && (
                    <div className="flex-1 flex flex-col justify-between items-center p-8 text-center animate-fade-in h-full relative z-10">
                        <div className="mt-12">
                            <h1 className={`text-4xl md:text-5xl font-black mb-2 drop-shadow-lg ${GOLDEN_TEXT_GRADIENT}`}>
                                ISSO AÍ!
                            </h1>
                            <p className="text-sm text-yellow-500/60 font-bold uppercase tracking-widest">As portas do labirinto estão abertas.</p>
                        </div>

                        <div className="flex-1 flex items-center justify-center">
                            <svg className="w-64 h-auto drop-shadow-[0_0_40px_rgba(234,179,8,0.5)]" viewBox="0 0 600 485" xmlns="http://www.w3.org/2000/svg">
                                <g fill="none" stroke="#eab308" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z" />
                                    <path d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z" />
                                </g>
                            </svg>
                        </div>

                        <div className="mb-10 w-full max-w-xs mx-auto">
                            <p className="text-yellow-500/50 text-[10px] uppercase tracking-[0.3em] font-black mb-2">Voto Computado:</p>
                            <p className={`text-2xl font-black mb-6 drop-shadow-md truncate px-4 ${GOLDEN_TEXT_GRADIENT}`}>
                                "{votedOption}"
                            </p>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-yellow-500/20">
                                <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-200 animate-progress-shrink origin-left w-full" />
                            </div>
                            <p className="text-sm font-bold text-yellow-500/80 mt-6 tracking-widest uppercase">Uma noite inesquecível espera por você.</p>
                        </div>
                    </div>
                )}
            </main>

            <div className="mt-8 text-center text-[10px] text-yellow-500/30 tracking-widest uppercase font-bold z-10">
                <p>© 7 YEARS OF DEDALOS • DEVELOPED BY <span className="text-yellow-500/60 font-black">MATTEUS TIRADO</span></p>
            </div>

            <style>{`
                @keyframes draw-logo {
                    to { stroke-dashoffset: 0; }
                }
                .animate-draw-logo {
                    stroke-dasharray: 4000;
                    stroke-dashoffset: 4000;
                    animation: draw-logo 4s ease-in-out forwards infinite alternate;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(234,179,8,0.3); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(234,179,8,0.5); }
            `}</style>
        </div>
    );
}