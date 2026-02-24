import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PricesDisplay() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toUpperCase() : 'SP';

    const [liveState, setLiveState] = useState(null);
    const [defaults, setDefaults] = useState([]);
    const [categoryMedia, setCategoryMedia] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Controle de Rotação
    const [activePeriod, setActivePeriod] = useState('manha');
    const [currentPromoIndex, setCurrentPromoIndex] = useState(0); // Slider Promoções (16:9)
    const [currentPartyBannerIndex, setCurrentPartyBannerIndex] = useState(0); // Slider Festa (3:4)

    useEffect(() => {
        fetchData();
        
        // Polling de segurança e atualização de turno
        const interval = setInterval(fetchData, 30000); 
        const periodInterval = setInterval(updateActivePeriod, 10000); 
        updateActivePeriod();

        // === SOCKET.IO (Tempo Real) ===
        const socket = io(API_URL);
        
        socket.on('connect', () => console.log("Socket conectado"));
        
        socket.on('prices:updated', (data) => {
            // Atualiza se for para esta unidade ou global
            if (!data.unidade || data.unidade === currentUnit) {
                fetchData();
            }
        });

        return () => {
            clearInterval(interval);
            clearInterval(periodInterval);
            socket.disconnect();
        };
    }, [currentUnit]);

    // Rotação Promoções (Padrão)
    useEffect(() => {
        if (promotions.length <= 1) return;
        const promoInterval = setInterval(() => {
            setCurrentPromoIndex(prev => (prev + 1) % promotions.length);
        }, 8000);
        return () => clearInterval(promoInterval);
    }, [promotions]);

    // Rotação Banners Festa (Festa)
    useEffect(() => {
        if (!liveState?.modo_festa || !liveState?.party_banners || liveState.party_banners.length <= 1) return;
        const bannerInterval = setInterval(() => {
            setCurrentPartyBannerIndex(prev => (prev + 1) % liveState.party_banners.length);
        }, 5000);
        return () => clearInterval(bannerInterval);
    }, [liveState?.modo_festa, liveState?.party_banners]);

    const fetchData = async () => {
        try {
            const [stateRes, defaultsRes, mediaRes, promoRes] = await Promise.all([
                axios.get(`${API_URL}/api/prices/state/${currentUnit}`),
                axios.get(`${API_URL}/api/prices/defaults`),
                axios.get(`${API_URL}/api/prices/media/${currentUnit}`),
                axios.get(`${API_URL}/api/prices/promotions/${currentUnit}`).catch(() => ({ data: [] }))
            ]);

            // Normaliza banners da festa
            const stateData = stateRes.data;
            if (typeof stateData.party_banners === 'string') {
                try { stateData.party_banners = JSON.parse(stateData.party_banners); } catch (e) { stateData.party_banners = []; }
            } else if (!Array.isArray(stateData.party_banners)) {
                stateData.party_banners = [];
            }

            setLiveState(stateData);
            setDefaults(defaultsRes.data);
            
            // Garante objeto de mídia
            const media = mediaRes.data;
            const fullMedia = [1, 2, 3].map(qtd => 
                media.find(m => m.qtd_pessoas === qtd) || { qtd_pessoas: qtd, titulo: 'Categoria', media_url: null, aviso_categoria: '' }
            );
            setCategoryMedia(fullMedia);

            // Filtra promoções do dia
            const today = new Date();
            const dayOfWeek = today.getDay();
            const activePromos = promoRes.data.filter(p => {
                if (!p.dias_ativos || p.dias_ativos.length === 0) return true;
                let dias = p.dias_ativos;
                if (typeof dias === 'string') dias = JSON.parse(dias);
                return dias.some(d => String(d) === String(dayOfWeek));
            });
            setPromotions(activePromos);

            setLoading(false);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        }
    };

    const updateActivePeriod = () => {
        const h = new Date().getHours();
        if (h >= 6 && h < 14) setActivePeriod('manha');
        else if (h >= 14 && h < 20) setActivePeriod('tarde');
        else setActivePeriod('noite');
    };

    const getOrderedPeriods = () => {
        const periodsData = {
            'manha': { key: 'manha', title: 'MANHÃ/TARDE', time: '06H ÀS 13H59' },
            'tarde': { key: 'tarde', title: 'TARDE/NOITE', time: '14H ÀS 19H59' },
            'noite': { key: 'noite', title: 'NOITE/MADRUGADA', time: '20H ÀS 05H59' }
        };

        if (activePeriod === 'manha') return [{ ...periodsData.noite, type: 'past' }, { ...periodsData.manha, type: 'current' }, { ...periodsData.tarde, type: 'future' }];
        if (activePeriod === 'tarde') return [{ ...periodsData.manha, type: 'past' }, { ...periodsData.tarde, type: 'current' }, { ...periodsData.noite, type: 'future' }];
        if (activePeriod === 'noite') return [{ ...periodsData.tarde, type: 'past' }, { ...periodsData.noite, type: 'current' }, { ...periodsData.manha, type: 'future' }];
        return [{ ...periodsData.manha, type: 'past' }, { ...periodsData.tarde, type: 'current' }, { ...periodsData.noite, type: 'future' }];
    };

    if (loading) return <div className="loading-screen">CARREGANDO...</div>;
    if (!liveState) return <div className="loading-screen">AGUARDANDO CONFIGURAÇÃO...</div>;

    const orderedColumns = getOrderedPeriods();
    const isTabletMode = false;

    // === MODO FESTA ===
    if (liveState.modo_festa) {
        return (
            <div className="pricing-page-wrapper" style={{ paddingTop: 0, paddingBottom: 0 }}>
                {/* Background Animado */}
                <div className="multi">
                    <div className="multichrome-background">
                        <div className="multichrome-light"></div>
                        <div className="multichrome-ambient-1 float-effect-1"></div>
                        <div className="multichrome-ambient-2 float-effect-2"></div>
                        <div className="multichrome-ambient-3 float-effect-3"></div>
                    </div>
                </div>

                <section className="pricing-section" style={{ 
                    paddingTop: '2vh', 
                    height: '100vh', 
                    justifyContent: 'flex-start', 
                    alignItems: 'center', 
                    flexDirection: 'column',
                    gap: '1rem' 
                }}>
                    {/* 1. TOPO: PREÇOS (APENAS SINGLE) */}
                    <div className="pricing-content" style={{ width: '100%', maxWidth: '1200px' }}>
                        <div className="pricing-columns-container">
                            {orderedColumns.map((colData, colIndex) => {
                                const isColumnActive = colIndex === 1; // Meio = Destaque
                                const positionClass = colIndex === 0 ? 'left-col' : colIndex === 1 ? 'active' : 'right-col';

                                return (
                                    <div key={colData.key} className={`price-column ${positionClass}`}>
                                        <h3 className="column-title" style={{ fontSize: '0.9rem' }}>{colData.title}</h3>
                                        <div className={`price-cards ${isColumnActive ? 'active-view' : 'inactive-view'}`}>
                                            {/* AQUI ESTÁ O TRUQUE: 
                                                Reutilizamos o 'categoryMedia' da categoria 1 (Individual) 
                                                para o card do meio no Modo Festa.
                                            */}
                                            <PriceCard
                                                index={0} // Força estilo Single
                                                qtdPessoas={1}
                                                colData={colData}
                                                liveState={liveState}
                                                defaults={defaults}
                                                mediaData={categoryMedia.find(m => m.qtd_pessoas === 1)} // Puxa mídia do Individual
                                                isActive={isColumnActive}
                                                isTablet={false}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 2. MEIO: AVISOS IMPORTANTES */}
                        <div className="price-notes" style={{ marginTop: '1rem', textAlign: 'center' }}>
                            {liveState.aviso_1 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>* {liveState.aviso_1}</p>}
                            {liveState.aviso_2 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>* {liveState.aviso_2}</p>}
                            {liveState.aviso_3 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>** {liveState.aviso_3}</p>}
                            {liveState.aviso_4 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>** {liveState.aviso_4}</p>}
                        </div>
                    </div>

                    {/* 3. BASE: SLIDER DE FLYERS DA FESTA (3:4) */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', paddingBottom: '20px', overflow: 'hidden' }}>
                        {liveState.party_banners && liveState.party_banners.length > 0 ? (
                            <div className="relative h-full aspect-[3/4] max-h-[55vh] rounded-xl overflow-hidden shadow-2xl bg-black/40 border border-white/10">
                                {liveState.party_banners.map((bannerUrl, idx) => (
                                    <img 
                                        key={idx}
                                        src={`${API_URL}${bannerUrl}`} 
                                        className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentPartyBannerIndex ? 'opacity-100' : 'opacity-0'}`} 
                                        alt="Festa" 
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-white/50 text-2xl font-bold uppercase tracking-widest animate-pulse">Sem Flyers Definidos</div>
                        )}
                    </div>
                </section>
            </div>
        );
    }

    // === MODO PADRÃO (TABELA COMPLETA) ===
    return (
        <div className="pricing-page-wrapper" style={{ paddingTop: 0, paddingBottom: 0 }}>
            {/* Background Animado */}
            <div className="multi">
                <div className="multichrome-background">
                    <div className="multichrome-light"></div>
                    <div className="multichrome-ambient-1 float-effect-1"></div>
                    <div className="multichrome-ambient-2 float-effect-2"></div>
                    <div className="multichrome-ambient-3 float-effect-3"></div>
                </div>
            </div>

            <section className="pricing-section" style={{ 
                paddingTop: '5vh', 
                paddingBottom: '5vh',
                gap: isTabletMode ? '0.2rem' : '1.5rem', 
                height: '100vh', 
                justifyContent: 'flex-start',
                alignItems: 'center',
                flexDirection: 'column' 
            }}>
                <div className="pricing-content" style={{ width: '100%', maxWidth: '1200px' }}>
                    <div className="pricing-columns-container">
                        {orderedColumns.map((colData, colIndex) => {
                            const isColumnActive = colIndex === 1;
                            const positionClass = colIndex === 0 ? 'left-col' : colIndex === 1 ? 'active' : 'right-col';

                            return (
                                <div key={colData.key} className={`price-column ${positionClass}`} style={{ gap: isTabletMode ? '0.5rem' : '1rem' }}>
                                    <h3 className="column-title" style={isTabletMode ? { padding: '0.5rem', fontSize: '0.9rem' } : {}}>
                                        {colData.title} <span className="column-time">{colData.time}</span>
                                    </h3>

                                    <div className={`price-cards ${isColumnActive ? 'active-view' : 'inactive-view'}`} style={{ gap: isTabletMode ? '0.5rem' : '1rem' }}>
                                        {[1, 2, 3].map((qtdPessoas, idx) => (
                                            <PriceCard
                                                key={qtdPessoas}
                                                index={idx}
                                                qtdPessoas={qtdPessoas}
                                                colData={colData}
                                                liveState={liveState}
                                                defaults={defaults}
                                                mediaData={categoryMedia.find(m => m.qtd_pessoas === qtdPessoas)}
                                                isActive={isColumnActive}
                                                isTablet={isTabletMode}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="price-notes" style={{ marginTop: isTabletMode ? '0.5rem' : '1rem', textAlign: 'center' }}>
                        {liveState.aviso_1 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>* {liveState.aviso_1}</p>}
                        {liveState.aviso_2 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>* {liveState.aviso_2}</p>}
                        {liveState.aviso_3 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>** {liveState.aviso_3}</p>}
                        {liveState.aviso_4 && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>** {liveState.aviso_4}</p>}
                        {liveState.texto_futuro && liveState.texto_futuro !== '???' && (
                            <p style={{ margin: '1rem 0 0 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#fbbf24', textTransform: 'uppercase' }}>
                                {liveState.texto_futuro}
                            </p>
                        )}
                    </div>
                </div>

                {!isTabletMode && promotions.length > 0 && (
                    <div className="slider-container" style={{ 
                        width: '90%', 
                        maxWidth: '800px', 
                        aspectRatio: '16/9', 
                        margin: 'auto 0 0 0',
                        borderRadius: '1rem', 
                        overflow: 'hidden', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        position: 'relative'
                    }}>
                        <div className="slider" style={{ height: '100%', width: '100%', position: 'relative' }}>
                            {promotions.map((promo, idx) => (
                                <img
                                    key={idx}
                                    src={`${API_URL}${promo.image_url}`}
                                    alt="Promoção"
                                    className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentPromoIndex ? 'opacity-100' : 'opacity-0'}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

// ==================================================
// COMPONENTE: CARTÃO DE PREÇO (LÓGICA HÍBRIDA)
// ==================================================
const PriceCard = ({ index, qtdPessoas, colData, liveState, defaults, mediaData, isActive, isTablet }) => {
    // 1. Busca Padrões (Defaults)
    const defSingle = defaults.find(d => d.tipo_dia === liveState.tipo_dia && d.periodo === colData.key && d.qtd_pessoas === 1);
    const defCombo = defaults.find(d => d.tipo_dia === liveState.tipo_dia && d.periodo === colData.key && d.qtd_pessoas === qtdPessoas);

    let finalPrice = defCombo ? parseFloat(defCombo.valor) : 0;
    let showQuestionMarks = false;

    // 2. Lógica Híbrida (Substituição)
    if (colData.type === 'current') {
        const apiSingle = parseFloat(liveState.valor_atual);
        if (qtdPessoas === 1) finalPrice = apiSingle;
        else if (defSingle && defSingle.valor > 0) {
            // Regra de Proporção: Se o Single subiu X%, o Combo sobe X%
            finalPrice = finalPrice * (apiSingle / parseFloat(defSingle.valor));
        }
    } 
    else if (colData.type === 'future') {
        if (liveState.texto_futuro === '???' && !liveState.valor_futuro) showQuestionMarks = true;
        else if (liveState.valor_futuro) {
            const overrideSingle = parseFloat(liveState.valor_futuro);
            if (qtdPessoas === 1) finalPrice = overrideSingle;
            else if (defSingle && defSingle.valor > 0) {
                finalPrice = finalPrice * (overrideSingle / parseFloat(defSingle.valor));
            }
        }
    }
    else if (colData.type === 'past') {
        if (liveState.valor_passado) {
            const overrideSingle = parseFloat(liveState.valor_passado);
            if (qtdPessoas === 1) finalPrice = overrideSingle;
            else if (defSingle && defSingle.valor > 0) {
                finalPrice = finalPrice * (overrideSingle / parseFloat(defSingle.valor));
            }
        }
    }

    const formatPrice = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('R$', '').trim();
    
    let mainDisplayPrice = showQuestionMarks ? '???' : `R$ ${formatPrice(finalPrice)}`;
    let subText = null;
    let topText = null;

    if (qtdPessoas === 2) {
        mainDisplayPrice = showQuestionMarks ? '???' : `R$ ${formatPrice(finalPrice / 2)}`;
        topText = "cada um paga";
        subText = showQuestionMarks ? '' : `valor total da dupla R$ ${formatPrice(finalPrice)}`;
    } else if (qtdPessoas === 3) {
        mainDisplayPrice = showQuestionMarks ? '???' : `R$ ${formatPrice(finalPrice / 3)}`;
        topText = "cada um paga";
        subText = showQuestionMarks ? '' : `valor total do trio R$ ${formatPrice(finalPrice)}`;
    }

    const title = mediaData?.titulo || (qtdPessoas === 1 ? 'Individual' : qtdPessoas === 2 ? 'Mão Amiga' : 'Marmita');
    const mediaUrl = mediaData?.media_url ? `${API_URL}${mediaData.media_url}` : null;
    const isVideo = mediaUrl && (mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm'));

    // Cartão Inativo
    if (!isActive) {
        return (
            <div className="price-card inactive" style={isTablet ? { padding: '0.5rem' } : {}}>
                <h3 style={isTablet ? { fontSize: '0.8rem', marginBottom: 0 } : {}}>{title}</h3>
                {qtdPessoas === 1 ? (
                    <div className="price-value" style={isTablet ? { fontSize: '1.2rem', margin: '0.2rem 0' } : {}}>{mainDisplayPrice}</div>
                ) : (
                    <div className="price-details-new" style={isTablet ? { minHeight: 'auto', margin: 0 } : {}}>
                        <span className="price-per-person-label" style={{ fontSize: '0.6rem' }}>cada um paga</span>
                        <div className="price-per-person-value" style={{ fontSize: isTablet ? '1rem' : '1.4rem' }}>{mainDisplayPrice}</div>
                        <span className="price-total-label" style={{ fontSize: isTablet ? '0.5rem' : '0.65rem' }}>{subText}</span>
                    </div>
                )}
            </div>
        );
    }

    // Cartão Ativo (Com Mídia e Aviso)
    const cardStyle = isTablet ? { padding: '0.8rem', minHeight: '140px', boxShadow: '0 0 15px rgba(255, 77, 0, 0.5)' } : {};
    const titleStyle = isTablet ? { fontSize: '1.2rem', marginBottom: '0.2rem' } : {};
    const priceStyle = isTablet ? { fontSize: '1.8rem', margin: '0.2rem 0' } : {};
    const perPersonStyle = isTablet ? { fontSize: '1.8rem' } : {};
    const labelStyle = isTablet ? { fontSize: '0.8rem' } : {};
    const subTextStyle = isTablet ? { fontSize: '0.7rem' } : {};

    return (
        <div className={`price-card layout-active ${index === 0 ? 'player' : index === 1 ? 'amiga' : 'marmita'}`} style={cardStyle}>
            {mediaUrl && (
                isVideo ? (
                    <video src={mediaUrl} className="card-background-video" autoPlay loop muted playsInline />
                ) : (
                    <img src={mediaUrl} className="card-background-video" alt="" />
                )
            )}

            <div className={`price-card-details ${index === 1 ? 'text-right' : 'text-left'}`}>
                <h3 style={titleStyle}>{title}</h3>

                {qtdPessoas === 1 ? (
                    <div className="price-value" style={priceStyle}>{mainDisplayPrice}</div>
                ) : (
                    <div className="price-details-new">
                        <span className="price-per-person-label" style={labelStyle}>{topText}</span>
                        <div className="price-per-person-value" style={perPersonStyle}>{mainDisplayPrice}</div>
                        <span className="price-total-label" style={subTextStyle}>{subText}</span>
                    </div>
                )}

                {/* [AQUI] Renderiza o aviso da categoria se existir */}
                {mediaData?.aviso_categoria && (
                    <ul className="price-features">
                        <li className="static-feature">{mediaData.aviso_categoria}</li>
                    </ul>
                )}
            </div>
        </div>
    );
};