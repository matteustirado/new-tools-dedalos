import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';
import { EMOJI_DATA, COLOR_PALETTE } from '../../assets/emojis/KeyboardEmojis';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const EmojiPickerInline = ({ onSelect, onClose, recentEmojis }) => {
    const [activeTab, setActiveTab] = useState('recents');

    const categories = [
        { id: 'recents', icon: '🕒', label: 'Recentes', emojis: recentEmojis },
        ...EMOJI_DATA
    ];

    const currentEmojis = categories.find(c => c.id === activeTab)?.emojis || [];

    return (
        <div className="absolute inset-0 z-50 bg-[#121212] flex flex-col animate-fade-in overflow-hidden rounded-xl border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between bg-black/60 p-2 border-b border-white/10 backdrop-blur-md shrink-0">
                <div className="flex gap-1 overflow-x-auto custom-scrollbar no-scrollbar flex-1 mr-2">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={`p-1.5 rounded-lg text-sm transition-all min-w-[32px] flex items-center justify-center ${
                                activeTab === cat.id 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'text-white/40 hover:bg-white/10 hover:text-white'
                            }`}
                            title={cat.label}
                        >
                            {cat.icon}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={onClose} 
                    className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors flex-shrink-0 border border-red-500/20"
                >
                    <span className="material-symbols-outlined text-base">close</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[#181818]">
                {currentEmojis.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20">
                        <span className="material-symbols-outlined text-3xl mb-2">sentiment_dissatisfied</span>
                        <p className="text-xs">Nenhum emoji recente</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-6 gap-1">
                        {currentEmojis.map((emoji, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => onSelect(emoji)} 
                                className="aspect-square hover:bg-white/10 rounded-lg flex items-center justify-center text-2xl transition-transform hover:scale-110 active:scale-95"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ColorPicker = ({ onSelect, onClose }) => {
    return (
        <div className="absolute top-9 right-0 z-50 bg-[#1a1a1a] border border-white/20 rounded-xl p-3 shadow-2xl w-48 animate-fade-in origin-top-right">
            <div className="grid grid-cols-5 gap-2">
                {COLOR_PALETTE.map((colorHex, idx) => (
                    <button 
                        key={idx}
                        onClick={() => { onSelect(colorHex); onClose(); }}
                        className="w-7 h-7 rounded-full border border-white/10 hover:scale-110 transition-transform shadow-sm relative group"
                        style={{ backgroundColor: colorHex }}
                        title={`Cor ${idx + 1}`}
                    />
                ))}
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 text-center">
                <button 
                    onClick={onClose} 
                    className="text-[10px] text-white/40 hover:text-white uppercase font-bold tracking-wider"
                >
                    Fechar
                </button>
            </div>
        </div>
    );
};

const OptionCard = ({ 
    opt, 
    index, 
    handleOptionChange, 
    handleRemoveOption, 
    handleImageUpload, 
    setActiveColorPickerIndex, 
    activeColorPickerIndex, 
    recentEmojis,
    onEmojiSelect
}) => {
    const [activeTab, setActiveTab] = useState('game');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const context = activeTab;
    const tipoKey = `${context}_tipo`;
    const valorKey = `${context}_valor`;
    const isEmoji = opt[tipoKey] === 'emoji';

    return (
        <div className="bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/20 transition-all relative group flex flex-col gap-3 h-full">
            <div className="absolute top-2 right-2 flex items-center gap-2">
                <span className="font-black text-white/10 text-xl pointer-events-none">#{index + 1}</span>
                <button 
                    onClick={() => handleRemoveOption(index)} 
                    className="text-white/10 hover:text-red-500 transition-colors p-1"
                    title="Remover Opção"
                >
                    <span className="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
            
            <div className="pr-12">
                <label className="text-[10px] text-white/40 uppercase font-bold">Nome</label>
                <div className="relative flex items-center mt-1">
                    <input 
                        type="text" 
                        className="w-full bg-transparent border-b border-white/10 focus:border-blue-500 text-white p-1 pr-8 outline-none font-medium text-sm" 
                        value={opt.nome} 
                        onChange={(e) => handleOptionChange(index, 'nome', e.target.value)} 
                        placeholder={`Opção ${index + 1}`} 
                    />
                    <button 
                        className="w-5 h-5 rounded-full absolute right-1 top-1/2 -translate-y-1/2 border border-white/30 shadow-sm hover:scale-110 transition-transform"
                        style={{ backgroundColor: opt.cor || COLOR_PALETTE[index % COLOR_PALETTE.length] }}
                        onClick={() => setActiveColorPickerIndex(activeColorPickerIndex === index ? null : index)}
                        title="Alterar cor"
                    />
                    {activeColorPickerIndex === index && (
                        <ColorPicker 
                            onSelect={(color) => { handleOptionChange(index, 'cor', color); setActiveColorPickerIndex(null); }} 
                            onClose={() => setActiveColorPickerIndex(null)}
                        />
                    )}
                </div>
            </div>

            <div className="bg-black/20 rounded-lg p-2 border border-white/5 flex flex-col relative group/control h-72">
                <div className="flex bg-black/40 rounded-lg p-1 mb-2 border border-white/5 shrink-0">
                    <button 
                        onClick={() => setActiveTab('game')} 
                        className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold uppercase transition-all ${activeTab === 'game' ? 'bg-white/10 text-white shadow-sm' : 'text-white/30 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-xs">sports_esports</span> Game
                    </button>
                    <button 
                        onClick={() => setActiveTab('display')} 
                        className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold uppercase transition-all ${activeTab === 'display' ? 'bg-white/10 text-white shadow-sm' : 'text-white/30 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-xs">tv</span> Placar
                    </button>
                </div>

                <div className="flex justify-between items-center mb-2 px-1 shrink-0">
                    <span className="text-[9px] text-white/30 uppercase font-bold">
                        {activeTab === 'game' ? 'Visual do Celular' : 'Visual da TV'}
                    </span>
                    <div className="flex gap-1">
                        {['emoji', 'image'].map(type => (
                            <button 
                                key={type} 
                                onClick={() => handleOptionChange(index, tipoKey, type)} 
                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border transition-colors ${opt[tipoKey] === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-white/10 text-white/30 hover:text-white'}`}
                            >
                                {type === 'emoji' ? 'Emoji' : 'Img'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative flex-1 rounded bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
                    {isEmoji ? (
                        <span className="text-6xl select-none">{opt[valorKey] || '❓'}</span>
                    ) : opt[valorKey] ? (
                        <img src={`${API_URL}${opt[valorKey]}`} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-white/20">
                            <span className="material-symbols-outlined text-4xl">image</span>
                            <span className="text-[10px] uppercase font-bold mt-2">Vazio</span>
                        </div>
                    )}
                    <button 
                        onClick={() => { if(isEmoji) setShowEmojiPicker(true); else document.getElementById(`file-${context}-${index}`).click(); }} 
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover/control:opacity-100 flex items-center justify-center text-white transition-opacity backdrop-blur-sm cursor-pointer z-10"
                    >
                        <span className="material-symbols-outlined text-3xl">edit</span>
                    </button>
                    {showEmojiPicker && isEmoji && (
                        <div className="absolute inset-0 z-20">
                            <EmojiPickerInline 
                                onSelect={(emoji) => { onEmojiSelect(index, context, emoji); setShowEmojiPicker(false); }} 
                                onClose={() => setShowEmojiPicker(false)} 
                                recentEmojis={recentEmojis} 
                            />
                        </div>
                    )}
                    <input 
                        type="file" 
                        id={`file-${context}-${index}`} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => handleImageUpload(index, context, e.target.files[0])} 
                    />
                </div>
            </div>
        </div>
    );
};

export default function ScoreboardEdit() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';
    
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({ titulo: '', layout: 'landscape', opcoes: [] });
    const [optionCount, setOptionCount] = useState(2);
    const [activeColorPickerIndex, setActiveColorPickerIndex] = useState(null);
    const [recentEmojis, setRecentEmojis] = useState(() => {
        try { 
            return JSON.parse(localStorage.getItem('dedalos_recent_emojis')) || []; 
        } catch { 
            return []; 
        }
    });

    const [showPresetsModal, setShowPresetsModal] = useState(false);
    const [presets, setPresets] = useState([]);
    const [presetName, setPresetName] = useState('');
    const [confirmModal, setConfirmModal] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        onConfirm: () => {}, 
        isDanger: false 
    });

    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => { 
        loadActiveConfig(); 
    }, [currentUnit]);

    const loadActiveConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/scoreboard/active/${currentUnit}`);
            const adaptedOptions = (res.data.opcoes || []).map(opt => ({
                ...opt,
                game_tipo: opt.game_tipo || opt.tipo || 'emoji',
                game_valor: opt.game_valor || opt.valor || '❓',
                display_tipo: opt.display_tipo || opt.tipo || 'emoji',
                display_valor: opt.display_valor || opt.valor || '❓'
            }));
            setConfig({ 
                titulo: res.data.titulo || '', 
                layout: res.data.layout || 'landscape', 
                opcoes: adaptedOptions 
            });
            setOptionCount(adaptedOptions.length || 2);
        } catch (error) { 
            toast.error("Erro ao carregar configuração."); 
        } finally { 
            setLoading(false); 
        }
    };

    const openConfirm = (title, message, action, isDanger = false) => {
        setConfirmModal({ 
            isOpen: true, 
            title, 
            message, 
            onConfirm: () => { 
                action(); 
                setConfirmModal(prev => ({...prev, isOpen: false})); 
            }, 
            isDanger 
        });
    };

    const handleEmojiSelectGlobal = (index, context, emoji) => {
        handleOptionChange(index, `${context}_valor`, emoji);
        setRecentEmojis(prev => {
            const newRecents = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 24);
            localStorage.setItem('dedalos_recent_emojis', JSON.stringify(newRecents));
            return newRecents;
        });
    };

    const handleImageUpload = async (index, context, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('scoreboardImage', file);
        const toastId = toast.loading("Enviando...");
        try {
            const res = await axios.post(`${API_URL}/api/scoreboard/upload`, formData, { 
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            handleOptionChange(index, `${context}_valor`, res.data.url);
            toast.update(toastId, { render: "Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
        } catch (error) { 
            toast.update(toastId, { render: "Erro no upload.", type: "error", isLoading: false, autoClose: 3000 }); 
        }
    };

    const handleCountChange = (e) => {
        let count = parseInt(e.target.value);
        if (count < 1) count = 1; 
        if (count > 10) count = 10;
        setOptionCount(count);
        setConfig(prev => {
            const newOpcoes = [...prev.opcoes];
            while (newOpcoes.length < count) {
                const colorIndex = newOpcoes.length % COLOR_PALETTE.length;
                newOpcoes.push({ 
                    nome: '', 
                    cor: COLOR_PALETTE[colorIndex], 
                    game_tipo: 'emoji', 
                    game_valor: '❓', 
                    display_tipo: 'emoji', 
                    display_valor: '❓' 
                });
            }
            if (newOpcoes.length > count) newOpcoes.length = count;
            return { ...prev, opcoes: newOpcoes };
        });
    };

    const handleOptionChange = (index, field, value) => {
        setConfig(prev => {
            const newOpcoes = [...prev.opcoes];
            newOpcoes[index] = { ...newOpcoes[index], [field]: value };
            if (field === 'game_tipo' && value === 'image' && !newOpcoes[index].game_valor.includes('/')) {
                newOpcoes[index].game_valor = '';
            }
            if (field === 'display_tipo' && value === 'image' && !newOpcoes[index].display_valor.includes('/')) {
                newOpcoes[index].display_valor = '';
            }
            return { ...prev, opcoes: newOpcoes };
        });
    };

    const handleRemoveOption = (index) => {
        if(optionCount <= 1) return;
        setConfig(prev => {
            const newOpcoes = [...prev.opcoes];
            newOpcoes.splice(index, 1);
            return { ...prev, opcoes: newOpcoes };
        });
        setOptionCount(prev => prev - 1);
    };

    const handleSaveActive = async () => {
        try {
            await axios.post(`${API_URL}/api/scoreboard/active`, { 
                unidade: currentUnit, 
                ...config, 
                status: 'ATIVO' 
            });
            toast.success("Placar atualizado!");
        } catch (error) { 
            toast.error("Erro ao salvar."); 
        }
    };

    const handleTestVote = async () => {
        try {
            const randomIndex = Math.floor(Math.random() * config.opcoes.length);
            await axios.post(`${API_URL}/api/scoreboard/vote`, { 
                unidade: currentUnit, 
                optionIndex: randomIndex 
            });
            toast.info(`Voto teste: Opção ${randomIndex + 1}`);
        } catch (error) { 
            toast.error("Erro no voto teste."); 
        }
    };

    const requestResetVotes = () => {
        openConfirm("Zerar Votos?", "Isso apagará a contagem atual de todas as opções.", async () => {
            try {
                await axios.post(`${API_URL}/api/scoreboard/reset-votes`, { unidade: currentUnit });
                toast.success("Zerado!");
            } catch (error) { 
                toast.error("Erro ao zerar."); 
            }
        }, true);
    };

    const loadPresets = async () => {
        try { 
            const res = await axios.get(`${API_URL}/api/scoreboard/presets/${currentUnit}`); 
            setPresets(res.data); 
        } catch (e) { 
            console.error("Erro presets:", e); 
        }
    };

    const handleSavePreset = async () => {
        if (!presetName) return toast.warning("Dê um nome.");
        try {
            await axios.post(`${API_URL}/api/scoreboard/presets`, { 
                unidade: currentUnit, 
                titulo_preset: presetName, 
                titulo_placar: config.titulo, 
                layout: config.layout, 
                opcoes: config.opcoes 
            });
            toast.success("Salvo!"); 
            setPresetName(''); 
            loadPresets();
        } catch (e) { 
            toast.error("Erro ao salvar predefinição."); 
        }
    };

    const requestApplyPreset = (preset) => {
        openConfirm("Carregar Predefinição?", `Deseja carregar "${preset.titulo_preset}"? A configuração atual será perdida.`, () => {
            const adaptedOptions = preset.opcoes.map(opt => ({
                ...opt,
                game_tipo: opt.game_tipo || opt.tipo || 'emoji',
                game_valor: opt.game_valor || opt.valor || '❓',
                display_tipo: opt.display_tipo || opt.tipo || 'emoji',
                display_valor: opt.display_valor || opt.valor || '❓'
            }));
            setConfig({ titulo: preset.titulo_placar, layout: preset.layout, opcoes: adaptedOptions });
            setOptionCount(adaptedOptions.length);
            setShowPresetsModal(false);
            toast.success("Predefinição carregada! Clique em 'ATIVAR' para enviar.");
        });
    };

    const requestDeletePreset = (id) => {
        openConfirm("Excluir Predefinição?", "Essa ação não pode ser desfeita.", async () => {
            try {
                await axios.delete(`${API_URL}/api/scoreboard/presets/${id}`);
                loadPresets(); 
                toast.success("Excluído.");
            } catch (e) { 
                toast.error("Erro ao excluir."); 
            }
        }, true);
    };

    const loadReport = async () => {
        setLoadingReport(true);
        try {
            const res = await axios.get(`${API_URL}/api/scoreboard/history/${currentUnit}?month=${reportMonth}&year=${reportYear}`);
            setReportData(res.data);
        } catch (error) {
            toast.error("Erro ao carregar relatório.");
        } finally {
            setLoadingReport(false);
        }
    };

    const formatPeriod = (entry, exit, status) => {
        const entryTime = new Date(entry).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (status === 'DENTRO') return `${entryTime} - DENTRO`;
        if (!exit || entry === exit) return `${entryTime} - N/A`;
        const exitTime = new Date(exit).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `${entryTime} - ${exitTime}`;
    };

    const getTurno = (dateStr) => {
        const h = new Date(dateStr).getHours();
        if (h >= 6 && h < 14) return '1 (06h - 14h)';
        if (h >= 14 && h < 22) return '2 (14h - 22h)';
        return '3 (22h - 06h)';
    };

    const realVotesList = reportData.filter(i => i.cliente_id && !i.cliente_id.startsWith('TESTE-') && !i.expires_at);
    const totalVotantes = realVotesList.filter(i => i.option_index !== null).length;
    const totalNaoVotantes = realVotesList.filter(i => i.option_index === null).length;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-warm flex">
            <Sidebar 
                activePage="scoreboard-maintenance" 
                headerTitle="Manutenção Placar" 
                headerIcon="settings_remote" 
                group="maintenance" 
                unit={currentUnit} 
            />

            <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Manutenção de Placar</h1>
                        <p className="text-white/50 text-sm">Configure o jogo de votação em tempo real</p>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setShowReportModal(true); loadReport(); }} 
                            className="bg-white/5 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors border border-white/10"
                        >
                            <span className="material-symbols-outlined text-lg">assessment</span> CONSULTAR VOTOS
                        </button>
                        <button 
                            onClick={() => { setShowPresetsModal(true); loadPresets(); }} 
                            className="bg-white/5 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors border border-white/10"
                        >
                            <span className="material-symbols-outlined text-lg">bookmarks</span> PREDEFINIÇÕES
                        </button>
                    </div>
                </div>

                <div className="liquid-glass p-5 rounded-2xl mb-6 flex-shrink-0">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-[10px] text-white/40 uppercase font-bold mb-1 ml-1">Título do Placar</label>
                            <input 
                                type="text" 
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-bold text-lg" 
                                placeholder="Ex: Quem é o melhor DJ?" 
                                value={config.titulo} 
                                onChange={(e) => setConfig({...config, titulo: e.target.value})} 
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-[10px] text-white/40 uppercase font-bold mb-1 ml-1">Layout</label>
                            <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 items-center">
                                <button 
                                    onClick={() => setConfig({...config, layout: 'landscape'})} 
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${config.layout === 'landscape' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-base">view_column</span> PAISAGEM
                                </button>
                                <button 
                                    onClick={() => setConfig({...config, layout: 'portrait'})} 
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${config.layout === 'portrait' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-base">view_stream</span> RETRATO
                                </button>
                            </div>
                        </div>
                        <div className="w-full md:w-24">
                            <label className="block text-[10px] text-white/40 uppercase font-bold mb-1 ml-1">Opções</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="10" 
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-bold text-lg text-center" 
                                value={optionCount} 
                                onChange={handleCountChange} 
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
                        {config.opcoes.map((opt, idx) => (
                            <OptionCard 
                                key={idx}
                                index={idx}
                                opt={opt}
                                handleOptionChange={handleOptionChange}
                                handleRemoveOption={handleRemoveOption}
                                handleImageUpload={handleImageUpload}
                                setActiveColorPickerIndex={setActiveColorPickerIndex}
                                activeColorPickerIndex={activeColorPickerIndex}
                                recentEmojis={recentEmojis}
                                onEmojiSelect={handleEmojiSelectGlobal}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-auto flex-shrink-0">
                    <div className="flex gap-3">
                        <button 
                            onClick={handleTestVote} 
                            className="bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl text-sm font-bold border border-white/10 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-yellow-400">science</span> TESTAR VOTO
                        </button>
                        <button 
                            onClick={requestResetVotes} 
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-bold border border-red-500/20 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">restart_alt</span> ZERAR
                        </button>
                    </div>
                    
                    <div className="flex gap-4 items-center">
                        <div className="flex gap-2 items-center bg-black/30 p-1 rounded-xl border border-white/5 pr-1 pl-3">
                            <input 
                                type="text" 
                                placeholder="Nome para salvar..." 
                                className="bg-transparent border-none text-white text-sm outline-none w-40 placeholder-white/30" 
                                value={presetName} 
                                onChange={(e) => setPresetName(e.target.value)} 
                            />
                            <button 
                                onClick={handleSavePreset} 
                                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">save</span>
                            </button>
                        </div>
                        <button 
                            onClick={handleSaveActive} 
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02]"
                        >
                            <span className="material-symbols-outlined">rocket_launch</span> ATIVAR PLACAR
                        </button>
                    </div>
                </div>
            </main>

            {showPresetsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[70vh]">
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-[#1a1a1a] rounded-t-3xl">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <span className="material-symbols-outlined text-blue-500">bookmarks</span> Predefinições Salvas
                            </h2>
                            <button 
                                onClick={() => setShowPresetsModal(false)} 
                                className="text-white/50 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20">
                            {presets.length === 0 ? (
                                <div className="text-center py-20 text-white/20">
                                    <span className="material-symbols-outlined text-4xl mb-2">folder_off</span>
                                    <p>Nenhuma predefinição encontrada.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {presets.map(preset => (
                                        <div 
                                            key={preset.id} 
                                            className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 hover:border-blue-500/50 transition-colors flex items-center gap-4 group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-white font-bold truncate">{preset.titulo_preset}</h3>
                                                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mt-1 truncate">
                                                    {preset.titulo_placar} • {preset.layout === 'landscape' ? 'Paisagem' : 'Retrato'} • {new Date(preset.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>

                                            <div className="flex gap-1 overflow-x-auto custom-scrollbar no-scrollbar max-w-[40%]">
                                                {preset.opcoes.map((opt, i) => {
                                                    const tipo = opt.game_tipo || opt.tipo;
                                                    const valor = opt.game_valor || opt.valor;
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className="w-8 h-8 flex-shrink-0 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-sm relative" 
                                                            style={{borderColor: opt.cor}}
                                                        >
                                                            {tipo === 'emoji' ? valor : <span className="material-symbols-outlined text-[10px] text-blue-400">image</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="flex gap-2 pl-4 border-l border-white/5 shrink-0">
                                                <button 
                                                    onClick={() => requestApplyPreset(preset)} 
                                                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-lg tracking-wider flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-sm">upload</span> CARREGAR
                                                </button>
                                                <button 
                                                    onClick={() => requestDeletePreset(preset.id)} 
                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded-lg border border-red-500/20 flex items-center justify-center"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-fade-in">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col h-[85vh]">
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-[#1a1a1a] rounded-t-3xl">
                            <div className="flex gap-4 items-center">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                    <span className="material-symbols-outlined text-blue-500">analytics</span> Relatório Analítico
                                </h2>
                                <div className="flex gap-2 ml-4 bg-black/40 p-1 rounded-lg border border-white/10">
                                    <select 
                                        className="bg-transparent text-white text-sm outline-none px-2 cursor-pointer font-bold"
                                        value={reportMonth}
                                        onChange={(e) => setReportMonth(e.target.value)}
                                    >
                                        {Array.from({length: 12}, (_, i) => (
                                            <option key={i+1} value={i+1} className="bg-black text-white">{new Date(0, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <select 
                                        className="bg-transparent text-white text-sm outline-none px-2 cursor-pointer font-bold border-l border-white/10"
                                        value={reportYear}
                                        onChange={(e) => setReportYear(e.target.value)}
                                    >
                                        {[2025, 2026, 2027].map(y => <option key={y} value={y} className="bg-black text-white">{y}</option>)}
                                    </select>
                                    <button onClick={loadReport} className="ml-2 bg-blue-600 hover:bg-blue-500 rounded px-3 py-1 text-xs font-bold text-white transition-colors">BUSCAR</button>
                                </div>
                            </div>
                            <button onClick={() => setShowReportModal(false)} className="text-white/50 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex gap-4 p-4 bg-black/20 border-b border-white/5 shrink-0">
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex-1 flex flex-col items-center justify-center">
                                <span className="text-[10px] text-blue-400 uppercase font-black tracking-widest">Público Votante</span>
                                <span className="text-4xl font-black text-white">{totalVotantes}</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1 flex flex-col items-center justify-center">
                                <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">Não Votaram</span>
                                <span className="text-4xl font-black text-white">{totalNaoVotantes}</span>
                            </div>
                            <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4 flex-1 flex flex-col items-center justify-center">
                                <span className="text-[10px] text-red-400/50 uppercase font-black tracking-widest">Testes de Sistema</span>
                                <span className="text-4xl font-black text-red-400/80">{reportData.length - realVotesList.length}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar bg-[#121212]">
                            {loadingReport ? (
                                <div className="flex flex-col items-center justify-center h-full text-white/30">
                                    <span className="material-symbols-outlined text-4xl animate-spin mb-2">refresh</span>
                                    <p className="text-sm font-bold tracking-widest uppercase">Processando Dados...</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                    <thead className="sticky top-0 bg-[#1a1a1a] z-10 shadow-md">
                                        <tr>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Data</th>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Dia</th>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Pulseira</th>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Nome</th>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Voto</th>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Período</th>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Turno</th>
                                            <th className="p-4 text-white/40 font-bold uppercase tracking-widest border-b border-white/10">Real</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {reportData.map((row) => {
                                            const isFake = !row.cliente_id || row.cliente_id.startsWith('TESTE-') || row.expires_at !== null;
                                            const isNonVoter = row.option_index === null;
                                            const dateObj = new Date(row.created_at);
                                            const currentVoteConfig = config.opcoes[row.option_index];

                                            return (
                                                <tr key={row.id} className={`hover:bg-white/5 transition-colors ${isFake ? 'opacity-40' : ''}`}>
                                                    <td className="p-4 text-white/80">{dateObj.toLocaleString('pt-BR')}</td>
                                                    <td className="p-4 text-white/60 capitalize">{dateObj.toLocaleDateString('pt-BR', { weekday: 'short' })}</td>
                                                    <td className="p-4 font-bold text-white">{isFake ? 'N/A' : (row.cliente_pulseira || row.cliente_id)}</td>
                                                    <td className="p-4 text-white/80 font-medium">
                                                        {isFake 
                                                            ? <span className="text-white/30">N/A</span> 
                                                            : (row.cliente_nome || <span className="text-white/40 italic">Desconhecido</span>)
                                                        }
                                                    </td>
                                                    <td className="p-4">
                                                        {isFake ? <span className="text-white/30">N/A</span> : 
                                                         isNonVoter ? <span className="bg-white/10 text-white/50 px-2 py-1 rounded text-[10px] font-bold">SEM VOTO</span> : 
                                                         <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded text-[10px] font-bold border border-blue-500/20 truncate max-w-[120px] inline-block">
                                                             {currentVoteConfig ? currentVoteConfig.nome || `Opção ${row.option_index + 1}` : `Opção ${row.option_index + 1}`}
                                                         </span>
                                                        }
                                                    </td>
                                                    <td className="p-4 text-white/60 font-mono">{isFake ? 'N/A' : formatPeriod(row.created_at, row.updated_at, row.status)}</td>
                                                    <td className="p-4 text-white/60">{isFake ? 'N/A' : getTurno(row.created_at)}</td>
                                                    <td className="p-4">
                                                        {isFake ? <span title="Voto Fake / Teste">🤖 Falso</span> : <span title="Cliente Real">👤 Verdadeiro</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {reportData.length === 0 && !loadingReport && (
                                            <tr>
                                                <td colSpan="8" className="p-8 text-center text-white/30">Nenhum dado encontrado para o período selecionado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmModal.isDanger ? 'bg-red-600/20' : 'bg-blue-600/20'}`}>
                            <span className={`material-symbols-outlined text-4xl ${confirmModal.isDanger ? 'text-red-500' : 'text-blue-500'}`}>
                                {confirmModal.isDanger ? 'warning' : 'info'}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h2>
                        <p className="text-white/60 mb-6 text-sm">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))} 
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold text-sm"
                            >
                                CANCELAR
                            </button>
                            <button 
                                onClick={confirmModal.onConfirm} 
                                className={`flex-1 py-3 rounded-xl font-bold text-sm shadow-lg ${confirmModal.isDanger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            >
                                CONFIRMAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}