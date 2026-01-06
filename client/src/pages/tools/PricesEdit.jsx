import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PricesEdit() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editType, setEditType] = useState('padrao');

    const [config, setConfig] = useState({
        titulo_tabela: '',
        qtd_categorias: 3,
        modo_exibicao: 'tv',
        aviso_1: '',
        aviso_2: '',
        aviso_3: '',
        aviso_4: '',
        categorias: []
    });

    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [newHolidayName, setNewHolidayName] = useState('');
    const [newHolidayDate, setNewHolidayDate] = useState('');

    const [showPromoModal, setShowPromoModal] = useState(false);
    const [promotions, setPromotions] = useState([]);

    const [livePrices, setLivePrices] = useState(null);

    useEffect(() => {
        loadHolidays();
        loadLivePrices();
        loadPromotions();
    }, [currentUnit]);

    useEffect(() => {
        loadConfigData();
    }, [currentUnit, editType]);

    const loadConfigData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/prices/config/${currentUnit}/${editType}`);
            let data = res.data;

            data.titulo_tabela = data.titulo_tabela || '';
            data.aviso_1 = data.aviso_1 || '';
            data.aviso_2 = data.aviso_2 || '';
            data.aviso_3 = data.aviso_3 || '';
            data.aviso_4 = data.aviso_4 || '';

            if (!data.categorias || data.categorias.length === 0) {
                data.categorias = createEmptyCategories(data.qtd_categorias || 3);
            } else {
                data.categorias = data.categorias.map(cat => ({
                    titulo: cat.titulo || '',
                    video: cat.video || '',
                    preco_p1: cat.preco_p1 || '',
                    preco_p2: cat.preco_p2 || '',
                    preco_p3: cat.preco_p3 || '',
                    aviso_categoria: cat.aviso_categoria || ''
                }));
            }

            setConfig(data);
        } catch (error) {
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const loadHolidays = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/prices/holidays/${currentUnit}`);
            setHolidays(res.data);
        } catch (e) { }
    };

    const loadLivePrices = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/prices/display/${currentUnit}`);
            setLivePrices(res.data);
        } catch (e) { }
    };

    const loadPromotions = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/prices/promotions/${currentUnit}`);
            const formatted = res.data.map(p => ({
                ...p,
                dias_ativos: Array.isArray(p.dias_ativos) ? p.dias_ativos : JSON.parse(p.dias_ativos || '[]')
            }));
            setPromotions(formatted);
        } catch (e) { }
    };

    const handleSaveHoliday = async () => {
        if (!newHolidayName || !newHolidayDate) return toast.warning("Preencha nome e data.");
        try {
            await axios.post(`${API_URL}/api/prices/holidays`, {
                unidade: currentUnit,
                nome: newHolidayName,
                data_feriado: newHolidayDate
            });
            toast.success("Adicionado!");
            setNewHolidayName('');
            setNewHolidayDate('');
            loadHolidays();
        } catch (error) {
            toast.error("Erro ao adicionar.");
        }
    };

    const handleDeleteHoliday = async (id) => {
        try {
            await axios.delete(`${API_URL}/api/prices/holidays/${id}`);
            loadHolidays();
            toast.success("Removido.");
        } catch (e) { }
    };

    const handlePromoUpload = async (file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('priceMedia', file);

        const toastId = toast.loading("Enviando imagem...");
        try {
            const res = await axios.post(`${API_URL}/api/prices/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

            setPromotions(prev => [
                ...prev,
                { image_url: res.data.url, dias_ativos: [] }
            ]);

            toast.update(toastId, { render: "Imagem enviada!", type: "success", isLoading: false, autoClose: 2000 });
        } catch (error) {
            toast.update(toastId, { render: "Erro no upload.", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const togglePromoDay = (index, dayCode) => {
        setPromotions(prev => {
            const newPromos = [...prev];
            const targetPromo = { ...newPromos[index] };

            const currentDays = (targetPromo.dias_ativos || []).map(String);
            const targetDay = String(dayCode);

            if (currentDays.includes(targetDay)) {
                targetPromo.dias_ativos = currentDays.filter(d => d !== targetDay);
            } else {
                targetPromo.dias_ativos = [...currentDays, targetDay];
            }

            newPromos[index] = targetPromo;
            return newPromos;
        });
    };

    const removePromo = (index) => {
        setPromotions(prev => prev.filter((_, i) => i !== index));
    };

    const handleSavePromotions = async () => {
        setSaving(true);
        try {
            await axios.post(`${API_URL}/api/prices/promotions`, {
                unidade: currentUnit,
                promotions: promotions
            });
            toast.success("Promoções salvas com sucesso!");
            setShowPromoModal(false);
            loadLivePrices();
        } catch (e) {
            console.error(e);
            toast.error("Erro ao salvar promoções.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTable = async () => {
        try {
            const autoTitle = `Tabela ${getTypeLabel(editType)}`;
            await axios.post(`${API_URL}/api/prices/config`, {
                unidade: currentUnit,
                tipo: editType,
                titulo_tabela: autoTitle,
                ...config
            });
            toast.success(`Tabela salva!`);
            loadLivePrices();
        } catch (error) {
            toast.error("Erro ao salvar.");
        }
    };

    const createEmptyCategories = (qty) => Array.from({ length: qty }).map((_, i) => ({
        titulo: `Categoria ${i + 1}`,
        video: '',
        preco_p1: '',
        preco_p2: '',
        preco_p3: '',
        aviso_categoria: ''
    }));

    const getTypeLabel = (type) => {
        if (type === 'padrao') return 'Seg-Sex';
        if (type === 'fim_de_semana') return 'Sáb-Dom';
        if (type === 'feriado') return 'Feriados';
        return type;
    };

    const formatCurrency = (value) => {
        if (!value) return '';
        const numericValue = value.toString().replace(/\D/g, '');
        if (!numericValue) return '';
        const floatValue = parseFloat(numericValue) / 100;
        return floatValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const handlePriceChange = (index, field, rawValue) => {
        handleCategoryChange(index, field, formatCurrency(rawValue));
    };

    const handleConfigChange = (field, value) => setConfig(prev => {
        let newConfig = { ...prev, [field]: value };
        if (field === 'qtd_categorias') {
            const newQty = parseInt(value);
            const currentCats = [...prev.categorias];
            if (newQty > currentCats.length) {
                while (currentCats.length < newQty) currentCats.push({ titulo: 'Nova', video: '', preco_p1: '', preco_p2: '', preco_p3: '', aviso_categoria: '' });
            } else {
                currentCats.length = newQty;
            }
            newConfig.categorias = currentCats;
        }
        return newConfig;
    });

    const handleCategoryChange = (index, field, value) => setConfig(prev => {
        const newCats = [...prev.categorias];
        newCats[index] = { ...newCats[index], [field]: value };
        return { ...prev, categorias: newCats };
    });

    const handleUpload = async (index, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('priceMedia', file);
        const toastId = toast.loading("Enviando...");
        try {
            const res = await axios.post(`${API_URL}/api/prices/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            handleCategoryChange(index, 'video', res.data.url);
            toast.update(toastId, { render: "Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
        } catch (error) {
            toast.update(toastId, { render: "Erro.", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const DAYS_OPTIONS = [
        { code: '1', label: 'S', title: 'Segunda' },
        { code: '2', label: 'T', title: 'Terça' },
        { code: '3', label: 'Q', title: 'Quarta' },
        { code: '4', label: 'Q', title: 'Quinta' },
        { code: '5', label: 'S', title: 'Sexta' },
        { code: '6', label: 'S', title: 'Sábado' },
        { code: '0', label: 'D', title: 'Domingo' },
        { code: 'HOLIDAY', label: 'F', title: 'Feriados' }
    ];

    return (
        <div className="min-h-screen bg-gradient-warm flex">
            <Sidebar activePage="prices-maintenance" headerTitle="Tabela de Preços" headerIcon="price_change" group="maintenance" unit={currentUnit} />

            <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col relative">

                <div className="flex justify-between items-start mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-1">Editor de Preços</h1>
                        <p className="text-white/50 text-sm">Configure os preços por turno e feriados</p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setShowPromoModal(true)} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/50 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                            <span className="material-symbols-outlined">campaign</span> GERENCIAR PROMOÇÕES
                        </button>
                        <button onClick={() => setShowHolidayModal(true)} className="bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 border border-yellow-600/50 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                            <span className="material-symbols-outlined">event</span> GERENCIAR FERIADOS
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-24 pr-2">

                    <div className="liquid-glass p-5 rounded-2xl border border-white/5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">

                            <div>
                                <label className="block text-xs text-white/50 uppercase font-bold mb-2 ml-1">Turno de Aplicação</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditType('padrao')} className={`flex-1 py-3 rounded-lg flex flex-col items-center justify-center gap-1 transition-all border ${editType === 'padrao' ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-black/30 border-white/10 text-white/40 hover:bg-white/5 hover:text-white'}`}>
                                        <span className="material-symbols-outlined text-xl">calendar_month</span><span className="text-[10px] font-bold tracking-wide">SEG A SEX</span>
                                    </button>
                                    <button onClick={() => setEditType('fim_de_semana')} className={`flex-1 py-3 rounded-lg flex flex-col items-center justify-center gap-1 transition-all border ${editType === 'fim_de_semana' ? 'bg-green-600 text-white border-green-500 shadow-md' : 'bg-black/30 border-white/10 text-white/40 hover:bg-white/5 hover:text-white'}`}>
                                        <span className="material-symbols-outlined text-xl">weekend</span><span className="text-[10px] font-bold tracking-wide">SÁB E DOM</span>
                                    </button>
                                    <button onClick={() => setEditType('feriado')} className={`flex-1 py-3 rounded-lg flex flex-col items-center justify-center gap-1 transition-all border ${editType === 'feriado' ? 'bg-yellow-600 text-white border-yellow-500 shadow-md' : 'bg-black/30 border-white/10 text-white/40 hover:bg-white/5 hover:text-white'}`}>
                                        <span className="material-symbols-outlined text-xl">celebration</span><span className="text-[10px] font-bold tracking-wide">FERIADOS</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-white/50 uppercase font-bold mb-2 ml-1">Modelo de Preços</label>
                                <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 h-[66px]">
                                    <button onClick={() => handleConfigChange('qtd_categorias', 1)} className={`flex-1 rounded-md text-xs font-bold transition-all ${config.qtd_categorias === 1 ? 'bg-blue-600 text-white shadow' : 'text-white/30 hover:text-white'}`}>1 ÚNICO</button>
                                    <button onClick={() => handleConfigChange('qtd_categorias', 3)} className={`flex-1 rounded-md text-xs font-bold transition-all ${config.qtd_categorias === 3 ? 'bg-blue-600 text-white shadow' : 'text-white/30 hover:text-white'}`}>3 OPÇÕES</button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-white/50 uppercase font-bold mb-2 ml-1">Versão de Tela</label>
                                <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 h-[66px]">
                                    <button onClick={() => handleConfigChange('modo_exibicao', 'tv')} className={`flex-1 rounded-md text-xs font-bold transition-all ${config.modo_exibicao === 'tv' ? 'bg-purple-600 text-white shadow' : 'text-white/30 hover:text-white'}`}>TV</button>
                                    <button onClick={() => handleConfigChange('modo_exibicao', 'tablet')} className={`flex-1 rounded-md text-xs font-bold transition-all ${config.modo_exibicao === 'tablet' ? 'bg-purple-600 text-white shadow' : 'text-white/30 hover:text-white'}`}>TABLET</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`grid gap-6 ${config.qtd_categorias === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 lg:grid-cols-3'}`}>
                        {config.categorias.map((cat, idx) => (
                            <div key={idx} className="liquid-glass p-5 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-white font-bold text-lg">Opção {idx + 1}</h3>
                                    <span className="bg-white/10 text-white/60 px-2 py-1 rounded text-xs font-bold uppercase">Coluna {idx + 1}</span>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-white/40 uppercase font-bold">Título da Categoria</label>
                                        <input type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:border-blue-500 outline-none" placeholder="Ex: Pista" value={cat.titulo} onChange={(e) => handleCategoryChange(idx, 'titulo', e.target.value)} />
                                    </div>

                                    <div className="relative w-full h-32 bg-black/40 rounded-lg border border-dashed border-white/20 overflow-hidden group">
                                        {cat.video ? (
                                            <>
                                                {cat.video.endsWith('.mp4') || cat.video.endsWith('.webm') ? <video src={`${API_URL}${cat.video}`} className="w-full h-full object-cover opacity-60" autoPlay loop muted /> : <img src={`${API_URL}${cat.video}`} alt="BG" className="w-full h-full object-cover opacity-60" />}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs backdrop-blur-md flex items-center gap-2"><span className="material-symbols-outlined text-sm">upload</span> Trocar <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleUpload(idx, e.target.files[0])} /></label>
                                                </div>
                                            </>
                                        ) : (
                                            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors text-white/30 hover:text-white"><span className="material-symbols-outlined text-2xl mb-1">movie</span><span className="text-[10px] uppercase font-bold">Mídia</span><input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleUpload(idx, e.target.files[0])} /></label>
                                        )}
                                    </div>

                                    <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-white/5">
                                        <div><label className="text-[10px] text-white/40 uppercase font-bold">Manhã/Tarde</label><input type="text" className="w-full bg-transparent border-b border-white/10 p-1 focus:border-green-500 outline-none font-mono text-lg text-green-400 placeholder-white/10" placeholder="R$ 0,00" value={cat.preco_p1} onChange={(e) => handlePriceChange(idx, 'preco_p1', e.target.value)} /></div>
                                        <div><label className="text-[10px] text-white/40 uppercase font-bold">Tarde/Noite</label><input type="text" className="w-full bg-transparent border-b border-white/10 p-1 focus:border-green-500 outline-none font-mono text-lg text-green-400 placeholder-white/10" placeholder="R$ 0,00" value={cat.preco_p2} onChange={(e) => handlePriceChange(idx, 'preco_p2', e.target.value)} /></div>
                                        <div><label className="text-[10px] text-white/40 uppercase font-bold">Noite/Madrugada</label><input type="text" className="w-full bg-transparent border-b border-white/10 p-1 focus:border-green-500 outline-none font-mono text-lg text-green-400 placeholder-white/10" placeholder="R$ 0,00" value={cat.preco_p3} onChange={(e) => handlePriceChange(idx, 'preco_p3', e.target.value)} /></div>
                                    </div>

                                    <div><label className="text-[10px] text-white/40 uppercase font-bold">Mensagem / Aviso</label><textarea className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:border-blue-500 outline-none text-sm h-20 resize-none" placeholder="Ex: Aviso..." value={cat.aviso_categoria} onChange={(e) => handleCategoryChange(idx, 'aviso_categoria', e.target.value)}></textarea></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="liquid-glass p-6 rounded-2xl border border-white/5">
                        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-400">warning</span> Avisos Importantes da Tabela
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Aviso #1</label><input type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none" value={config.aviso_1} onChange={(e) => handleConfigChange('aviso_1', e.target.value)} /></div>
                            <div><label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Aviso #2</label><input type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none" value={config.aviso_2} onChange={(e) => handleConfigChange('aviso_2', e.target.value)} /></div>
                            <div><label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Aviso #3</label><input type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none" value={config.aviso_3} onChange={(e) => handleConfigChange('aviso_3', e.target.value)} /></div>
                            <div><label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Aviso #4</label><input type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none" value={config.aviso_4} onChange={(e) => handleConfigChange('aviso_4', e.target.value)} /></div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 w-full bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/10 p-4 px-8 flex justify-between items-center z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            NO AR AGORA: <span className="text-white">{livePrices ? getTypeLabel(livePrices.debug_info?.tipo_detectado || 'padrao').toUpperCase() : 'CARREGANDO...'}</span>
                        </span>
                        {livePrices && livePrices.categorias.length > 0 && (
                            <div className="flex gap-4">
                                {livePrices.categorias.slice(0, 3).map((c, i) => (
                                    <div key={i} className="flex gap-2 text-xs font-mono text-white/60 bg-white/5 px-2 py-1 rounded">
                                        <span className="text-white font-bold">{c.titulo}:</span>
                                        <span className="text-green-400">{c.preco_p1 || '-'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={handleSaveTable} className="bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-green-900/30 transition-all hover:scale-105">
                        <span className="material-symbols-outlined">save</span> SALVAR TABELA
                    </button>
                </div>
            </main>

            {showHolidayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col relative overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3"><span className="material-symbols-outlined text-yellow-400 text-3xl">event_available</span> Gerenciar Feriados</h2>
                            <button onClick={() => setShowHolidayModal(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"><span className="material-symbols-outlined text-white">close</span></button>
                        </div>
                        <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto custom-scrollbar bg-black/40">
                            <div className="bg-gradient-to-r from-yellow-900/20 to-transparent p-6 rounded-2xl border border-yellow-500/20">
                                <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-4">Adicionar Novo Feriado</h3>
                                <div className="flex gap-4 items-end">
                                    <div className="flex-1"><label className="block text-xs text-white/40 font-bold mb-1">Nome do Evento</label><input type="text" placeholder="Ex: Natal" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500 transition-colors" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} /></div>
                                    <div className="w-48"><label className="block text-xs text-white/40 font-bold mb-1">Data</label><input type="date" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500 transition-colors" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} /></div>
                                    <button onClick={handleSaveHoliday} className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg h-[50px]"><span className="material-symbols-outlined">add_circle</span> CADASTRAR</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {holidays.map(h => (
                                    <div key={h.id} className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 hover:border-white/20 transition-all group flex justify-between items-center shadow-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-white/5 flex flex-col items-center justify-center text-white/80 font-bold leading-tight"><span className="text-lg">{new Date(h.data_feriado).getUTCDate()}</span><span className="text-[10px] uppercase text-white/40">{new Date(h.data_feriado).toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')}</span></div>
                                            <div><p className="text-white font-bold text-lg">{h.nome}</p><p className="text-white/30 text-xs uppercase font-bold">{new Date(h.data_feriado).getFullYear()}</p></div>
                                        </div>
                                        <button onClick={() => handleDeleteHoliday(h.id)} className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined">delete</span></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPromoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-6xl h-[85vh] shadow-2xl flex flex-col relative overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3"><span className="material-symbols-outlined text-blue-400 text-3xl">campaign</span> Gerenciar Promoções</h2>
                            <button onClick={() => setShowPromoModal(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"><span className="material-symbols-outlined text-white">close</span></button>
                        </div>
                        <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto custom-scrollbar bg-black/40">
                            <div className="bg-gradient-to-r from-blue-900/20 to-transparent p-6 rounded-2xl border border-blue-500/20 flex justify-between items-center">
                                <div><h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-1">Nova Imagem Promocional</h3><p className="text-white/40 text-xs">Adicione flyers que substituirão a tabela em dias específicos.</p></div>
                                <label className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-lg transition-all hover:scale-105">
                                    <span className="material-symbols-outlined">add_photo_alternate</span> SELECIONAR IMAGEM
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePromoUpload(e.target.files[0])} />
                                </label>
                            </div>
                            {promotions.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-2xl"><span className="material-symbols-outlined text-6xl mb-4">perm_media</span><p>Nenhuma promoção ativa.</p></div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {promotions.map((promo, idx) => (
                                        <div key={idx} className="bg-[#1a1a1a] rounded-2xl border border-white/10 overflow-hidden flex flex-col group hover:border-white/30 transition-all shadow-lg">
                                            <div className="relative aspect-video w-full bg-black">
                                                <img src={`${API_URL}${promo.image_url}`} alt="Promo" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity" />
                                                <button onClick={() => removePromo(idx)} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"><span className="material-symbols-outlined text-sm">delete</span></button>
                                            </div>
                                            <div className="p-4 bg-[#151515]">
                                                <p className="text-[10px] text-white/40 uppercase font-bold mb-3 text-center">Dias Ativos</p>
                                                <div className="flex justify-between gap-1">
                                                    {DAYS_OPTIONS.map((day) => {
                                                        const activeDays = (promo.dias_ativos || []).map(String);
                                                        const isActive = activeDays.includes(day.code);
                                                        return (
                                                            <button key={day.code} onClick={() => togglePromoDay(idx, day.code)} title={day.title} className={`w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center transition-all ${isActive ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)] scale-110' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>{day.label}</button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-white/10 bg-[#1a1a1a] flex justify-end">
                            <button onClick={handleSavePromotions} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50">
                                <span className="material-symbols-outlined">save</span> {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}