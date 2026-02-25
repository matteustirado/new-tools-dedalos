import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import axios from 'axios';
import GiftList, { PRIZE_CATEGORIES } from '../../components/GiftList';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const POLL_CONFIG = {
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
  const pollConfig = POLL_CONFIG[currentUnit] || POLL_CONFIG.sp;

  const [lockerDefinitions, setLockerDefinitions] = useState([]);
  const [cardConfig, setCardConfig] = useState(Array.from({ length: 50 }, (_, i) => ({ 
    index: i, 
    prize_type: 'sem_premio', 
    prize_details: {} 
  })));
  const [occupiedData, setOccupiedData] = useState([]);
  const [history, setHistory] = useState([]);

  const [selectedLockerForPrize, setSelectedLockerForPrize] = useState(null);
  const [currentDraw, setCurrentDraw] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    const socket = io(API_URL);

    socket.on('golden:winner_update', (data) => {
      if (data.unidade.toLowerCase() === currentUnit) {
        setCurrentDraw(data.winner);
        setIsMonitoring(!!data.winner);
      }
    });

    const fetchData = async () => {
      try {
        const [lockersRes, configRes, lastWinnerRes] = await Promise.all([
          axios.get(`${API_URL}/api/tools/lockers/${currentUnit}`),
          axios.get(`${API_URL}/api/tools/golden/config/${currentUnit}`),
          axios.get(`${API_URL}/api/tools/golden/winner/${currentUnit}`)
        ]);

        if (Array.isArray(lockersRes.data)) {
          setLockerDefinitions(lockersRes.data);
        }

        if (configRes.data?.length > 0) {
          const loaded = Array.from({ length: 50 }, (_, idx) => {
            const found = configRes.data.find(c => c.index === idx);
            return found 
              ? { index: idx, prize_type: found.prize_type || 'sem_premio', prize_details: found.prize_details || {} }
              : { index: idx, prize_type: 'sem_premio', prize_details: {} };
          });
          setCardConfig(loaded);
        }

        if (lastWinnerRes.data) {
          setCurrentDraw(lastWinnerRes.data);
          setIsMonitoring(true);
        }
      } catch (error) {
        console.error("Erro inicial:", error);
      }
    };

    fetchData();
    loadHistory();

    return () => socket.disconnect();
  }, [currentUnit]);

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tools/history/${currentUnit.toUpperCase()}/QUINTA_PREMIADA`);
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let interval;

    if (isMonitoring && currentDraw) {
      const checkStatus = async () => {
        try {
          const endpoint = pollConfig.apiUrl.includes('api/entradasCheckout') 
            ? pollConfig.apiUrl 
            : `${pollConfig.apiUrl}api/entradasCheckout/`;
            
          const response = await fetch(endpoint, { 
            headers: { "Authorization": `Token ${pollConfig.token}` } 
          });
          const data = await response.json();

          setOccupiedData(data);
          const currentOccupiedNums = data.map(c => parseInt(c.armario)).filter(n => !isNaN(n));

          setCurrentDraw(prevDraw => {
            if (!prevDraw) return null;
            return prevDraw.map(item => {
              if (item.status === 'redeemed' || item.status === 'lost') return item;

              const isNowOccupied = currentOccupiedNums.includes(item.locker);

              if (isNowOccupied) {
                return item.status !== 'occupied' ? { ...item, status: 'occupied' } : item;
              }

              if (item.status === 'occupied' && !isNowOccupied) {
                return { ...item, status: 'lost' };
              }

              return item;
            });
          });
        } catch (e) {
          console.error("Erro polling", e);
        }
      };

      checkStatus();
      interval = setInterval(checkStatus, 5000);
    }

    return () => clearInterval(interval);
  }, [isMonitoring, pollConfig, currentDraw]);

  const handleNewDraw = async () => {
    if (currentDraw) return toast.warn("Finalize o sorteio atual.");
    if (lockerDefinitions.length === 0) return toast.error("Infraestrutura não carregada.");

    const toastId = toast.loading("Sorteando...");

    try {
      const endpoint = pollConfig.apiUrl.includes('api/entradasCheckout') 
        ? pollConfig.apiUrl 
        : `${pollConfig.apiUrl}api/entradasCheckout/`;

      const response = await fetch(endpoint, { 
        headers: { "Authorization": `Token ${pollConfig.token}` } 
      });
      const data = await response.json();
      const realOccupied = data.map(c => parseInt(c.armario));

      const validLockers = lockerDefinitions.filter(l => {
        const num = parseInt(l.numero);
        const isMicro = l.tamanho?.toUpperCase() === 'MICRO';
        const isBroken = l.status && l.status !== 'ativo' && l.status !== 'ok';
        return !realOccupied.includes(num) && !isMicro && !isBroken;
      });

      const activeCards = cardConfig.filter(c => c.prize_type && c.prize_type !== 'sem_premio');

      if (activeCards.length === 0) {
        toast.update(toastId, { render: "Nenhum card configurado!", type: "warning", isLoading: false, autoClose: 3000 });
        return;
      }

      const shuffledCards = [...activeCards].sort(() => 0.5 - Math.random());
      const shuffledLockers = [...validLockers].sort(() => 0.5 - Math.random());
      const targetTotal = Math.min(shuffledLockers.length, shuffledCards.length);

      const drawResult = [];

      for (let i = 0; i < targetTotal; i++) {
        const locker = shuffledLockers[i];
        const card = shuffledCards[i];
        const label = PRIZE_CATEGORIES.find(c => c.id === card.prize_type)?.label || card.prize_type;

        drawResult.push({
          locker: parseInt(locker.numero),
          size: locker.tamanho ? locker.tamanho.toUpperCase() : '?',
          status: 'pending',
          card_index: card.index + 1,
          prize: label,
          prize_type_id: card.prize_type,
          details_obj: card.prize_details,
          details: null
        });
      }

      drawResult.sort((a, b) => a.locker - b.locker);

      await axios.post(`${API_URL}/api/tools/golden/winner`, {
        unidade: currentUnit, 
        type: 'QUINTA_PREMIADA', 
        data: drawResult
      });

      toast.update(toastId, { render: "Sorteio Realizado!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (error) {
      toast.update(toastId, { render: "Erro no sorteio.", type: "error", isLoading: false });
    }
  };

  const handleLockerClick = (item) => {
    if (item.status === 'pending') return;
    if (item.status === 'redeemed') return toast.info("Este prêmio já foi resgatado.");
    if (item.status === 'lost') return toast.error("Armário liberado sem resgate. Remova o card.");

    if (item.status === 'occupied') {
      if (!item.prize_type_id) return toast.info("Card sem prêmio.");
      const clientInfo = occupiedData.find(c => parseInt(c.armario) === item.locker);
      setSelectedLockerForPrize({ ...item, clientInfo });
    }
  };

  const handleGiftConfirm = async (prizeName, detailsString) => {
    if (!selectedLockerForPrize) return;

    const updated = currentDraw.map(i => 
      i.locker === selectedLockerForPrize.locker 
        ? { ...i, status: 'redeemed', prize: prizeName, details: detailsString } 
        : i
    );

    try {
      await axios.post(`${API_URL}/api/tools/golden/winner`, { 
        unidade: currentUnit, 
        type: 'QUINTA_PREMIADA', 
        data: updated 
      });
      setSelectedLockerForPrize(null);
      toast.success("Resgate confirmado!");
    } catch (e) {
      toast.error("Erro ao salvar.");
    }
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      const redeemed = currentDraw.filter(i => i.status === 'redeemed').length;
      await axios.post(`${API_URL}/api/tools/history`, {
        tipo: 'QUINTA_PREMIADA',
        unidade: currentUnit.toUpperCase(),
        total_sorteados: currentDraw.length,
        total_resgatados: redeemed,
        detalhes: currentDraw
      });
      await axios.delete(`${API_URL}/api/tools/golden/winner/${currentUnit}`);
      toast.success("Finalizado com sucesso!");
      setCurrentDraw(null);
      setIsMonitoring(false);
    } catch (e) {
      toast.warning("Erro ao finalizar.");
    } finally {
      setShowFinalizeModal(false);
      setIsFinalizing(false);
      loadHistory();
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const cleanedConfig = cardConfig.map(c => ({ ...c, prize_details: {} }));
      await axios.post(`${API_URL}/api/tools/golden/config`, { 
        unidade: currentUnit, 
        cards: cleanedConfig 
      });
      toast.success("Configuração salva!");
      setShowConfigModal(false);
    } catch (e) {
      toast.error("Erro ao salvar.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const generatePrintReport = (drawData, dateLabel) => {
    if (!drawData) return;
    const printWindow = window.open('', '', 'height=800,width=900');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Quinta Premiada</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; color: #000; }
            h1 { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #eee; }
            .redeemed { font-weight: bold; color: green; }
            .lost { color: red; text-decoration: line-through; }
            .summary { margin-top: 20px; text-align: right; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${pollConfig.name} - ${dateLabel}</h1>
          <table>
            <thead>
              <tr>
                <th>Armário</th>
                <th>Card</th>
                <th>Prêmio</th>
                <th>Status</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              ${drawData.map(d => `
                <tr>
                  <td>${d.locker} (${d.size || '?'})</td>
                  <td>#${d.card_index || '?'}</td>
                  <td>${d.prize || '-'}</td>
                  <td class="${d.status}">${d.status === 'redeemed' ? 'RESGATADO' : d.status.toUpperCase()}</td>
                  <td>${d.details || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">
            Total Sorteado: ${drawData.length} | 
            Resgatados: ${drawData.filter(i => i.status === 'redeemed').length}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <Sidebar 
        activePage="thursday" 
        headerTitle="Quinta Premiada" 
        headerIcon="stars" 
        group="maintenance" 
        unit={currentUnit} 
      />

      <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-8 flex-shrink-0">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              {pollConfig.name} 
              <span className="text-sm font-normal opacity-50 block">Quinta Premiada</span>
            </h1>
            {isMonitoring && (
              <span className="flex items-center gap-2 text-green-400 text-xs font-bold animate-pulse mt-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span> 
                MONITORANDO EM TEMPO REAL
              </span>
            )}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setShowConfigModal(true)} 
              className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 flex gap-2"
            >
              <span className="material-symbols-outlined">settings</span> 
              CONFIGURAR
            </button>

            <button 
              onClick={() => generatePrintReport(currentDraw, "Sorteio Atual")} 
              disabled={!currentDraw} 
              className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 flex gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">print</span> 
              IMPRIMIR
            </button>

            <button 
              onClick={handleNewDraw} 
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500 shadow-lg flex gap-2"
            >
              <span className="material-symbols-outlined">casino</span> 
              NOVO SORTEIO
            </button>

            {currentDraw && (
              <button 
                onClick={() => setShowFinalizeModal(true)} 
                className="bg-red-600/80 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 flex gap-2"
              >
                <span className="material-symbols-outlined">stop_circle</span> 
                FINALIZAR
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
          <div className="col-span-3 liquid-glass rounded-3xl p-4 overflow-y-auto custom-scrollbar">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">history</span> 
              Histórico
            </h3>

            {history.length === 0 && <p className="text-white/30 text-sm">Sem histórico.</p>}

            {history.map(h => (
              <div 
                key={h.id} 
                className="bg-white/5 p-3 rounded-lg mb-2 border border-white/5 text-sm flex justify-between items-center group cursor-pointer hover:bg-white/10"
              >
                <div>
                  <p className="text-white font-bold">
                    {new Date(h.data_hora).toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      hour: '2-digit', 
                      minute:'2-digit' 
                    })}
                  </p>
                  <p className="text-white/50">{h.total_resgatados}/{h.total_sorteados} resgatados</p>
                </div>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    generatePrintReport(h.detalhes, new Date(h.data_hora).toLocaleString()); 
                  }} 
                  className="text-white/30 hover:text-white"
                >
                  <span className="material-symbols-outlined">print</span>
                </button>
              </div>
            ))}
          </div>

          <div className="col-span-9 liquid-glass rounded-3xl p-6 relative overflow-y-auto custom-scrollbar">
            {!currentDraw ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20">
                <span className="material-symbols-outlined text-8xl mb-4">stars</span>
                <p className="text-xl font-bold uppercase">Aguardando Sorteio</p>
              </div>
            ) : (
              <div className="grid grid-cols-10 gap-2 content-start">
                {currentDraw.map((item) => (
                  <div 
                    key={item.locker} 
                    onClick={() => handleLockerClick(item)} 
                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center transition-all relative p-1
                      ${item.status === 'occupied' ? 'bg-green-600 border-green-400 animate-pulse cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.5)] hover:scale-105' : 
                        item.status === 'redeemed' ? 'bg-purple-600 border-purple-400 opacity-80 cursor-default' : 
                        item.status === 'lost' ? 'bg-red-900 border-red-500 cursor-default' : 
                        'bg-white/5 border-white/10 text-white/50 cursor-default'}`} 
                  >
                    <span className="text-xs font-black text-yellow-400 mb-0.5">{item.size}</span>
                    <span className="text-lg font-bold text-white leading-none">{item.locker}</span>
                    <div className="mt-1 flex flex-col items-center">
                      <span className="text-[8px] font-bold uppercase bg-black/30 px-1 rounded text-white/80">
                        CARD {item.card_index}
                      </span>
                    </div>
                    
                    {item.status === 'occupied' && (
                      <span className="material-symbols-outlined absolute -top-1 -right-1 text-sm bg-black rounded-full text-white shadow-sm">
                        priority_high
                      </span>
                    )}
                    {item.status === 'redeemed' && (
                      <span className="material-symbols-outlined absolute -top-1 -right-1 text-sm bg-white rounded-full text-purple-600 shadow-sm">
                        check
                      </span>
                    )}
                    {item.status === 'lost' && (
                      <span className="material-symbols-outlined absolute -top-1 -right-1 text-sm bg-white rounded-full text-red-600 shadow-sm">
                        close
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {currentDraw && (
              <div className="mt-8 border-t border-white/10 pt-4">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400">emoji_events</span> 
                  Resgatados Recentemente
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {currentDraw.filter(i => i.status === 'redeemed').length === 0 && (
                    <p className="text-white/30 text-sm">Nenhum resgate efetuado.</p>
                  )}
                  {currentDraw.filter(i => i.status === 'redeemed').map(i => (
                    <div 
                      key={i.locker} 
                      className="bg-purple-900/40 border border-purple-500/30 rounded px-3 py-1 text-xs text-purple-200 flex items-center gap-2"
                    >
                      <span className="font-bold text-white">{i.locker}</span> 
                      <span>{i.prize}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="bg-[#1a1a1a] rounded-3xl p-6 w-full max-w-5xl h-[85vh] flex flex-col border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-white font-bold text-xl">Configuração dos Cards</h2>
                <p className="text-white/50 text-xs">Defina a categoria de prêmio para cada um dos 50 cartões físicos.</p>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)} 
                className="text-white/50 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3 overflow-y-auto custom-scrollbar p-2 flex-1 content-start">
              {cardConfig.map((card, idx) => (
                <div 
                  key={idx} 
                  className={`p-2 rounded border flex flex-col gap-1 text-xs ${
                    card.prize_type !== 'sem_premio' ? 'bg-blue-900/20 border-blue-500/50' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 font-bold">CARD #{idx + 1}</span>
                    {card.prize_type !== 'sem_premio' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                  </div>
                  <select 
                    className="bg-black/50 border border-white/20 rounded text-white p-1 outline-none w-full"
                    value={card.prize_type}
                    onChange={(e) => {
                      const newC = [...cardConfig];
                      newC[idx] = { index: idx, prize_type: e.target.value, prize_details: {} };
                      setCardConfig(newC);
                    }}
                  >
                    <option value="sem_premio">Sem Prêmio</option>
                    {PRIZE_CATEGORIES.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end gap-3">
              <button 
                onClick={() => setShowConfigModal(false)} 
                className="text-white font-bold px-4 hover:underline"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveConfig} 
                className="bg-blue-600 px-6 py-2 rounded-xl text-white font-bold hover:bg-blue-500 transition-colors shadow-lg flex items-center gap-2"
              >
                {isSavingConfig 
                  ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> 
                  : <span className="material-symbols-outlined text-sm">save</span>} 
                SALVAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-500 text-4xl">warning</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Finalizar Promoção?</h2>
            <p className="text-text-muted mb-8">O sorteio atual será encerrado e a tela limpa.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowFinalizeModal(false)} 
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleFinalize} 
                disabled={isFinalizing} 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
              >
                {isFinalizing ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'FINALIZAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLockerForPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <GiftList
            lockerNumber={selectedLockerForPrize.locker}
            onCancel={() => setSelectedLockerForPrize(null)}
            onConfirm={handleGiftConfirm}
            unit={currentUnit}
            preselectedPrize={selectedLockerForPrize.prize_type_id}
            preselectedDetails={selectedLockerForPrize.details_obj}
            clientData={selectedLockerForPrize.clientInfo} 
          />
        </div>
      )}
    </div>
  );
}