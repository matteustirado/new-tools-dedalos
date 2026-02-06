import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import axios from 'axios';
import { io } from 'socket.io-client';
import GiftList, { PRIZE_CATEGORIES } from '../../components/GiftList';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const CONFIG = {
    sp: {
        name: 'São Paulo',
        apiUrl: import.meta.env.VITE_API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/",
        token: import.meta.env.VITE_API_TOKEN_SP || "7a9e64071564f6fee8d96cd209ed3a4e86801552",
    },
    bh: {
        name: 'Belo Horizonte',
        apiUrl: import.meta.env.VITE_API_URL_BH || "https://dedalosadm2bh-09d55dca461e.herokuapp.com/",
        token: import.meta.env.VITE_API_TOKEN_BH || "919d97d7df39ecbd0036631caba657221acab99d",
    }
};

export default function GoldenThursday() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';
    const config = CONFIG[currentUnit] || CONFIG.sp;

    const [history, setHistory] = useState([]);
    const [currentDraw, setCurrentDraw] = useState(null);
    const [occupiedData, setOccupiedData] = useState({}); 
    const [cardsConfig, setCardsConfig] = useState(Array(50).fill({ prizeId: 'none', details: '' }));
    
    // Modais
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [selectedLockerForPrize, setSelectedLockerForPrize] = useState(null);
    const [showRedeemedModal, setShowRedeemedModal] = useState(false);
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);

    useEffect(() => {
        const socket = io(API_URL);
        socket.on('golden:winner_update', (data) => {
            if (data.unidade.toLowerCase() === currentUnit) {
                setCurrentDraw(data.winner);
                setIsMonitoring(true);
            }
        });
        loadHistory();
        loadCurrentDraw();
        loadCardConfig();
        return () => socket.disconnect();
    }, [currentUnit]);

    const loadHistory = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tools/history/${currentUnit.toUpperCase()}/QUINTA_PREMIADA`);
            setHistory(res.data);
        } catch (e) { console.error(e); }
    };

    const loadCurrentDraw = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tools/golden/winner/${currentUnit}`);
            if (res.data) {
                setCurrentDraw(res.data);
                setIsMonitoring(true);
            }
        } catch (e) { console.error(e); }
    };

    const loadCardConfig = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tools/golden/config/${currentUnit}`);
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                const loaded = res.data;
                while(loaded.length < 50) loaded.push({ prizeId: 'none', details: '' });
                setCardsConfig(loaded.slice(0, 50));
            }
        } catch (e) { console.error("Erro config cards", e); }
    };

    // --- POLLING: Atualiza estados (Verde/Vermelho/Roxo) ---
    useEffect(() => {
        let interval;
        if (isMonitoring && currentDraw) {
            const check = async () => {
                try {
                    const endpoint = config.apiUrl.includes('api/entradasCheckout') ? config.apiUrl : `${config.apiUrl}api/entradasCheckout/`;
                    const response = await fetch(endpoint, { headers: { "Authorization": `Token ${config.token}` } });
                    const data = await response.json();
                    
                    const currentMap = {};
                    data.forEach(c => {
                        const num = parseInt(c.armario);
                        if (!isNaN(num)) {
                            // Mapeia usando ID da entrada (c.id) para a pulseira
                            currentMap[num] = { pulseira: c.id, nome: c.nome };
                        }
                    });
                    
                    setOccupiedData(currentMap);
                    const occupiedNumbers = Object.keys(currentMap).map(Number);

                    setCurrentDraw(prevDraw => {
                        if (!prevDraw) return null;
                        
                        return prevDraw.map(item => {
                            // Se já resgatou (Roxo), não muda mais
                            if (item.status === 'redeemed') return item;

                            const isNowOccupied = occupiedNumbers.includes(item.locker);

                            // Se estava pendente e entrou -> Ocupado (Verde)
                            if (item.status === 'pending' && isNowOccupied) {
                                return { ...item, status: 'occupied' };
                            }

                            // Se estava Ocupado e saiu SEM resgatar -> Lost (Vermelho)
                            if (item.status === 'occupied' && !isNowOccupied) {
                                return { ...item, status: 'lost' };
                            }
                            
                            // Se estava Perdido e alguém entrou de novo -> Volta a ser Ocupado (Verde)
                            if (item.status === 'lost' && isNowOccupied) {
                                return { ...item, status: 'occupied' };
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

    // --- SORTEIO DINÂMICO ---
    const handleNewDraw = async () => {
        if (currentDraw) return toast.warn("Finalize o sorteio atual antes.");
        
        const activePrizeCards = cardsConfig.map((c, idx) => ({ ...c, originalIndex: idx + 1 })).filter(c => c.prizeId !== 'none');
        
        if (activePrizeCards.length === 0) {
            setShowConfigModal(true);
            return toast.warn("Configure os cards primeiro.");
        }

        const toastId = toast.loading("Buscando mapa de armários...");
        setIsMonitoring(false);

        try {
            // 1. Busca lista completa de armários do servidor (proxy)
            const lockersResponse = await axios.get(`${API_URL}/api/tools/lockers/${currentUnit}`);
            const lockersData = lockersResponse.data;

            if (!Array.isArray(lockersData) || lockersData.length === 0) {
                throw new Error("Lista de armários vazia ou inválida.");
            }

            // 2. Busca ocupados atuais para não sortear quem já está lá
            const endpointOccupied = config.apiUrl.includes('api/entradasCheckout') ? config.apiUrl : `${config.apiUrl}api/entradasCheckout/`;
            const resOccupied = await fetch(endpointOccupied, { headers: { "Authorization": `Token ${config.token}` } });
            const dataOccupied = await resOccupied.json();
            const occupiedNumbers = dataOccupied.map(c => parseInt(c.armario));

            // 3. Processa e filtra os armários
            const validLockers = [];
            const groups = { P: [], M: [], G: [] };

            lockersData.forEach(item => {
                // Extrai número do nome (Ex: "PORTA 01" -> 1)
                const num = parseInt(item.name_door.replace(/\D/g, ''));
                if (isNaN(num)) return;

                // Normaliza tamanho
                let size = 'UNK';
                const typeUpper = (item.type_door || '').toUpperCase();
                if (typeUpper.includes('MÉDIA') || typeUpper.includes('MEDIA')) size = 'M';
                else if (typeUpper.includes('GRANDE')) size = 'G';
                else if (typeUpper.includes('PEQUENA')) size = 'P';
                else if (typeUpper.includes('MICRO') || typeUpper.includes('PP')) size = 'PP';

                const isBroken = (item.sit_door || '').toUpperCase().includes('MANUTEN');
                const isOccupied = occupiedNumbers.includes(num);

                if (size !== 'PP' && size !== 'UNK' && !isBroken && !isOccupied) {
                    validLockers.push({ locker: num, size });
                    if (groups[size]) groups[size].push(num);
                    else groups.M.push(num); // Fallback padrão para M
                }
            });

            // 4. Lógica de Distribuição Proporcional
            const totalPrizes = Math.min(activePrizeCards.length, validLockers.length);
            const totalValid = validLockers.length;
            
            if (totalPrizes === 0) {
                toast.update(toastId, { render: "Sem armários disponíveis para sorteio!", type: "error", isLoading: false });
                return;
            }

            const distribution = { P: 0, M: 0, G: 0 };
            let assignedCount = 0;

            ['P', 'M', 'G'].forEach(size => {
                const countAvailable = groups[size].length;
                if (countAvailable > 0) {
                    const ratio = countAvailable / totalValid;
                    let qtd = Math.floor(ratio * totalPrizes);
                    distribution[size] = qtd;
                    assignedCount += qtd;
                }
            });

            const availableSizes = ['P', 'M', 'G'].filter(s => groups[s].length > 0);
            while (assignedCount < totalPrizes && availableSizes.length > 0) {
                const randomSize = availableSizes[Math.floor(Math.random() * availableSizes.length)];
                if (distribution[randomSize] < groups[randomSize].length) {
                    distribution[randomSize]++;
                    assignedCount++;
                } else {
                    availableSizes.splice(availableSizes.indexOf(randomSize), 1);
                }
            }

            // 5. Sorteio dos Números
            let selectedLockers = [];
            ['P', 'M', 'G'].forEach(size => {
                const shuffled = groups[size].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, distribution[size]);
                selectedLockers.push(...selected.map(num => ({ locker: num, size, status: 'pending' })));
            });

            // 6. Atribuição dos Prêmios
            const shuffledCards = [...activePrizeCards].sort(() => 0.5 - Math.random());
            const finalDrawData = selectedLockers.map((lockerItem, index) => {
                const card = shuffledCards[index];
                const categoryObj = PRIZE_CATEGORIES.find(c => c.id === card.prizeId);
                const prizeLabel = categoryObj ? categoryObj.label : 'Prêmio';

                return {
                    ...lockerItem,
                    prize: prizeLabel, 
                    cardNumber: card.originalIndex,
                    cardData: card,   
                    details: null
                };
            });

            finalDrawData.sort((a,b) => a.locker - b.locker);

            // 7. Salvar
            await axios.post(`${API_URL}/api/tools/golden/winner`, {
                unidade: currentUnit,
                type: 'QUINTA_PREMIADA',
                data: finalDrawData
            });

            toast.update(toastId, { render: `Sorteio Realizado! (${finalDrawData.length} armários)`, type: "success", isLoading: false, autoClose: 3000 });

        } catch (error) {
            console.error(error);
            toast.update(toastId, { render: "Erro ao buscar dados dos armários.", type: "error", isLoading: false });
        }
    };

    const handleSaveConfig = async () => {
        try {
            await axios.post(`${API_URL}/api/tools/golden/config`, {
                unidade: currentUnit,
                cards: cardsConfig
            });
            toast.success("Configuração salva!");
            setShowConfigModal(false);
        } catch (e) { toast.error("Erro ao salvar config."); }
    };

    const handleLockerClick = (item) => {
        if (item.status === 'pending') return toast.info("Armário vazio. Aguarde o cliente entrar.");
        if (item.status === 'redeemed') return toast.info(`Já resgatado: ${item.details}`);
        if (item.status === 'lost') return toast.error("Cliente saiu sem resgatar. Remova o card.");
        
        setSelectedLockerForPrize(item);
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
            await axios.post(`${API_URL}/api/tools/golden/winner`, {
                unidade: currentUnit,
                type: 'QUINTA_PREMIADA',
                data: updatedDraw
            });
            toast.success("Resgate salvo!");
            setSelectedLockerForPrize(null);
        } catch (e) { toast.error("Erro ao salvar."); }
    };

    const confirmFinalize = async () => {
        setIsFinalizing(true);
        const redeemedCount = currentDraw.filter(i => i.status === 'redeemed').length;
        const payload = {
            tipo: 'QUINTA_PREMIADA',
            unidade: currentUnit.toUpperCase(),
            total_sorteados: currentDraw.length,
            total_resgatados: redeemedCount,
            detalhes: currentDraw
        };
        try {
            // 1. Salvar histórico
            await axios.post(`${API_URL}/api/tools/history`, payload);
            
            // 2. Limpar vencedor ativo
            await axios.delete(`${API_URL}/api/tools/golden/winner/${currentUnit}`);

            toast.success("Finalizado com sucesso!");
            setCurrentDraw(null);
            setIsMonitoring(false);
        } catch (e) { 
            console.error(e);
            toast.warning("Erro ao finalizar."); 
        } finally { 
            setShowFinalizeModal(false); 
            setIsFinalizing(false); 
            loadHistory(); 
        }
    };

    // --- IMPRESSÃO ---
    const generatePrintReport = (dataToPrint, titleSuffix = "") => {
        if (!dataToPrint || dataToPrint.length === 0) return toast.info("Nada para imprimir");

        const printWindow = window.open('', '', 'height=800,width=900');
        printWindow.document.write('<html><head><title>Relatório Quinta Premiada</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
            body { font-family: 'Courier New', monospace; padding: 20px; color: #000; font-size: 12px; }
            h1 { text-align: center; font-size: 16px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 14px; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .item { border-bottom: 1px dashed #ccc; padding: 5px 0; display: flex; justify-content: space-between; align-items: center; }
            .status { font-weight: bold; text-transform: uppercase; }
            .redeemed { color: #000; }
            .lost { color: red; }
            .pending { color: #777; }
            .details { display: block; font-size: 10px; color: #555; margin-top: 2px; }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(`<h1>${config.name}</h1>`);
        printWindow.document.write(`<h2>RELATÓRIO DE SORTEIO - ${titleSuffix}</h2>`);
        
        dataToPrint.forEach(item => {
            let statusLabel = "AGUARDANDO";
            let statusClass = "pending";
            
            if(item.status === 'occupied') { statusLabel = "DISPONÍVEL"; statusClass = "pending"; }
            if(item.status === 'redeemed') { statusLabel = "RESGATADO"; statusClass = "redeemed"; }
            if(item.status === 'lost') { statusLabel = "PERDIDO"; statusClass = "lost"; }

            printWindow.document.write('<div class="item">');
            printWindow.document.write(`<div>`);
            printWindow.document.write(`<strong>[Card #${item.cardNumber}] Armário ${item.locker}</strong> (${item.size})<br/>`);
            printWindow.document.write(`<span>${item.prize}</span>`);
            if (item.details) printWindow.document.write(`<span class="details">${item.details}</span>`);
            printWindow.document.write(`</div>`);
            printWindow.document.write(`<span class="status ${statusClass}">${statusLabel}</span>`);
            printWindow.document.write('</div>');
        });
        
        printWindow.document.write('<br/><br/><center>--- Fim do Relatório ---</center>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="min-h-screen bg-gradient-warm flex">
            <Sidebar activePage="thursday" headerTitle="Quinta Premiada" headerIcon="stars" group="maintenance" unit={currentUnit} />

            <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-1">Quinta Premiada</h1>
                        <span className="text-white/50 text-sm font-bold uppercase tracking-widest">{config.name}</span>
                        {isMonitoring && <span className="ml-3 text-green-400 text-xs font-bold animate-pulse">• MONITORANDO</span>}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setShowConfigModal(true)} className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 flex items-center gap-2 font-bold text-sm">
                            <span className="material-symbols-outlined text-lg">settings</span> CARDS
                        </button>
                        <button onClick={() => generatePrintReport(currentDraw, "ATUAL")} disabled={!currentDraw} className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 font-bold text-sm disabled:opacity-50 flex items-center gap-2">
                            <span className="material-symbols-outlined">print</span> IMPRIMIR
                        </button>
                        <button onClick={() => setShowRedeemedModal(true)} disabled={!currentDraw} className="bg-purple-600/80 text-white px-4 py-2 rounded-lg hover:bg-purple-600 font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                            <span className="material-symbols-outlined text-lg">emoji_events</span> RESGATADOS
                        </button>
                        <button onClick={handleNewDraw} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-500 shadow-lg flex items-center gap-2">
                            <span className="material-symbols-outlined">casino</span> NOVO SORTEIO
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
                    <div className="col-span-3 liquid-glass rounded-3xl p-6 flex flex-col min-h-0">
                        <h2 className="text-white font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined">history</span> Histórico</h2>
                        <div className="overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {history.map(h => (
                                <div key={h.id} className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col gap-1 hover:bg-white/10 group cursor-pointer"
                                     onClick={() => generatePrintReport(h.detalhes, new Date(h.data_hora).toLocaleDateString())}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-xs font-bold">{new Date(h.data_hora).toLocaleDateString()}</span>
                                        <span className="material-symbols-outlined text-white/30 group-hover:text-white scale-75">print</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-white/50">
                                        <span>{h.total_sorteados} cupons</span>
                                        <span>{h.total_resgatados} resgates</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="col-span-9 liquid-glass rounded-3xl p-6 flex flex-col min-h-0 relative">
                        {!currentDraw ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-white/20">
                                <span className="material-symbols-outlined text-8xl mb-4">stars</span>
                                <p className="text-xl font-medium">Nenhum sorteio ativo</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <div className="grid grid-cols-10 gap-2 overflow-y-auto custom-scrollbar content-start pb-4 pr-2">
                                    {currentDraw.map((item) => {
                                        let cardStyle = "bg-white/5 border-white/10 text-white opacity-50 cursor-not-allowed"; 
                                        let icon = null;

                                        if (item.status === 'redeemed') {
                                            cardStyle = "bg-purple-900/60 border-purple-500 text-purple-100 cursor-pointer";
                                            icon = "check_circle";
                                        } else if (item.status === 'occupied') {
                                            cardStyle = "bg-green-600 border-green-400 text-white shadow-[0_0_10px_rgba(34,197,94,0.6)] scale-105 z-10 animate-pulse cursor-pointer";
                                            icon = "redeem";
                                        } else if (item.status === 'lost') {
                                            cardStyle = "bg-red-900/50 border-red-500 text-red-200 cursor-pointer";
                                            icon = "close";
                                        }

                                        return (
                                            <div key={item.locker} onClick={() => handleLockerClick(item)} 
                                                 className={`h-14 rounded-lg border flex flex-col items-center justify-center transition-all relative p-1 ${cardStyle}`}>
                                                <div className="flex flex-col items-center leading-none gap-0.5">
                                                    <span className="text-base font-bold">{item.locker}</span>
                                                    <span className="text-[8px] uppercase font-bold opacity-80">Card #{item.cardNumber}</span>
                                                </div>
                                                {icon && <span className="material-symbols-outlined absolute top-1 right-1 text-[10px]">{icon}</span>}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-2 pt-2 border-t border-white/10 flex justify-end">
                                    <button onClick={() => setShowFinalizeModal(true)} className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined">stop_circle</span> ENCERRAR
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* MODAL CONFIGURAÇÃO */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 backdrop-blur-md">
                    <div className="bg-[#1a1a1a] w-full max-w-7xl h-[90vh] rounded-3xl p-6 flex flex-col border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Configuração dos Cards</h2>
                            <div className="flex gap-3">
                                <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 text-white/50 hover:text-white">Cancelar</button>
                                <button onClick={handleSaveConfig} className="bg-green-600 px-6 py-2 rounded-lg text-white font-bold hover:bg-green-500">SALVAR</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-5 gap-3">
                            {cardsConfig.map((card, idx) => (
                                <div key={idx} className={`p-3 rounded-lg border flex flex-col gap-2 ${card.prizeId === 'none' ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/10 border-blue-500/30'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-white/40">CARD #{idx + 1}</span>
                                        {card.prizeId !== 'none' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                                    </div>
                                    <select 
                                        className="bg-black/40 text-white p-2 rounded border border-white/10 text-sm focus:border-blue-500 outline-none"
                                        value={card.prizeId}
                                        onChange={(e) => {
                                            const newConfigs = [...cardsConfig];
                                            newConfigs[idx] = { ...newConfigs[idx], prizeId: e.target.value };
                                            setCardsConfig(newConfigs);
                                        }}
                                    >
                                        <option value="none">SEM PRÊMIO</option>
                                        {PRIZE_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedLockerForPrize && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <GiftList
                        lockerNumber={selectedLockerForPrize.locker}
                        unit={currentUnit}
                        preSelectedCategory={selectedLockerForPrize.cardData.prizeId}
                        customerData={occupiedData[selectedLockerForPrize.locker]}
                        onConfirm={handleGiftConfirm}
                        onCancel={() => setSelectedLockerForPrize(null)}
                    />
                </div>
            )}
            
             {showFinalizeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
                        <span className="material-symbols-outlined text-red-500 text-5xl mb-4">warning</span>
                        <h2 className="text-2xl font-bold text-white mb-2">Finalizar Sorteio?</h2>
                        <div className="flex gap-4 mt-6">
                            <button onClick={() => setShowFinalizeModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold">CANCELAR</button>
                            <button onClick={confirmFinalize} disabled={isFinalizing} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold">FINALIZAR</button>
                        </div>
                    </div>
                </div>
            )}

            {showRedeemedModal && currentDraw && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 max-w-3xl w-full shadow-2xl relative flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                            <h2 className="text-2xl font-bold text-white">Prêmios Já Resgatados</h2>
                            <button onClick={() => setShowRedeemedModal(false)} className="text-white/50 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                            {currentDraw.filter(i => i.status === 'redeemed').length === 0 && (
                                <div className="text-center py-10 text-white/30">
                                    <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                                    <p>Nenhum prêmio foi resgatado ainda.</p>
                                </div>
                            )}

                            {currentDraw.filter(i => i.status === 'redeemed').map(item => (
                                <div key={item.locker} className="bg-white/5 p-4 rounded-xl flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl font-bold text-purple-400 w-12 text-center">{item.locker}</div>
                                        <div>
                                            <div className="text-white font-bold">{item.details}</div>
                                            <div className="text-xs text-white/50">{item.prize} (Card #{item.cardNumber})</div>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}