import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PricesDisplay() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';

    const [config, setConfig] = useState(null);
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState('p1');
    const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        const periodInterval = setInterval(updateActivePeriod, 10000);
        updateActivePeriod();

        const socket = io(API_URL);
        socket.on('prices:updated', (data) => {
            if (data.unidade === currentUnit) fetchData();
        });

        return () => {
            clearInterval(interval);
            clearInterval(periodInterval);
            socket.disconnect();
        };
    }, [currentUnit]);

    useEffect(() => {
        if (promotions.length <= 1) return;
        const promoInterval = setInterval(() => {
            setCurrentPromoIndex(prev => (prev + 1) % promotions.length);
        }, 8000);
        return () => clearInterval(promoInterval);
    }, [promotions]);

    const fetchData = async () => {
        try {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const dateStr = today.toISOString().split('T')[0];

            const holidaysRes = await axios.get(`${API_URL}/api/prices/holidays/${currentUnit}`);
            const isHoliday = holidaysRes.data.some(h => h.data_feriado.startsWith(dateStr));

            let type = 'padrao';
            if (isHoliday) type = 'feriado';
            else if (dayOfWeek === 0 || dayOfWeek === 6) type = 'fim_de_semana';

            const configRes = await axios.get(`${API_URL}/api/prices/config/${currentUnit}/${type}`);
            setConfig(configRes.data);

            const promoRes = await axios.get(`${API_URL}/api/prices/promotions/${currentUnit}`);
            const activePromos = promoRes.data.filter(p => {
                if (!p.dias_ativos || p.dias_ativos.length === 0) return true;
                const todayCode = isHoliday ? 'HOLIDAY' : dayOfWeek;
                return p.dias_ativos.some(d => String(d) === String(todayCode));
            });
            setPromotions(activePromos);

            setLoading(false);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        }
    };

    const updateActivePeriod = () => {
        const h = new Date().getHours();
        if (h >= 6 && h < 14) setActivePeriod('p1');
        else if (h >= 14 && h < 20) setActivePeriod('p2');
        else setActivePeriod('p3');
    };

    const getOrderedPeriods = () => {
        const periods = {
            p1: { key: 'preco_p1', title: 'MANHÃ/TARDE', time: '06H ÀS 13H59' },
            p2: { key: 'preco_p2', title: 'TARDE/NOITE', time: '14H ÀS 19H59' },
            p3: { key: 'preco_p3', title: 'NOITE/MADRUGADA', time: '20H ÀS 05H59' }
        };

        if (activePeriod === 'p1') return [periods.p3, periods.p1, periods.p2];
        if (activePeriod === 'p2') return [periods.p1, periods.p2, periods.p3];
        if (activePeriod === 'p3') return [periods.p2, periods.p3, periods.p1];

        return [periods.p1, periods.p2, periods.p3];
    };

    if (loading) return <div className="loading-screen">CARREGANDO TABELA...</div>;
    if (!config) return <div className="loading-screen">TABELA NÃO CONFIGURADA</div>;

    const orderedColumns = getOrderedPeriods();
    const isTabletMode = config.modo_exibicao === 'tablet';

    return (
        <div className="pricing-page-wrapper" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div className="multi">
                <div className="multichrome-background">
                    <div className="multichrome-light"></div>
                    <div className="multichrome-ambient-1 float-effect-1"></div>
                    <div className="multichrome-ambient-2 float-effect-2"></div>
                    <div className="multichrome-ambient-3 float-effect-3"></div>
                </div>
            </div>

            <section className="pricing-section" style={{
                paddingTop: 0,
                gap: isTabletMode ? '0.2rem' : '0.5rem',
                height: '100vh',
                justifyContent: 'center',
                flexDirection: 'column'
            }}>
                <div className="pricing-content" style={isTabletMode ? { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 } : {}}>
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
                                        {config.categorias.map((cat, idx) => (
                                            <PriceCard
                                                key={idx}
                                                index={idx}
                                                category={cat}
                                                priceKey={colData.key}
                                                isActive={isColumnActive}
                                                isTablet={isTabletMode}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="price-notes" style={{ marginTop: isTabletMode ? '0.5rem' : '1rem' }}>
                        {config.aviso_1 && <p style={{ margin: '0', fontSize: '0.8rem' }}>* {config.aviso_1}</p>}
                        {config.aviso_2 && <p style={{ margin: '0', fontSize: '0.8rem' }}>* {config.aviso_2}</p>}
                        {config.aviso_3 && <p style={{ margin: '0', fontSize: '0.8rem' }}>** {config.aviso_3}</p>}
                        {config.aviso_4 && <p style={{ margin: '0', fontSize: '0.8rem' }}>** {config.aviso_4}</p>}
                    </div>
                </div>

                {!isTabletMode && promotions.length > 0 && (
                    <div className="slider-container" style={{ aspectRatio: '16/9', height: 'auto', width: '100%', marginTop: '1rem', marginBottom: '1rem' }}>
                        <div className="slider" style={{ height: '100%' }}>
                            {promotions.map((promo, idx) => (
                                <img
                                    key={idx}
                                    src={`${API_URL}${promo.image_url}`}
                                    alt="Promoção"
                                    className={idx === currentPromoIndex ? 'active' : ''}
                                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

const PriceCard = ({ index, category, priceKey, isActive, isTablet }) => {
    const isVideo = category.video && (category.video.endsWith('.mp4') || category.video.endsWith('.webm'));
    const mediaUrl = category.video ? `${API_URL}${category.video}` : null;

    const priceStr = category[priceKey] || '';
    const hasPrice = priceStr && priceStr !== '' && priceStr !== 'R$ 0,00';

    const parsePrice = (str) => {
        if (!str) return 0;
        return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.'));
    };

    const formatPrice = (val) => {
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('R$', '').trim();
    };

    const fullPriceVal = parsePrice(priceStr);

    let mainDisplayPrice = '--';
    let subText = null;
    let topText = null;

    if (hasPrice) {
        if (index === 0) {
            mainDisplayPrice = `R$ ${formatPrice(fullPriceVal)}`;
        } else if (index === 1) {
            mainDisplayPrice = `R$ ${formatPrice(fullPriceVal / 2)}`;
            topText = "cada um paga";
            subText = `valor total da dupla R$ ${formatPrice(fullPriceVal)}`;
        } else if (index === 2) {
            mainDisplayPrice = `R$ ${formatPrice(fullPriceVal / 3)}`;
            topText = "cada um paga";
            subText = `valor total do trio R$ ${formatPrice(fullPriceVal)}`;
        } else {
            mainDisplayPrice = `R$ ${formatPrice(fullPriceVal)}`;
        }
    }

    if (!isActive) {
        return (
            <div className="price-card inactive" style={isTablet ? { padding: '0.5rem' } : {}}>
                <h3 style={isTablet ? { fontSize: '0.8rem', marginBottom: 0 } : {}}>{category.titulo}</h3>

                {index === 0 ? (
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

    const cardStyle = isTablet ? {
        padding: '0.8rem',
        minHeight: '140px',
        boxShadow: '0 0 15px rgba(255, 77, 0, 0.5)'
    } : {};

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
                <h3 style={titleStyle}>{category.titulo}</h3>

                {index === 0 ? (
                    <div className="price-value" style={priceStyle}>{mainDisplayPrice}</div>
                ) : (
                    <div className="price-details-new">
                        <span className="price-per-person-label" style={labelStyle}>{topText}</span>
                        <div className="price-per-person-value" style={perPersonStyle}>{mainDisplayPrice}</div>
                        <span className="price-total-label" style={subTextStyle}>{subText}</span>
                    </div>
                )}

                {category.aviso_categoria && (
                    <ul className="price-features">
                        <li className="static-feature">{category.aviso_categoria}</li>
                    </ul>
                )}
            </div>
        </div>
    );
};