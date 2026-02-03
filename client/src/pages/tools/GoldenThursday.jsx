import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import axios from 'axios';
import GiftList, { PRIZE_CATEGORIES } from '../../components/GiftList';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// CONFIGURAÇÃO LIMPA: Apenas dados de identidade.
// A lógica de quais armários existem ou estão quebrados agora é do Backend.
const CONFIG = {
    sp: { 
        name: 'São Paulo', 
        couponsToDraw: 50, // Meta de sorteios
        apiUrl: import.meta.env.VITE_API_URL_SP, 
        token: import.meta.env.VITE_API_TOKEN_SP
    },
    bh: { 
        name: 'Belo Horizonte', 
        couponsToDraw: 15, // Meta de sorteios
        apiUrl: import.meta.env.VITE_API_URL_BH, 
        token: import.meta.env.VITE_API_TOKEN_BH
    }
};

export default function GoldenThursday() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';
    const config = CONFIG[currentUnit] || CONFIG.sp;

    const [history, setHistory] = useState([]);
    const [selectedLockerForPrize, setSelectedLockerForPrize] = useState(null);
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showRedeemedModal, setShowRedeemedModal] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [currentDraw, setCurrentDraw] = useState(null);
    const [isMonitoring, setIsMonitoring] = useState(false);
    
    // Configuração de Cartões (Prêmios)
    const [cardsConfig, setCardsConfig] = useState([]);

    // Carrega configuração de cartões
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Estado inicial padrão
                const initialCards = Array.from({ length: config.couponsToDraw }, (_, i) => ({
                    cardNumber: i + 1,
                    category: 'sem_premio'
                }));

                const res = await axios.get(`${API_URL}/api/tools/golden/config/${currentUnit}`);
                if (res.data && res.data.config_text) {
                    const parsed = JSON.parse(res.data.config_text);
                    if (Array.isArray(parsed)) {
                        const merged = initialCards.map(card => {
                            const found = parsed.find(p => p.cardNumber === card.cardNumber);
                            return found ? { ...card, category: found.category } : card;
                        });
                        setCardsConfig(merged);
                    } else {
                        setCardsConfig(initialCards);
                    }
                } else {
                    setCardsConfig(initialCards);
                }
            } catch (error) {
                console.error("Erro config prêmios:", error);
                // Fallback
                setCardsConfig(Array.from({ length: config.couponsToDraw }, (_, i) => ({ cardNumber: i + 1, category: 'sem_premio' })));
            }
        };
        fetchConfig();
    }, [currentUnit, config.couponsToDraw]);

    const handleSaveConfig = async () => {
        try {
            await axios.post(`${API_URL}/api/tools/golden/config`, {
                unidade: currentUnit,
                config_text: JSON.stringify(cardsConfig)
            });
            setShowConfigModal(false);
            toast.success("Configuração de cartões salva!");
        } catch (error) {
            toast.error("Erro ao salvar configuração.");
        }
    };

    const updateCardCategory = (index, newCategory) => {
        const newConfig = [...cardsConfig];
        newConfig[index].category = newCategory;
        setCardsConfig(newConfig);
    };

    // Socket e Carga Inicial
    useEffect(() => {
        const socket = io(API_URL);
        
        // Ouve atualizações de sorteio vindas do servidor
        socket.on('golden:winner_update', (data) => {
            if (data.unidade.toLowerCase() === currentUnit) {
                setCurrentDraw(data.winner);
                setIsMonitoring(true);
            }
        });

        const fetchLastWinner = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/tools/golden/winner/${currentUnit}`);
                if (res.data) { 
                    setCurrentDraw(res.data); 
                    setIsMonitoring(true); 
                }
            } catch (e) { console.error(e); }
        };

        fetchLastWinner();
        loadHistory();

        return () => socket.disconnect();
    }, [currentUnit]);

    const loadHistory = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tools/history/${currentUnit.toUpperCase()}/QUINTA_PREMIADA`);
            setHistory(res.data);
        } catch (e) { console.error(e); }
    };

    // Monitoramento de Ocupação em Tempo Real (Apenas Visualização)
    useEffect(() => {
        let interval;
        if (isMonitoring && currentDraw) {
            const check = async () => {
                try {
                    const endpoint = config.apiUrl.includes('api/entradasCheckout') ? config.apiUrl : `${config.apiUrl}api/entradasCheckout/`;
                    const response = await fetch(endpoint, { headers: { "Authorization": `Token ${config.token}` } });
                    const data = await response.json();
                    
                    const occupancyMap = {};
                    data.forEach(c => {
                        const num = parseInt(c.armario);
                        if (!isNaN(num)) {
                            const nomeCliente = c.nome || c.cliente || c.name || "";
                            const pulseiraCliente = c.id_locker || ""; 
                            occupancyMap[num] = { pulseira: pulseiraCliente, nome: nomeCliente };
                        }
                    });

                    setCurrentDraw(prevDraw => {
                        if (!prevDraw) return null;
                        return prevDraw.map(item => {
                            if (item.status === 'redeemed') return item;
                            const activeData = occupancyMap[item.locker];
                            
                            // Se tem gente no armário sorteado
                            if (activeData) {
                                if (item.status !== 'occupied' || (activeData.pulseira && item.currentWristband != activeData.pulseira)) {
                                    return { 
                                        ...item, 
                                        status: 'occupied', 
                                        currentWristband: activeData.pulseira, 
                                        currentClientName: activeData.nome 
                                    };
                                }
                                return item;
                            }
                            // Se estava ocupado mas a pessoa saiu (e não resgatou)
                            if (item.status === 'occupied' && !activeData) {
                                return { ...item, status: 'lost', currentWristband: null, currentClientName: null };
                            }
                            return item;
                        });
                    });
                } catch (e) { console.error("Erro polling", e); }
            };
            check();
            interval = setInterval(check, 5000);
        }
        return () => clearInterval(interval);
    }, [isMonitoring, config.apiUrl, config.token, currentDraw]);


    // [REFORMULADO] SORTEIO SERVER-SIDE
    // Agora o Frontend apenas pede o sorteio, o Backend faz a mágica (verifica armários, tamanhos, filtra e sorteia)
    const handleNewDraw = async () => {
        if (currentDraw) return toast.warn("Finalize o sorteio atual antes.");
        
        setIsMonitoring(false);
        const toastId = toast.loading("Consultando sistema e sorteando prêmios...");

        try {
            // Envia a unidade e a configuração dos cartões desejados
            const response = await axios.post(`${API_URL}/api/tools/golden/draw`, {
                unidade: currentUnit,
                prizeConfig: cardsConfig // O "baralho" de prêmios
            });

            const newDrawData = response.data.data; // Dados do sorteio retornados pelo servidor
            const msg = response.data.message || "Sorteio realizado!";

            setCurrentDraw(newDrawData);
            
            toast.update(toastId, { 
                render: `${msg} (${newDrawData.length} prêmios)`, 
                type: "success", 
                isLoading: false, 
                autoClose: 3000 
            });

        } catch (error) {
            console.error("Erro no sorteio:", error);
            const errorMsg = error.response?.data?.error || "Erro ao realizar sorteio.";
            toast.update(toastId, { render: errorMsg, type: "error", isLoading: false, autoClose: 4000 });
            setIsMonitoring(true); // Retoma monitoramento se falhou
        }
    };

    const handleRequestFinalize = () => { if (currentDraw) setShowFinalizeModal(true); };
    
    const confirmFinalize = async () => {
        setIsFinalizing(true);
        const redeemedCount = currentDraw.filter(i => i.status === 'redeemed').length;
        const payload = { tipo: 'QUINTA_PREMIADA', unidade: currentUnit.toUpperCase(), total_sorteados: currentDraw.length, total_resgatados: redeemedCount, detalhes: currentDraw };
        try {
            await axios.post(`${API_URL}/api/tools/history`, payload);
            toast.success("Histórico salvo!");
            setCurrentDraw(null);
            setIsMonitoring(false);
        } catch (e) { toast.warning("Erro ao salvar histórico."); }
        finally { setShowFinalizeModal(false); setIsFinalizing(false); loadHistory(); }
    };

    const handleLockerClick = (item) => {
        if (item.status === 'occupied') setSelectedLockerForPrize(item);
        else if (item.status === 'redeemed') toast.info(`Resgatado: ${item.prize}`);
        else if (item.status === 'lost') toast.error("Cliente saiu sem resgatar.");
        else toast.info(`Cartão #${item.cardNumber}: ${PRIZE_CATEGORIES.find(c => c.id === item.prizeCategory)?.label || item.prizeCategory}`);
    };

    const handleGiftConfirm = async (prizeLabel, detailsString) => {
        if (!selectedLockerForPrize) return;
        const updatedDraw = currentDraw.map(item => {
            if (item.locker === selectedLockerForPrize.locker) {
                return { ...item, status: 'redeemed', prize: prizeLabel, details: detailsString };
            }
            return item;
        });
        try {
            await axios.post(`${API_URL}/api/tools/golden/winner`, { unidade: currentUnit, type: 'QUINTA_PREMIADA', data: updatedDraw });
            setSelectedLockerForPrize(null);
            toast.success("Resgate salvo!");
        } catch (e) { toast.error("Erro ao salvar."); }
    };

    const generatePrintReport = (drawData, dateLabel) => {
        if (!drawData) return;
        const redeemed = drawData.filter(i => i.status === 'redeemed');
        const notRedeemed = drawData.filter(i => i.status !== 'redeemed');
        const win = window.open('', '', 'height=800,width=900');
        win.document.write('<html><head><title>Relatório</title><style>body{font-family:monospace;padding:20px;font-size:12px}.item{border-bottom:1px dashed #ccc;padding:5px 0}.header{text-align:center;font-weight:bold;margin-bottom:20px}</style></head><body>');
        win.document.write(`<div class="header">QUINTA PREMIADA ${config.name}<br/>${dateLabel}</div>`);
        win.document.write(`<h3>RESGATADOS (${redeemed.length})</h3>`);
        redeemed.forEach(i => win.document.write(`<div class="item">Armário ${i.locker} (Cartão ${i.cardNumber})<br/>Prêmio: ${i.prize}<br/>${i.details || ''}</div>`));
        win.document.write(`<h3>NÃO RESGATADOS (${notRedeemed.length})</h3>`);
        notRedeemed.forEach(i => {
            const catName = PRIZE_CATEGORIES.find(c => c.id === i.prizeCategory)?.label || i.prizeCategory;
            win.document.write(`<div class="item">Armário ${i.locker} (Cartão ${i.cardNumber}) - ${catName} [${i.status}]</div>`)
        });
        win.document.close();
        win.print();
    };

    return (
        <div className="min-h-screen bg-gradient-warm flex">
            <Sidebar activePage="thursday" headerTitle="Quinta Premiada" headerIcon="stars" group="maintenance" unit={currentUnit} />
            <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-8 flex-shrink-0">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-1">Quinta Premiada</h1>
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-widest ${currentUnit === 'sp' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{config.name}</span>
                            {isMonitoring && <span className="flex items-center gap-2 text-green-400 text-xs font-bold animate-pulse"><span className="w-2 h-2 bg-green-500 rounded-full"></span> MONITORANDO</span>}
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setShowConfigModal(true)} className="bg-white/10 text-white px-4 py-3 rounded-xl font-bold hover:bg-white/20 flex items-center gap-2" title="Configurar Cartões"><span className="material-symbols-outlined">settings</span></button>
                        <button onClick={() => currentDraw && generatePrintReport(currentDraw, new Date().toLocaleString())} disabled={!currentDraw} className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 disabled:opacity-50 flex items-center gap-2"><span className="material-symbols-outlined">print</span> IMPRIMIR</button>
                        <button onClick={() => setShowRedeemedModal(true)} disabled={!currentDraw} className="bg-purple-600/80 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"><span className="material-symbols-outlined">emoji_events</span> RESGATADOS</button>
                        
                        {/* Botão agora aciona o Backend */}
                        <button onClick={handleNewDraw} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500 shadow-lg flex items-center gap-2"><span className="material-symbols-outlined">casino</span> NOVO SORTEIO</button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
                    <div className="col-span-4 liquid-glass rounded-3xl p-6 flex flex-col min-h-0">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-white/50">history</span> Histórico</h2>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {history.map(h => (
                                <div key={h.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-1">
                                    <div className="flex justify-between"><span className="text-white font-bold">{new Date(h.data_hora).toLocaleDateString('pt-BR')}</span><span className="text-xs bg-white/10 px-2 rounded text-white">{h.total_resgatados} resgates</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-8 liquid-glass rounded-3xl p-8 flex flex-col min-h-0 relative overflow-hidden">
                        {!currentDraw ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-white/20"><span className="material-symbols-outlined text-8xl mb-4">stars</span><p className="text-xl font-medium uppercase tracking-widest">Aguardando Sorteio</p></div>
                        ) : (
                            <>
                                <div className="grid grid-cols-10 gap-2 overflow-hidden content-start pb-4">
                                    {currentDraw.map((item) => {
                                        let cardClass = "bg-white/5 border-white/10 text-white hover:bg-white/10";
                                        let icon = null;
                                        if (item.status === 'occupied') { cardClass = "bg-green-600 border-green-400 text-white animate-pulse shadow-lg scale-105"; icon = "person"; }
                                        else if (item.status === 'lost') { cardClass = "bg-red-900/80 border-red-500 text-red-100"; icon = "priority_high"; }
                                        else if (item.status === 'redeemed') { cardClass = "bg-purple-600 border-purple-400 text-white opacity-60"; icon = "check"; }
                                        
                                        return (
                                            <div key={item.locker} onClick={() => handleLockerClick(item)} className={`aspect-square rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all relative ${cardClass} p-1`}>
                                                <span className="text-xl font-bold">{item.locker}</span>
                                                {/* Mostra o tamanho retornado pelo servidor se quiser: */}
                                                <span className="text-[8px] absolute top-1 left-1 opacity-50">{item.size}</span>
                                                <span className="text-[9px] font-bold uppercase opacity-80">{item.cardNumber ? `#${item.cardNumber}` : ''}</span>
                                                {icon && <span className="material-symbols-outlined absolute top-1 right-1 text-xs">{icon}</span>}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-auto pt-4 border-t border-white/10 flex justify-end">
                                    <button onClick={handleRequestFinalize} className="bg-red-600/80 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-600 text-sm flex items-center gap-2"><span className="material-symbols-outlined">stop_circle</span> FINALIZAR</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>

            {/* Modais de Config, GiftList, Redeemed, Finalize permanecem iguais, apenas a lógica interna da config mudou nos hooks */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                        <h2 className="text-2xl font-bold text-white mb-4">Configurar Cartões ({cardsConfig.length})</h2>
                        <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 md:grid-cols-3 gap-4 pr-2">
                            {cardsConfig.map((card, idx) => (
                                <div key={card.cardNumber} className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">{card.cardNumber}</div>
                                    <select 
                                        className="flex-1 bg-black border border-white/20 rounded-md p-2 text-white text-sm focus:border-blue-500 outline-none"
                                        value={card.category}
                                        onChange={(e) => updateCardCategory(idx, e.target.value)}
                                    >
                                        {PRIZE_CATEGORIES.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => setShowConfigModal(false)} className="text-white/50 hover:text-white px-4 py-2">Cancelar</button>
                            <button onClick={handleSaveConfig} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-500">Salvar Configuração</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedLockerForPrize && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <GiftList
                        lockerNumber={selectedLockerForPrize.locker}
                        lockerData={selectedLockerForPrize}
                        onCancel={() => setSelectedLockerForPrize(null)}
                        onConfirm={handleGiftConfirm}
                        unit={currentUnit}
                    />
                </div>
            )}

            {showRedeemedModal && currentDraw && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] p-6 rounded-2xl w-full max-w-lg relative">
                        <button onClick={() => setShowRedeemedModal(false)} className="absolute top-4 right-4 text-white"><span className="material-symbols-outlined">close</span></button>
                        <h2 className="text-white text-xl font-bold mb-4">Prêmios Resgatados</h2>
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {currentDraw.filter(i => i.status === 'redeemed').map(item => (
                                <div key={item.locker} className="border-b border-white/10 py-2 text-white"><span className="font-bold text-orange-400">#{item.locker}</span> - {item.prize}</div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {showFinalizeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="bg-[#1a1a1a] p-8 rounded-2xl text-center">
                        <h2 className="text-white font-bold text-2xl mb-4">Finalizar Promoção?</h2>
                        <div className="flex gap-4 justify-center"><button onClick={() => setShowFinalizeModal(false)} className="text-white px-4 py-2">Cancelar</button><button onClick={confirmFinalize} disabled={isFinalizing} className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700">{isFinalizing ? '...' : 'Confirmar'}</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}