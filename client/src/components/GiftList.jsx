import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import LogoDedalos from '../assets/SVG/logoDedalos';

const API_CONFIG = {
    sp: {
        baseUrl: import.meta.env.VITE_API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/",
        couponsUrl: (import.meta.env.VITE_API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/") + "api/cupons/",
        token: import.meta.env.VITE_API_TOKEN_SP || "7a9e64071564f6fee8d96cd209ed3a4e86801552",
        local: "SP"
    },
    bh: {
        baseUrl: import.meta.env.VITE_API_URL_BH || "https://dedalosadm2bh-09d55dca461e.herokuapp.com/",
        couponsUrl: (import.meta.env.VITE_API_URL_BH || "https://dedalosadm2bh-09d55dca461e.herokuapp.com/") + "api/cupons/",
        token: import.meta.env.VITE_API_TOKEN_BH || "919d97d7df39ecbd0036631caba657221acab99d",
        local: "BH"
    }
};

// [EXPORTADO] Para ser usado na tela de configuração
export const PRIZE_CATEGORIES = [
    { id: 'rodada_dupla', label: 'Rodada Dupla', icon: 'local_bar' },
    { id: 'uma_vida', label: 'Uma Vida (VIP)', icon: 'confirmation_number' },
    { id: 'drink_especial', label: 'Drink Especial', icon: 'wine_bar' },
    { id: 'premio_surpresa', label: 'Prêmio Surpresa', icon: 'redeem' },
    { id: 'consumo', label: 'R$ Consumo', icon: 'attach_money' },
    { id: 'sem_premio', label: 'Sem Prêmio', icon: 'block' }
];

const SURPRISE_OPTIONS = ['Halls', 'RedBull', 'Salgadinho', 'Caipinossa', 'Double Tequila'];
const SORTEADOR_QUINTA_PREMIADA = 11;

export default function GiftList({ lockerNumber, lockerData, onCancel, onConfirm, unit = 'sp' }) {
    // Dados vindos do sorteio/monitoramento
    const preDefinedCategory = lockerData?.prizeCategory || null; // Categoria do cartão (id)
    const detectedWristband = lockerData?.currentWristband || ''; 
    const detectedName = lockerData?.currentClientName || ''; // Nome já buscado no pai

    // Se tiver categoria pré-definida, inicia com ela selecionada
    const [selectedCategory, setSelectedCategory] = useState(preDefinedCategory);
    
    const [umaVidaTab, setUmaVidaTab] = useState('sem_cadastro');
    const [loadingName, setLoadingName] = useState(false);
    const [generatingCoupon, setGeneratingCoupon] = useState(false);
    const [generatedCouponData, setGeneratedCouponData] = useState(null);

    const [formData, setFormData] = useState({
        pulseira: detectedWristband,
        nomeCliente: detectedName,
        bebida: '',
        recusado: false,
        diaPreferencia: '',
        email: '',
        surpresaEscolhida: '',
        cupomGeradoLink: ''
    });

    const currentConfig = API_CONFIG[unit.toLowerCase()] || API_CONFIG.sp;

    // Se o nome não veio do pai mas tem pulseira, busca aqui
    useEffect(() => {
        if (detectedWristband && !detectedName) {
            fetchNomeCliente(detectedWristband);
        } else if (detectedName) {
            setFormData(prev => ({ ...prev, nomeCliente: detectedName, pulseira: detectedWristband }));
        }
    }, [detectedWristband, detectedName]);

    // Se for VIP, força a aba "gerar cupom" pois "sem cadastro" foi removido conforme solicitação
    useEffect(() => {
        if (selectedCategory === 'uma_vida') {
            setUmaVidaTab('com_cadastro');
        }
    }, [selectedCategory]);

    const fetchNomeCliente = async (pulseira) => {
        if (!pulseira) return;
        setLoadingName(true);
        setFormData(prev => ({ ...prev, nomeCliente: "Buscando..." }));

        try {
            const baseUrl = currentConfig.baseUrl.endsWith('/') ? currentConfig.baseUrl : `${currentConfig.baseUrl}/`;
            const endpoint = `${baseUrl}api/entradasOne/${pulseira}/`;

            const response = await axios.get(endpoint, {
                headers: { "Authorization": `Token ${currentConfig.token}`, "Content-Type": "application/json" }
            });

            const data = response.data;
            const nomeEncontrado = data.nome || data.name || data.nome_cliente || data.cliente || "Nome não identificado";
            setFormData(prev => ({ ...prev, nomeCliente: nomeEncontrado }));
        } catch (error) {
            console.error("Erro busca cliente:", error);
            setFormData(prev => ({ ...prev, nomeCliente: "Não encontrado" }));
        } finally {
            setLoadingName(false);
        }
    };

    const handleGerarCupom = async () => {
        if (!formData.diaPreferencia) return toast.warning("Selecione a Data de Preferência.");
        if (!formData.nomeCliente || formData.nomeCliente === "Buscando..." || formData.nomeCliente === "Não encontrado") {
            return toast.warning("Cliente não identificado corretamente.");
        }

        setGeneratingCoupon(true);
        const dataFormatada = `${formData.diaPreferencia}T00:00:00`;

        const payload = {
            "tipoCupom": SORTEADOR_QUINTA_PREMIADA,
            "nome": formData.nomeCliente,
            "idUser": 1,
            "local": currentConfig.local,
            "tipo": "Quinta Premiada",
            "descontos": "Cupom Premiado - 1 Vida",
            "regra1": "Uso único", "desconto1": "0.00",
            "regra2": "das 00:00 às 23:59", "desconto2": "",
            "regra3": "Intransferível", "desconto3": "",
            "regra4": "", "desconto4": "",
            "regra5": "", "desconto5": "",
            "regra6": null, "desconto6": null,
            "agendado": dataFormatada,
            "dia": [1, 2, 3, 4, 5, 6, 7],
            "ativo": true, "novo": true,
            "codigo": "", "nome_amigo": "", "nome_amigo2": "",
            "valor": 0, "homenageado": false, "quarta_top": false,
            "mao_amiga": false, "signo": false
        };

        try {
            const response = await axios.post(currentConfig.couponsUrl, payload, {
                headers: { "Authorization": `Token ${currentConfig.token}`, "Content-Type": "application/json" }
            });

            if (response.status === 201 || response.status === 200) {
                const link = `https://dedalosbar.com.br/vips/${response.data.id}`;
                setFormData(prev => ({ ...prev, cupomGeradoLink: link }));
                setGeneratedCouponData({
                    id: response.data.id,
                    nome: formData.nomeCliente,
                    data: formData.diaPreferencia,
                    link: link
                });
                toast.success("Cupom gerado com sucesso!");
            }
        } catch (error) {
            console.error("Erro cupom:", error);
            toast.error("Falha ao gerar cupom.");
        } finally {
            setGeneratingCoupon(false);
        }
    };

    const handleSave = () => {
        if (!selectedCategory) return;
        
        // Se for "Sem Prêmio", salva direto
        if (selectedCategory === 'sem_premio') {
            onConfirm("Sem Prêmio", `Cartão sorteado não continha prêmio. Cliente: ${formData.nomeCliente} (${formData.pulseira})`);
            return;
        }

        let categoryLabel = PRIZE_CATEGORIES.find(c => c.id === selectedCategory)?.label || selectedCategory;
        let detailsString = '';

        switch (selectedCategory) {
            case 'rodada_dupla':
                if (formData.recusado) {
                    detailsString = `Recusado pelo cliente ${formData.nomeCliente} (Pulseira: ${formData.pulseira})`;
                } else {
                    if (!formData.bebida) return toast.warning("Informe a bebida.");
                    detailsString = `Dupla: ${formData.bebida} | Cliente: ${formData.nomeCliente} (${formData.pulseira})`;
                }
                break;
            case 'uma_vida':
                if (!generatedCouponData) {
                    if (!window.confirm("O cupom VIP ainda não foi gerado. Salvar sem gerar?")) return;
                    detailsString = `VIP (Pendente) | Cliente: ${formData.nomeCliente} | Data Pref: ${formData.diaPreferencia}`;
                } else {
                    detailsString = `VIP Gerado | Link: ${generatedCouponData.link} | Cliente: ${formData.nomeCliente} | Data: ${formData.diaPreferencia}`;
                }
                break;
            case 'drink_especial':
                if (!formData.bebida) return toast.warning("Informe o drink.");
                detailsString = `Drink: ${formData.bebida} | Cliente: ${formData.nomeCliente} (${formData.pulseira})`;
                break;
            case 'premio_surpresa':
                if (!formData.surpresaEscolhida) return toast.warning("Selecione o prêmio escolhido.");
                categoryLabel = `Surpresa: ${formData.surpresaEscolhida}`;
                detailsString = `Ganhou: ${formData.surpresaEscolhida} | Cliente: ${formData.nomeCliente} (${formData.pulseira})`;
                break;
            case 'consumo':
                detailsString = `R$ Consumo | Cliente: ${formData.nomeCliente} (${formData.pulseira})`;
                break;
            default: return;
        }

        onConfirm(categoryLabel, detailsString);
    };

    return (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-yellow-500">redeem</span>
                        Resgate de Prêmio
                    </h2>
                    <p className="text-text-muted text-sm mt-1">
                        Armário <span className="text-white font-bold">{lockerNumber}</span> 
                        {lockerData?.cardNumber && <span className="ml-2 bg-white/10 px-2 py-0.5 rounded text-xs">Cartão {lockerData.cardNumber}</span>}
                    </p>
                </div>
            </div>

            {/* SELEÇÃO DE CATEGORIA (Só aparece se NÃO tiver prêmio pré-definido) */}
            {!preDefinedCategory && !selectedCategory ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {PRIZE_CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="bg-white/5 hover:bg-blue-600 hover:scale-105 transition-all p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-3 group">
                            <span className="material-symbols-outlined text-4xl text-white/70 group-hover:text-white">{cat.icon}</span>
                            <span className="text-white font-bold uppercase tracking-wide text-xs text-center">{cat.label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* CABEÇALHO DO PRÊMIO FIXO */}
                    <div className="mb-6 bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl text-center">
                        <p className="text-blue-300 text-xs uppercase font-bold mb-1">Prêmio do Cartão</p>
                        <h3 className="text-2xl font-bold text-white">
                            {PRIZE_CATEGORIES.find(c => c.id === selectedCategory)?.label || "Prêmio Desconhecido"}
                        </h3>
                    </div>

                    {/* DADOS DO CLIENTE (Auto-preenchidos e Imutáveis) */}
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1">
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Pulseira</label>
                            <input 
                                type="text" 
                                className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/70 font-mono text-center cursor-not-allowed" 
                                value={formData.pulseira || "-"} 
                                readOnly 
                            />
                        </div>
                        <div className="flex-[2]">
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Cliente</label>
                            <input 
                                type="text" 
                                className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/70 font-bold cursor-not-allowed" 
                                value={loadingName ? "Buscando..." : (formData.nomeCliente || "Não identificado")} 
                                readOnly 
                            />
                        </div>
                    </div>

                    {/* FORMULÁRIOS ESPECÍFICOS */}
                    
                    {selectedCategory === 'rodada_dupla' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 py-2 bg-red-900/10 p-3 rounded-lg border border-red-500/20">
                                <input type="checkbox" id="recusado" className="w-5 h-5 rounded bg-black/30 text-red-600 focus:ring-0" checked={formData.recusado} onChange={(e) => setFormData({ ...formData, recusado: e.target.checked })} />
                                <label htmlFor="recusado" className="text-red-300 font-bold cursor-pointer select-none text-sm">CLIENTE RECUSOU O PRÊMIO</label>
                            </div>
                            {!formData.recusado && (
                                <div>
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Bebida Escolhida</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" placeholder="Ex: Gin Tônica" value={formData.bebida} onChange={(e) => setFormData({ ...formData, bebida: e.target.value })} />
                                </div>
                            )}
                        </div>
                    )}

                    {selectedCategory === 'uma_vida' && (
                        <div className="space-y-4">
                            <p className="text-sm text-text-muted">Selecione a data para gerar o VIP do cliente.</p>
                            
                            <div>
                                <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Data de Preferência</label>
                                <input type="date" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.diaPreferencia} onChange={(e) => setFormData({ ...formData, diaPreferencia: e.target.value })} />
                            </div>

                            {!generatedCouponData ? (
                                <button
                                    onClick={handleGerarCupom}
                                    disabled={generatingCoupon || !formData.diaPreferencia}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                                >
                                    {generatingCoupon ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">confirmation_number</span>}
                                    GERAR CUPOM VIP
                                </button>
                            ) : (
                                <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl text-center">
                                    <span className="material-symbols-outlined text-green-400 text-3xl mb-2">check_circle</span>
                                    <h3 className="text-white font-bold">Cupom Gerado!</h3>
                                    <p className="text-green-300 text-sm mb-3">#{generatedCouponData.id}</p>
                                    <a href={generatedCouponData.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">Abrir Cupom</a>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedCategory === 'drink_especial' && (
                        <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Drink Escolhido</label>
                            <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.bebida} onChange={(e) => setFormData({ ...formData, bebida: e.target.value })} placeholder="Nome do Drink" />
                        </div>
                    )}

                    {selectedCategory === 'premio_surpresa' && (
                        <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Prêmio Escolhido pelo Cliente</label>
                            <select className="w-full bg-black border border-white/30 rounded-xl p-3 text-white focus:border-blue-500 outline-none cursor-pointer" value={formData.surpresaEscolhida} onChange={(e) => setFormData({ ...formData, surpresaEscolhida: e.target.value })}>
                                <option value="" className="bg-black text-gray-400">Selecione uma opção...</option>
                                {SURPRISE_OPTIONS.map(opt => (
                                    <option key={opt} value={opt} className="bg-black text-white">{opt}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedCategory === 'consumo' && (
                        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-6 text-center">
                            <h3 className="text-2xl font-bold text-green-400">R$ 50,00</h3>
                            <p className="text-white text-sm mt-1">Crédito em consumo liberado</p>
                        </div>
                    )}
                    
                    {selectedCategory === 'sem_premio' && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
                            <h3 className="text-xl font-bold text-red-400">Sem Prêmio</h3>
                            <p className="text-white text-sm mt-1">Este cartão não possui premiação.</p>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex gap-4">
                <button onClick={onCancel} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors">CANCELAR</button>
                {selectedCategory && (
                    <button onClick={handleSave} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/30">
                        CONFIRMAR RESGATE
                    </button>
                )}
            </div>
        </div>
    );
}