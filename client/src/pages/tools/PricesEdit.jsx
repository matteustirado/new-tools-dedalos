import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import axios from 'axios';
import { 
    Settings, 
    Save, 
    AlertTriangle, 
    CheckCircle, 
    Clock, 
    History, 
    Upload, 
    PartyPopper, 
    Film, 
    Edit3, 
    ChevronDown, 
    ChevronUp, 
    ChevronLeft, 
    ChevronRight, 
    Trash2 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PricesEdit() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toUpperCase() : 'SP';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [liveState, setLiveState] = useState({
        modo_festa: false,
        party_banners: [],
        valor_atual: 0,
        valor_futuro: null,
        texto_futuro: null,
        aviso_1: '', 
        aviso_2: '', 
        aviso_3: '', 
        aviso_4: ''
    });

    const [defaults, setDefaults] = useState([]);
    const [categoriesMedia, setCategoriesMedia] = useState([]); 
    const [manualFuture, setManualFuture] = useState('');

    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

    const [isIdentidadeOpen, setIsIdentidadeOpen] = useState(false);
    const [isAvisosOpen, setIsAvisosOpen] = useState(false);

    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [newHolidayName, setNewHolidayName] = useState('');
    const [newHolidayDate, setNewHolidayDate] = useState('');

    const [showPromoModal, setShowPromoModal] = useState(false);
    const [promotions, setPromotions] = useState([]);

    const [activeTab, setActiveTab] = useState('semana');

    useEffect(() => {
        loadAllData();
    }, [currentUnit]);

    const loadAllData = async () => {
        setLoading(true);

        try {
            const [stateRes, defaultsRes, mediaRes, holidaysRes, promosRes] = await Promise.all([
                axios.get(`${API_URL}/api/prices/state/${currentUnit}`),
                axios.get(`${API_URL}/api/prices/defaults`),
                axios.get(`${API_URL}/api/prices/media/${currentUnit}`),
                axios.get(`${API_URL}/api/prices/holidays/${currentUnit}`).catch(() => ({ data: [] })),
                axios.get(`${API_URL}/api/prices/promotions/${currentUnit}`).catch(() => ({ data: [] }))
            ]);

            const stateData = stateRes.data;

            if (typeof stateData.party_banners === 'string') {
                try {
                    stateData.party_banners = JSON.parse(stateData.party_banners);
                } catch (e) {
                    stateData.party_banners = [];
                }
            }

            if (!Array.isArray(stateData.party_banners)) {
                stateData.party_banners = [];
            }

            setLiveState(stateData);
            setDefaults(defaultsRes.data);
            setCategoriesMedia(mediaRes.data);
            setHolidays(holidaysRes.data);
            
            const formattedPromos = promosRes.data.map(p => ({
                ...p,
                dias_ativos: Array.isArray(p.dias_ativos) ? p.dias_ativos : JSON.parse(p.dias_ativos || '[]')
            }));
            setPromotions(formattedPromos);

            const valorInicial = stateRes.data.valor_futuro 
                ? stateRes.data.valor_futuro 
                : (stateRes.data.valor_padrao_futuro || '');
            setManualFuture(valorInicial);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const toggleModoFesta = () => {
        setLiveState(prev => ({ ...prev, modo_festa: !prev.modo_festa }));
    };

    const handleSaveState = async () => {
        setSaving(true);
        try {
            await axios.put(`${API_URL}/api/prices/state/${currentUnit}`, {
                modo_festa: liveState.modo_festa,
                party_banners: liveState.party_banners,
                valor_futuro: manualFuture === '' ? null : manualFuture,
                texto_futuro: manualFuture === '' ? '???' : null,
                aviso_1: liveState.aviso_1,
                aviso_2: liveState.aviso_2,
                aviso_3: liveState.aviso_3,
                aviso_4: liveState.aviso_4
            });
            toast.success("Estado atualizado e enviado para TV!");
            loadAllData();
        } catch (error) {
            toast.error("Erro ao salvar estado.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddBanner = async (file) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('priceMedia', file);
        
        const toastId = toast.loading("Enviando banner...");

        try {
            const res = await axios.post(`${API_URL}/api/prices/upload`, formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            
            setLiveState(prev => {
                const newBanners = [...prev.party_banners, res.data.url];
                setCurrentBannerIndex(newBanners.length - 1);
                return { ...prev, party_banners: newBanners };
            });

            toast.update(toastId, { 
                render: "Banner adicionado!", 
                type: "success", 
                isLoading: false, 
                autoClose: 2000 
            });
        } catch (error) {
            toast.update(toastId, { 
                render: "Erro no upload.", 
                type: "error", 
                isLoading: false, 
                autoClose: 3000 
            });
        }
    };

    const handleRemoveCurrentBanner = () => {
        setLiveState(prev => {
            const newBanners = prev.party_banners.filter((_, idx) => idx !== currentBannerIndex);
            
            if (currentBannerIndex >= newBanners.length) {
                setCurrentBannerIndex(Math.max(0, newBanners.length - 1));
            }
            return { ...prev, party_banners: newBanners };
        });
    };

    const prevBanner = () => {
        setCurrentBannerIndex(prev => (prev === 0 ? liveState.party_banners.length - 1 : prev - 1));
    };

    const nextBanner = () => {
        setCurrentBannerIndex(prev => (prev + 1) % liveState.party_banners.length);
    };

    const handleDefaultChange = async (id, novoValor) => {
        setDefaults(prev => prev.map(d => d.id === id ? { ...d, valor: novoValor } : d));
        try {
            await axios.put(`${API_URL}/api/prices/defaults`, { id, valor: novoValor });
        } catch (error) {
            toast.error("Erro ao salvar alteração na tabela.");
        }
    };

    const handleCategoryMediaUpload = async (id, file) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('priceMedia', file);

        const toastId = toast.loading("Enviando mídia...");

        try {
            const res = await axios.post(`${API_URL}/api/prices/upload`, formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });

            setCategoriesMedia(prev => prev.map(c => c.id === id ? { ...c, media_url: res.data.url } : c));
            await axios.put(`${API_URL}/api/prices/media`, { id, media_url: res.data.url });

            toast.update(toastId, { 
                render: "Mídia atualizada!", 
                type: "success", 
                isLoading: false, 
                autoClose: 2000 
            });
        } catch (error) { 
            toast.update(toastId, { 
                render: "Erro no upload.", 
                type: "error", 
                isLoading: false, 
                autoClose: 3000 
            }); 
        }
    };

    const handleCategoryTitleChange = async (id, newTitle) => {
        setCategoriesMedia(prev => prev.map(c => c.id === id ? { ...c, titulo: newTitle } : c));
        try { 
            await axios.put(`${API_URL}/api/prices/media`, { id, titulo: newTitle }); 
        } catch (error) {}
    };

    const handleCategoryAvisoChange = async (id, novoAviso) => {
        setCategoriesMedia(prev => prev.map(c => c.id === id ? { ...c, aviso_categoria: novoAviso } : c));
        try { 
            await axios.put(`${API_URL}/api/prices/media`, { id, aviso_categoria: novoAviso }); 
        } catch (error) {}
    };

    const handleSaveHoliday = async () => {
        if (!newHolidayName || !newHolidayDate) {
            return toast.warning("Preencha nome e data.");
        }

        try {
            await axios.post(`${API_URL}/api/prices/holidays`, {
                unidade: currentUnit,
                nome: newHolidayName,
                data_feriado: newHolidayDate
            });

            toast.success("Feriado adicionado!");
            setNewHolidayName('');
            setNewHolidayDate('');

            const res = await axios.get(`${API_URL}/api/prices/holidays/${currentUnit}`);
            setHolidays(res.data);
        } catch (error) { 
            toast.error("Erro ao adicionar feriado."); 
        }
    };

    const handleDeleteHoliday = async (id) => {
        try {
            await axios.delete(`${API_URL}/api/prices/holidays/${id}`);
            setHolidays(prev => prev.filter(h => h.id !== id));
            toast.success("Feriado removido.");
        } catch (e) { 
            toast.error("Erro ao remover."); 
        }
    };

    const handlePromoUpload = async (file) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('priceMedia', file);

        const toastId = toast.loading("Enviando flyer...");

        try {
            const res = await axios.post(`${API_URL}/api/prices/upload`, formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            setPromotions(prev => [...prev, { image_url: res.data.url, dias_ativos: [] }]);
            toast.update(toastId, { 
                render: "Flyer adicionado!", 
                type: "success", 
                isLoading: false, 
                autoClose: 2000 
            });
        } catch (error) { 
            toast.update(toastId, { 
                render: "Erro no upload.", 
                type: "error", 
                isLoading: false, 
                autoClose: 3000 
            }); 
        }
    };

    const handleSavePromotions = async () => {
        try {
            await axios.post(`${API_URL}/api/prices/promotions`, {
                unidade: currentUnit,
                promotions: promotions
            });
            toast.success("Promoções salvas!");
            setShowPromoModal(false);
        } catch (e) { 
            toast.error("Erro ao salvar promoções."); 
        }
    };

    const togglePromoDay = (index, dayCode) => {
        setPromotions(prev => {
            const newPromos = [...prev];
            const promo = { ...newPromos[index] };
            const days = (promo.dias_ativos || []).map(String);
            const target = String(dayCode);

            promo.dias_ativos = days.includes(target) 
                ? days.filter(d => d !== target) 
                : [...days, target];

            newPromos[index] = promo;
            return newPromos;
        });
    };

    const removePromo = (index) => {
        setPromotions(prev => prev.filter((_, i) => i !== index));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-warm flex">
            <Sidebar 
                activePage="prices-maintenance" 
                headerTitle="Tabela de Preços" 
                headerIcon="price_change" 
                group="maintenance" 
                unit={currentUnit} 
            />

            <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col relative">
                <div className="flex justify-between items-start mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-1">Controle de Preços</h1>
                        <p className="text-white/50 text-sm">Sistema Híbrido: API Legada + Regras Locais</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={toggleModoFesta}
                            className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all border ${
                                liveState?.modo_festa 
                                    ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.5)]' 
                                    : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <PartyPopper size={18} />
                            {liveState?.modo_festa ? 'MODO FESTA: ON' : 'MODO FESTA: OFF'}
                        </button>

                        <div className="w-px bg-white/10 mx-2 h-10"></div>

                        <button 
                            onClick={() => setShowPromoModal(true)} 
                            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/50 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                        >
                            <span className="material-symbols-outlined">campaign</span> GERENCIAR PROMOÇÕES
                        </button>
                        <button 
                            onClick={() => setShowHolidayModal(true)} 
                            className="bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 border border-yellow-600/50 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                        >
                            <span className="material-symbols-outlined">event</span> GERENCIAR FERIADOS
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-32 pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="liquid-glass p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div>
                                    <h2 className="text-gray-400 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${liveState?.valor_atual > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div> 
                                        Preço Atual
                                    </h2>
                                </div>
                                {liveState?.is_padrao ? (
                                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                                        <CheckCircle size={12}/> Padrão
                                    </span>
                                ) : (
                                    <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                                        <AlertTriangle size={12}/> Exceção
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-1 relative z-10">
                                <span className="text-2xl text-gray-500 font-light">R$</span>
                                <span className="text-5xl text-white font-bold tracking-tighter">{liveState?.valor_atual || '0.00'}</span>
                            </div>
                            <p className="text-white/30 text-xs mt-2 relative z-10">
                                Detectado: {liveState?.tipo_dia === 'semana' ? 'Segunda a Sexta' : 'Fim de Semana/Feriado'} • {liveState?.periodo_atual?.toUpperCase()}
                            </p>
                            <History className="absolute right-[-10px] bottom-[-10px] text-white/5 w-32 h-32" />
                        </div>

                        <div className="liquid-glass p-6 rounded-2xl border border-orange-500/20 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <h2 className="text-orange-400 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
                                    <Settings size={14} /> Próximo Valor (Editável)
                                </h2>
                            </div>
                            <div className="flex items-center gap-3 relative z-10 mt-1">
                                <span className="text-2xl text-orange-500/50 font-light">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={manualFuture} 
                                    onChange={(e) => setManualFuture(e.target.value)} 
                                    placeholder={liveState?.valor_padrao_futuro || "???"} 
                                    className="bg-transparent text-5xl text-white font-bold tracking-tighter w-48 border-b-2 border-orange-500/30 focus:border-orange-500 outline-none placeholder-white/10" 
                                />
                            </div>
                            <p className="text-white/30 text-xs mt-2 relative z-10">
                                {liveState?.valor_padrao_futuro ? `Sugestão automática: R$ ${liveState.valor_padrao_futuro}` : "Sem sugestão. Defina manualmente."}
                            </p>
                            <Clock className="absolute right-[-10px] bottom-[-10px] text-orange-500/10 w-32 h-32" />
                        </div>
                    </div>

                    {liveState?.modo_festa ? (
                        <div className="animate-fade-in liquid-glass p-6 rounded-2xl border border-purple-500/30 shadow-[0_0_50px_rgba(147,51,234,0.1)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-purple-600 rounded-lg shadow-lg">
                                    <PartyPopper className="text-white" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-xl">Configuração Modo Festa</h2>
                                    <p className="text-white/50 text-sm">Adicione flyers e avisos para o evento.</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-purple-400 font-bold flex items-center gap-2">
                                            <Upload size={18} /> Flyers da Festa (3:4)
                                        </h3>
                                        <span className="text-xs text-white/40">{liveState.party_banners?.length || 0} imagens</span>
                                    </div>
                                    
                                    <div className="flex gap-4 items-start">
                                        <div className="flex-1">
                                            <label className="bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border-2 border-dashed border-purple-500/30 w-full h-[400px] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.01] group">
                                                <div className="bg-purple-600/20 p-4 rounded-full mb-3 group-hover:bg-purple-600 text-white transition-colors">
                                                    <Upload size={32} />
                                                </div>
                                                <span className="text-lg font-bold">Adicionar Imagem</span>
                                                <span className="text-xs text-white/40 mt-1">Formato 3:4</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAddBanner(e.target.files[0])} />
                                            </label>
                                        </div>

                                        <div className="w-[300px] h-[400px] bg-black rounded-xl border border-white/10 overflow-hidden relative shadow-2xl shrink-0 group">
                                            {liveState.party_banners && liveState.party_banners.length > 0 ? (
                                                <>
                                                    <img src={`${API_URL}${liveState.party_banners[currentBannerIndex]}`} className="w-full h-full object-cover" alt="Banner" />
                                                    
                                                    {liveState.party_banners.length > 1 && (
                                                        <>
                                                            <button onClick={prevBanner} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-purple-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
                                                                <ChevronLeft size={20}/>
                                                            </button>
                                                            <button onClick={nextBanner} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-purple-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
                                                                <ChevronRight size={20}/>
                                                            </button>
                                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                                                                {liveState.party_banners.map((_, idx) => (
                                                                    <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentBannerIndex ? 'bg-purple-500' : 'bg-white/30'}`}></div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}

                                                    <button onClick={handleRemoveCurrentBanner} className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full shadow-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 p-4 text-center">
                                                    <PartyPopper size={32} className="mb-2 opacity-50" />
                                                    <span className="text-[10px] font-bold uppercase">Nenhum flyer</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-yellow-400 font-bold mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined">warning</span> Avisos Importantes da Festa
                                    </h3>
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4].map(num => (
                                            <div key={num}>
                                                <label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Aviso #{num}</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none" 
                                                    value={liveState?.[`aviso_${num}`] || ''} 
                                                    onChange={(e) => setLiveState(prev => ({...prev, [`aviso_${num}`]: e.target.value}))} 
                                                    placeholder={num <= 2 ? "Ex: * Proibido entrada de menores." : "Ex: ** Valores sujeitos a alteração."}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in space-y-6">
                            <div className="liquid-glass p-6 rounded-2xl border border-white/5 transition-all">
                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsIdentidadeOpen(!isIdentidadeOpen)}>
                                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                        <Film size={20} className="text-pink-400" /> Identidade Visual
                                    </h2>
                                    {isIdentidadeOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                                </div>

                                {isIdentidadeOpen && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 animate-fade-in">
                                        {categoriesMedia.map((cat) => (
                                            <div key={cat.id} className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col gap-3 group">
                                                <div className="flex justify-between items-center">
                                                    <input 
                                                        type="text" 
                                                        className="bg-transparent text-white font-bold text-sm border-b border-transparent focus:border-pink-500 outline-none w-full" 
                                                        value={cat.titulo || ''} 
                                                        onChange={(e) => handleCategoryTitleChange(cat.id, e.target.value)} 
                                                        placeholder="Nome" 
                                                    />
                                                    <Edit3 size={14} className="text-white/20" />
                                                </div>

                                                <div className="aspect-video w-full max-w-[240px] mx-auto bg-black rounded-lg relative overflow-hidden border border-white/10">
                                                    {cat.media_url ? (
                                                        cat.media_url.endsWith('.mp4') || cat.media_url.endsWith('.webm') ? (
                                                            <video src={`${API_URL}${cat.media_url}`} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" autoPlay muted loop />
                                                        ) : (
                                                            <img src={`${API_URL}${cat.media_url}`} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                                        )
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">Sem Mídia</div>
                                                    )}
                                                    
                                                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                        <div className="text-white text-xs font-bold flex flex-col items-center gap-1">
                                                            <Upload size={20} /> TROCAR
                                                        </div>
                                                        <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleCategoryMediaUpload(cat.id, e.target.files[0])} />
                                                    </label>
                                                </div>

                                                <div>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-pink-500 outline-none" 
                                                        value={cat.aviso_categoria || ''} 
                                                        onChange={(e) => handleCategoryAvisoChange(cat.id, e.target.value)} 
                                                        placeholder="Aviso específico" 
                                                    />
                                                </div>
                                                <p className="text-[10px] text-white/30 text-center uppercase tracking-wider mt-1">
                                                    {cat.qtd_pessoas} {cat.qtd_pessoas === 1 ? 'Pessoa' : 'Pessoas'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="liquid-glass p-6 rounded-2xl border border-white/5 transition-all">
                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsAvisosOpen(!isAvisosOpen)}>
                                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-yellow-400">warning</span> Avisos Importantes
                                    </h2>
                                    {isAvisosOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                                </div>

                                {isAvisosOpen && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 animate-fade-in">
                                        {[1, 2, 3, 4].map(num => (
                                            <div key={num}>
                                                <label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Aviso #{num}</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none" 
                                                    value={liveState?.[`aviso_${num}`] || ''} 
                                                    onChange={(e) => setLiveState(prev => ({...prev, [`aviso_${num}`]: e.target.value}))} 
                                                    placeholder={num <= 2 ? "Ex: * Proibido entrada de menores." : "Ex: ** Valores sujeitos a alteração."} 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="liquid-glass p-6 rounded-2xl border border-white/5">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                        <Settings size={20} className="text-blue-400" /> Preços Padrão
                                    </h2>
                                    <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
                                        <button 
                                            onClick={() => setActiveTab('semana')} 
                                            className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'semana' ? 'bg-blue-600 text-white shadow' : 'text-white/40 hover:text-white'}`}
                                        >
                                            SEGUNDA A SEXTA
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('fim_de_semana')} 
                                            className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'fim_de_semana' ? 'bg-green-600 text-white shadow' : 'text-white/40 hover:text-white'}`}
                                        >
                                            SÁB., DOM. E FERIADOS
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {['manha', 'tarde', 'noite'].map(periodo => (
                                        <div key={periodo} className="bg-black/20 p-4 rounded-xl border border-white/5">
                                            <h3 className="text-sm font-bold text-white/60 uppercase mb-4 flex items-center gap-2">
                                                <Clock size={14} /> {periodo}
                                            </h3>
                                            <div className="space-y-3">
                                                {[1, 2, 3].map(qtd => {
                                                    const regra = defaults.find(d => d.tipo_dia === activeTab && d.periodo === periodo && d.qtd_pessoas === qtd);
                                                    if (!regra) return null;
                                                    return (
                                                        <div key={regra.id} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 hover:border-white/20 transition-colors">
                                                            <span className="text-xs font-bold text-white/50 w-8">{qtd} P</span>
                                                            <div className="flex items-center">
                                                                <span className="text-xs text-white/30 mr-1">R$</span>
                                                                <input 
                                                                    type="number" 
                                                                    step="0.01" 
                                                                    className="bg-transparent text-right text-white font-mono w-20 outline-none focus:text-blue-400 font-bold" 
                                                                    value={regra.valor} 
                                                                    onChange={(e) => handleDefaultChange(regra.id, e.target.value)} 
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 w-full bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/10 p-4 px-8 flex justify-end items-center z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                    <button 
                        onClick={handleSaveState} 
                        disabled={saving} 
                        className="bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-green-900/30 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                        ) : (
                            <>
                                <Save size={20} /> SALVAR E ATUALIZAR TV
                            </>
                        )}
                    </button>
                </div>
            </main>

            {showHolidayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-4xl p-6 relative">
                        <button onClick={() => setShowHolidayModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-400">event</span> Feriados
                        </h2>
                        <div className="flex gap-4 mb-6">
                            <input type="text" placeholder="Nome" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-yellow-500" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} />
                            <input type="date" className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-yellow-500" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
                            <button onClick={handleSaveHoliday} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold">ADICIONAR</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto">
                            {holidays.map(h => (
                                <div key={h.id} className="bg-white/5 p-4 rounded-lg flex justify-between items-center group">
                                    <div>
                                        <p className="text-white font-bold">{h.nome}</p>
                                        <p className="text-white/40 text-xs">{new Date(h.data_feriado).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showPromoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-6xl h-[85vh] flex flex-col relative overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="material-symbols-outlined text-blue-400">campaign</span> Promoções (Flyers)
                            </h2>
                            <button onClick={() => setShowPromoModal(false)} className="text-white/50 hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <label className="bg-blue-600/20 border border-blue-500/50 p-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-blue-400 hover:bg-blue-600/30 transition-colors mb-6">
                                <Upload size={20} /> ADICIONAR FLYER
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePromoUpload(e.target.files[0])} />
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {promotions.map((promo, idx) => (
                                    <div key={idx} className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/10 group">
                                        <div className="aspect-video relative">
                                            <img src={`${API_URL}${promo.image_url}`} className="w-full h-full object-cover" alt="Promo" />
                                            <button onClick={() => removePromo(idx)} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                        <div className="p-2 flex justify-between gap-1">
                                            {['1','2','3','4','5','6','0'].map(d => (
                                                <button 
                                                    key={d} 
                                                    onClick={() => togglePromoDay(idx, d)} 
                                                    className={`w-6 h-6 rounded-full text-[10px] font-bold ${promo.dias_ativos.includes(d) ? 'bg-green-500 text-black' : 'bg-white/10 text-white/30'}`}
                                                >
                                                    {{'1':'S','2':'T','3':'Q','4':'Q','5':'S','6':'S','0':'D'}[d]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/10 bg-[#1a1a1a] flex justify-end">
                            <button onClick={handleSavePromotions} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">
                                SALVAR PROMOÇÕES
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}