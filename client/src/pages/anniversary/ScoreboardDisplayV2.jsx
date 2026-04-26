import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MOVEMENT_MESSAGES } from '../../assets/text/PercentPhrases';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const DEDALOS_CONFIG = {
    sp: {
        socket: import.meta.env.VITE_SOCKET_TRIGGER_SP,
        maxCapacity: 210
    },
    bh: {
        socket: import.meta.env.VITE_SOCKET_TRIGGER_BH,
        maxCapacity: 160
    }
};

// CONSTANTES VISUAIS - GOLDEN ERA
const GOLDEN_GLASS = "bg-[#0a0a0a]/90 backdrop-blur-2xl border-2 border-yellow-500/40 shadow-[0_0_50px_rgba(234,179,8,0.15)]";
const GOLDEN_TEXT_GRADIENT = "bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600";

export default function ScoreboardDisplayV2() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';
    const legacyConfig = DEDALOS_CONFIG[currentUnit] || DEDALOS_CONFIG.sp;

    const [config, setConfig] = useState(null);
    const [votes, setVotes] = useState([]);
    const [crowdCount, setCrowdCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Emoji:wght@300..700&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        return () => {
            if (document.head.contains(link)) {
                document.head.removeChild(link);
            }
        };
    }, []);

    useEffect(() => {
        fetchLocalConfig();
        fetchExternalCrowdCount();

        const localSocket = io(API_URL);

        localSocket.on('scoreboard:vote_updated', (data) => {
            if (data?.unidade?.toLowerCase() === currentUnit) {
                setVotes(data.votes);
            }
        });

        localSocket.on('scoreboard:config_updated', (data) => {
            if (data.unidade.toLowerCase() === currentUnit) {
                fetchLocalConfig();
            }
        });

        localSocket.on('checkin:novo', (data) => {
            if (data.unidade.toLowerCase() === currentUnit) {
                setCrowdCount(data.total);
            }
        });

        const externalSocket = io(legacyConfig.socket, {
            transports: ['websocket', 'polling']
        });

        externalSocket.on('new_id', () => {
            fetchExternalCrowdCount();
        });

        const crowdInterval = setInterval(fetchExternalCrowdCount, 30000);

        return () => {
            localSocket.disconnect();
            externalSocket.disconnect();
            clearInterval(crowdInterval);
        };
    }, [currentUnit]);

    const fetchLocalConfig = async () => {
        try {
            const [configRes, votesRes] = await Promise.all([
                axios.get(`${API_URL}/api/scoreboard/active/${currentUnit}`),
                axios.get(`${API_URL}/api/scoreboard/votes/${currentUnit}`)
            ]);
            setConfig(configRes.data);
            setVotes(votesRes.data || []);
            setLoading(false);
        } catch (error) {
            setTimeout(fetchLocalConfig, 5000);
        }
    };

    const fetchExternalCrowdCount = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/scoreboard/crowd/${currentUnit}`);
            const data = response.data;

            let count = 0;
            if (typeof data === 'number') {
                count = data;
            } else if (data.count !== undefined) {
                count = data.count;
            } else if (Array.isArray(data) && data.length > 0) {
                count = data[0].contador;
            } else if (data.contador) {
                count = data.contador;
            }

            setCrowdCount(count);
        } catch (error) {
            console.error("Erro ao buscar lotação:", error);
        }
    };

    const processedOptions = useMemo(() => {
        if (!config?.opcoes) return [];

        const votesMap = {};
        if (Array.isArray(votes)) {
            votes.forEach(v => {
                votesMap[v.option_index] = v.count;
            });
        }

        const totalVotes = Object.values(votesMap).reduce((acc, curr) => acc + Number(curr), 0);

        const options = config.opcoes.map((opt, idx) => {
            const count = Number(votesMap[idx]) || 0;
            const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            // A cor customizada ainda é respeitada (caso venha do admin), mas será ofuscada pelo vidro negro
            const color = opt.cor || '#eab308'; 
            return { ...opt, count, percentage, color };
        });

        return options.sort((a, b) => b.count - a.count);
    }, [config, votes]);

    const crowdPercentage = Math.min((crowdCount / legacyConfig.maxCapacity) * 100, 100);

    const getMovementMessage = (pct) => {
        const rounded = Math.floor(pct / 5) * 5;
        const keys = Object.keys(MOVEMENT_MESSAGES).map(Number).sort((a, b) => b - a);

        for (const key of keys) {
            if (rounded >= key) return MOVEMENT_MESSAGES[key];
        }
        return MOVEMENT_MESSAGES[0];
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] text-yellow-500 flex items-center justify-center font-black tracking-widest uppercase animate-pulse text-2xl drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                CARREGANDO ERA DE OURO...
            </div>
        );
    }

    const isLandscape = config?.layout === 'landscape';

    const getBarStyle = (color) => ({
        background: `linear-gradient(135deg, ${color}CC 0%, ${color}40 100%)`,
        boxShadow: `inset 0 0 30px rgba(0,0,0,0.8)`,
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 0
    });

    const getEmojiStyle = () => ({
        fontFamily: '"Noto Emoji", sans-serif',
        color: '#ffffff',
        filter: 'drop-shadow(0 0 15px rgba(250,204,21,0.4))'
    });

    const renderOptionImage = (opt) => {
        const tipo = opt.display_tipo || opt.tipo;
        const valor = opt.display_valor || opt.valor;

        if (tipo !== 'image' || !valor) return null;

        const imageUrl = `${API_URL}${valor}`;
        const maskStyle = {
            maskImage: isLandscape ? 'linear-gradient(to top, black 70%, transparent 100%)' : 'linear-gradient(to right, black 60%, transparent 100%)',
            WebkitMaskImage: isLandscape ? 'linear-gradient(to top, black 70%, transparent 100%)' : 'linear-gradient(to right, black 60%, transparent 100%)'
        };

        return (
            <div className={`absolute z-1 pointer-events-none ${isLandscape ? 'bottom-0 left-0 w-full h-full' : 'top-0 left-0 h-full w-[55%]'}`}>
                <img
                    src={imageUrl}
                    alt=""
                    // Adicionado filtro sépia/pb para luxo dourado
                    className={`w-full h-full object-cover grayscale-[0.3] sepia-[0.3] opacity-80 ${isLandscape ? 'object-bottom' : 'object-left'}`}
                    style={maskStyle}
                />
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-none p-4 md:p-8 flex flex-col justify-center items-center">
            
            {/* EFEITOS DE FUNDO GOLDEN ERA */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-60">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[70vh] font-black text-yellow-500/[0.04] tracking-tighter z-0">7</div>
                <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-yellow-600/10 rounded-full blur-[120px] animate-float-slow" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-yellow-900/20 rounded-full blur-[100px] animate-float-reverse" />
            </div>

            <div 
                className={`relative z-10 rounded-[2.5rem] flex flex-col w-full max-w-[1400px] transition-all duration-500 p-8 ${isLandscape ? 'h-[85vh]' : 'min-h-[85vh] h-auto'} ${GOLDEN_GLASS}`} 
            >
                <h1 className={`text-5xl md:text-6xl font-black italic text-center mb-8 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)] uppercase tracking-wider shrink-0 ${GOLDEN_TEXT_GRADIENT}`}>
                    {config?.titulo || 'PLACAR DEDALOS'}
                </h1>

                <div className={`flex-1 flex w-full gap-4 md:gap-8 justify-center items-end ${isLandscape ? 'flex-row items-end' : 'flex-col justify-start'}`}>
                    {processedOptions.map((opt, idx) => {
                        const displayTipo = opt.display_tipo || opt.tipo;
                        const displayValor = opt.display_valor || opt.valor;

                        return (
                            <div 
                                key={idx} 
                                className={`relative rounded-3xl border border-yellow-500/20 bg-black shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-500 ${isLandscape ? 'flex-1 h-full flex flex-col justify-end max-w-[250px]' : 'w-full h-28 flex flex-row items-center'}`}
                            >
                                <div style={getBarStyle(opt.color)} />
                                {renderOptionImage(opt)}

                                {isLandscape ? (
                                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-6 pointer-events-none">
                                        <span className="font-black text-5xl md:text-6xl text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)] mb-2">
                                            {opt.percentage.toFixed(0)}%
                                        </span>
                                        <div className="flex-1 flex items-center justify-center">
                                            {displayTipo === 'emoji' && (
                                                <span className="text-[6.5rem] leading-none transition-transform drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" style={getEmojiStyle()}>
                                                    {displayValor}
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-black text-yellow-400 uppercase tracking-wider text-center text-2xl md:text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,1)] px-2 break-words w-full leading-none mb-2">
                                            {opt.nome}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="relative z-10 w-full h-full flex flex-row items-center px-6 gap-6 justify-between pointer-events-none">
                                        <div className="w-20 flex-shrink-0 flex items-center justify-center">
                                            {displayTipo === 'emoji' && (
                                                <span className="text-6xl leading-none drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" style={getEmojiStyle()}>
                                                    {displayValor}
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-black text-yellow-400 uppercase tracking-wider text-4xl md:text-6xl drop-shadow-[0_4px_10px_rgba(0,0,0,1)] flex-1 text-center truncate leading-none">
                                            {opt.nome}
                                        </span>
                                        <span className="font-black text-5xl md:text-7xl text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)]">
                                            {opt.percentage.toFixed(0)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* TERMÔMETRO DA CASA (Lotação) */}
                <div className="mt-8 pt-6 border-t border-yellow-500/20 flex flex-col items-center shrink-0 w-full">
                    <div className="w-full max-w-5xl h-10 bg-black/80 rounded-full border border-yellow-500/30 relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,1)] mb-4">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-in-out relative"
                            style={{
                                width: `${crowdPercentage}%`,
                                background: 'linear-gradient(90deg, #fef08a 0%, #eab308 50%, #a16207 100%)',
                                boxShadow: '0 0 25px rgba(234, 179, 8, 0.6)'
                            }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse mix-blend-overlay" />
                        </div>
                    </div>
                    <p className="text-xl md:text-2xl text-yellow-500 font-bold uppercase tracking-[0.2em] text-center drop-shadow-[0_0_10px_rgba(234,179,8,0.4)] animate-fade-in">
                        {getMovementMessage(crowdPercentage)}
                    </p>
                </div>
            </div>

            {/* ASSINATURA */}
            <div className="absolute bottom-2 right-4 text-[9px] text-yellow-500/30 uppercase tracking-[0.3em] font-black pointer-events-none">
                © 7 Years Dedalos
            </div>
        </div>
    );
}