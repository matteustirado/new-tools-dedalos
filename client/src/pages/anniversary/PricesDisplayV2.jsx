import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// CONSTANTES VISUAIS - GOLDEN ERA
const GOLDEN_TEXT_GRADIENT = "bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600";
const GOLDEN_GLASS_ACTIVE = "bg-[#0a0a0a]/90 backdrop-blur-2xl border-2 border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.2)]";

export default function PricesDisplayV2() {
  const { unidade } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const currentUnit = unidade ? unidade.toUpperCase() : 'SP';
  const forceMode = queryParams.get('force');

  const [liveState, setLiveState] = useState(null);
  const [defaults, setDefaults] = useState([]);
  const [categoryMedia, setCategoryMedia] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isTabletMode, setIsTabletMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [currentPartyBannerIndex, setCurrentPartyBannerIndex] = useState(0);

  const promoLengthRef = useRef(0);
  const partyBannerLengthRef = useRef(0);

  const activePeriod = liveState?.periodo_atual || 'manha';

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      let isMob = width < 768;
      let isTab = width >= 768 && width < 1024;

      if (forceMode === 'mobile') {
        isMob = true;
        isTab = false;
      } else if (forceMode === 'tablet') {
        isTab = true;
        isMob = false;
      } else if (forceMode === 'tv') {
        isTab = false;
        isMob = false;
      }

      setIsMobile(isMob);
      setIsTabletMode(isTab);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, [forceMode]);

  useEffect(() => {
    fetchData();

    const socket = io(API_URL);
    
    socket.on('connect', () => console.log('Socket conectado: PricesDisplay'));

    socket.on('prices:updated', (data) => {
      if (!data.unidade || data.unidade === currentUnit) {
        console.log('Atualização de preços recebida do servidor!');
        fetchData();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUnit]);

  useEffect(() => {
    promoLengthRef.current = promotions.length;
    partyBannerLengthRef.current = liveState?.party_banners?.length || 0;

    setCurrentPromoIndex((prev) => (prev >= promotions.length ? 0 : prev));
    setCurrentPartyBannerIndex((prev) => (prev >= (liveState?.party_banners?.length || 0) ? 0 : prev));
  }, [promotions, liveState]);

  useEffect(() => {
    const masterSliderInterval = setInterval(() => {
      if (promoLengthRef.current > 1) {
        setCurrentPromoIndex((prev) => (prev + 1) % promoLengthRef.current);
      }
      
      if (partyBannerLengthRef.current > 1) {
        setCurrentPartyBannerIndex((prev) => (prev + 1) % partyBannerLengthRef.current);
      }
    }, 8000);

    return () => clearInterval(masterSliderInterval);
  }, []);

  const fetchData = async () => {
    try {
      const [stateRes, defaultsRes, mediaRes, promoRes] = await Promise.all([
        axios.get(`${API_URL}/api/prices/state/${currentUnit}`),
        axios.get(`${API_URL}/api/prices/defaults?unidade=${currentUnit}`),
        axios.get(`${API_URL}/api/prices/media/${currentUnit}`),
        axios.get(`${API_URL}/api/prices/promotions/${currentUnit}`).catch(() => ({ data: [] }))
      ]);

      const stateData = stateRes.data;

      if (typeof stateData.party_banners === 'string') {
        try {
          stateData.party_banners = JSON.parse(stateData.party_banners);
        } catch (e) {
          stateData.party_banners = [];
        }
      } else if (!Array.isArray(stateData.party_banners)) {
        stateData.party_banners = [];
      }

      setLiveState(stateData);
      setDefaults(defaultsRes.data);

      const media = mediaRes.data;
      const fullMedia = [1, 2, 3].map((qtd) =>
        media.find((m) => m.qtd_pessoas === qtd) || {
          qtd_pessoas: qtd,
          titulo: 'Categoria',
          media_url: null,
          aviso_categoria: ''
        }
      );

      setCategoryMedia(fullMedia);

      const today = new Date();
      const dayOfWeek = today.getDay();

      const activePromos = (promoRes.data || []).filter((p) => {
        if (!p.dias_ativos || p.dias_ativos.length === 0) return true;

        let dias = p.dias_ativos;
        
        if (typeof dias === 'string') {
          try {
            dias = JSON.parse(dias);
          } catch (e) {
            dias = [];
          }
        }

        return Array.isArray(dias) && dias.some((d) => String(d) === String(dayOfWeek));
      });

      setPromotions(activePromos);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const getOrderedPeriods = () => {
    const periodsData = {
      manha: { key: 'manha', title: 'MANHÃ/TARDE', time: '06H ÀS 13H59' },
      tarde: { key: 'tarde', title: 'TARDE/NOITE', time: '14H ÀS 19H59' },
      noite: { key: 'noite', title: 'NOITE/MADRUGADA', time: '20H ÀS 05H59' }
    };

    if (activePeriod === 'manha') {
      return [
        { ...periodsData.noite, type: 'past' },
        { ...periodsData.manha, type: 'current' },
        { ...periodsData.tarde, type: 'future' }
      ];
    }

    if (activePeriod === 'tarde') {
      return [
        { ...periodsData.manha, type: 'past' },
        { ...periodsData.tarde, type: 'current' },
        { ...periodsData.noite, type: 'future' }
      ];
    }

    return [
      { ...periodsData.tarde, type: 'past' },
      { ...periodsData.noite, type: 'current' },
      { ...periodsData.manha, type: 'future' }
    ];
  };

  if (loading) return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center font-black text-2xl tracking-widest uppercase animate-pulse">
          <span className={GOLDEN_TEXT_GRADIENT}>Iniciando Era de Ouro...</span>
      </div>
  );
  if (!liveState) return <div className="h-screen w-screen bg-[#050505] flex items-center justify-center font-black text-xl text-yellow-500/50">AGUARDANDO CONFIGURAÇÃO...</div>;

  const orderedColumns = getOrderedPeriods();

  const safePartyBannerIndex = liveState.party_banners
    ? currentPartyBannerIndex >= liveState.party_banners.length
      ? 0
      : currentPartyBannerIndex
    : 0;

  const safePromoIndex = currentPromoIndex >= promotions.length ? 0 : currentPromoIndex;

  const GoldenBackground = () => (
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#050505] overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[100vh] leading-none font-black text-yellow-500/[0.03] tracking-tighter mix-blend-screen">7</div>
          <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] bg-yellow-600/10 rounded-full blur-[150px] animate-float-slow" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[1000px] h-[1000px] bg-yellow-900/20 rounded-full blur-[120px] animate-float-reverse" />
      </div>
  );

  if (liveState.modo_festa) {
    return (
      <div className="w-full min-h-screen text-white font-sans selection:bg-none relative overflow-hidden">
        <GoldenBackground />

        <section
          className="relative z-10 w-full max-w-[1920px] mx-auto flex flex-col items-center"
          style={{
            paddingTop: isTabletMode || isMobile ? '10vh' : '4vh',
            height: '100vh',
            justifyContent: isTabletMode || isMobile ? 'center' : 'flex-start',
            gap: isTabletMode || isMobile ? '2rem' : '1rem'
          }}
        >
          <div className="w-full px-6 md:px-12 flex-1 flex flex-col justify-start">
            <div 
              className={`flex w-full gap-4 md:gap-8 ${isMobile ? 'justify-center' : 'justify-between'}`}
            >
              {orderedColumns.map((colData, colIndex) => {
                const isColumnActive = colIndex === 1;

                if (isMobile && !isColumnActive) return null;

                return (
                  <div key={colData.key} className={`flex flex-col flex-1 max-w-[400px] transition-all duration-700 ${isColumnActive ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
                    <h3
                      className={`font-black uppercase tracking-widest text-center mb-6 drop-shadow-md ${isColumnActive ? GOLDEN_TEXT_GRADIENT : 'text-white/50'}`}
                      style={{ fontSize: isTabletMode || isMobile ? '1.5rem' : '1.2rem' }}
                    >
                      {colData.title}
                    </h3>
                    
                    <div className="flex flex-col gap-4">
                      <PriceCard
                        index={0}
                        qtdPessoas={1}
                        colData={colData}
                        liveState={liveState}
                        defaults={defaults}
                        mediaData={categoryMedia.find((m) => m.qtd_pessoas === 1)}
                        isActive={isColumnActive}
                        isTablet={isTabletMode || isMobile}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 text-center flex flex-col items-center gap-2 drop-shadow-lg z-20">
              {liveState.aviso_1 && <p className={`font-black uppercase tracking-wider text-xl md:text-2xl ${GOLDEN_TEXT_GRADIENT}`}>* {liveState.aviso_1}</p>}
              {liveState.aviso_2 && <p className={`font-black uppercase tracking-wider text-xl md:text-2xl ${GOLDEN_TEXT_GRADIENT}`}>* {liveState.aviso_2}</p>}
              {liveState.aviso_3 && <p className="text-yellow-500/70 font-bold uppercase tracking-widest text-lg md:text-xl">** {liveState.aviso_3}</p>}
              {liveState.aviso_4 && <p className="text-yellow-500/70 font-bold uppercase tracking-widest text-lg md:text-xl">** {liveState.aviso_4}</p>}
            </div>
          </div>

          {/* FLYERS FESTA - CORRIGIDO: CENTRALIZADO PARA NÃO CORTAR O TOPO */}
          {!isTabletMode && !isMobile && (
            <div className="flex-1 w-full max-w-[1200px] flex items-center justify-center pb-8 pt-4 overflow-hidden z-20">
              {liveState.party_banners && liveState.party_banners.length > 0 ? (
                <div className="relative h-full aspect-[3/4] max-h-[55vh] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-yellow-500/30 bg-black">
                  {liveState.party_banners.map((bannerUrl, idx) => (
                    <img
                      key={idx}
                      src={`${API_URL}${bannerUrl}`}
                      className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-[1500ms] ${
                        idx === safePartyBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                      }`}
                      alt="Festa"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-yellow-500/30 text-3xl font-black uppercase tracking-[0.3em] animate-pulse">
                  ESPERANDO FLYERS...
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  // MODO NORMAL (DIA A DIA)
  return (
    <div className="w-full min-h-screen text-white font-sans selection:bg-none relative overflow-hidden flex flex-col">
      <GoldenBackground />

      <section
        className="relative z-10 w-full h-full max-w-[1920px] mx-auto flex flex-col flex-1"
        style={{
          paddingTop: isTabletMode || isMobile ? '2vh' : '5vh',
          paddingBottom: isTabletMode || isMobile ? '2vh' : '5vh',
          paddingLeft: '2rem',
          paddingRight: '2rem',
        }}
      >
        <div className="w-full flex-1 flex flex-col justify-start">
          <div className={`flex w-full h-full gap-4 lg:gap-8 ${isMobile ? 'justify-center' : 'justify-between'}`}>
            {orderedColumns.map((colData, colIndex) => {
              const isColumnActive = colIndex === 1;

              if (isMobile && !isColumnActive) return null;

              return (
                <div key={colData.key} className={`flex flex-col flex-1 max-w-[500px] transition-all duration-700 ${isColumnActive ? 'opacity-100 scale-100 z-20' : 'opacity-40 scale-95 z-0'}`}>
                  <div className="text-center mb-4 md:mb-6 h-16 flex flex-col justify-end">
                      <h3
                        className={`font-black uppercase tracking-[0.15em] drop-shadow-md leading-tight ${isColumnActive ? GOLDEN_TEXT_GRADIENT : 'text-white/50'}`}
                        style={{ fontSize: isTabletMode || isMobile ? '1.5rem' : '1.8rem' }}
                      >
                        {colData.title}
                      </h3>
                      <span className={`block font-bold text-xs uppercase tracking-widest mt-1 ${isColumnActive ? 'text-yellow-500/80' : 'text-white/30'}`}>
                          {colData.time}
                      </span>
                  </div>

                  <div className="flex flex-col gap-4 md:gap-5 flex-1">
                    {[1, 2, 3].map((qtdPessoas, idx) => (
                      <PriceCard
                        key={qtdPessoas}
                        index={idx}
                        qtdPessoas={qtdPessoas}
                        colData={colData}
                        liveState={liveState}
                        defaults={defaults}
                        mediaData={categoryMedia.find((m) => m.qtd_pessoas === qtdPessoas)}
                        isActive={isColumnActive}
                        isTablet={isTabletMode || isMobile}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RODAPÉ AVISOS */}
        <div className="mt-8 mb-6 flex flex-col items-center gap-1.5 z-20 shrink-0">
          {liveState.aviso_1 && <p className="text-yellow-500/90 font-bold uppercase tracking-wider text-base md:text-xl drop-shadow-md">* {liveState.aviso_1}</p>}
          {liveState.aviso_2 && <p className="text-yellow-500/90 font-bold uppercase tracking-wider text-base md:text-xl drop-shadow-md">* {liveState.aviso_2}</p>}
          {liveState.aviso_3 && <p className="text-yellow-500/50 font-bold uppercase tracking-widest text-sm md:text-lg">** {liveState.aviso_3}</p>}
          {liveState.aviso_4 && <p className="text-yellow-500/50 font-bold uppercase tracking-widest text-sm md:text-lg">** {liveState.aviso_4}</p>}
          
          {liveState.texto_futuro && liveState.texto_futuro !== '???' && (
            <p className={`mt-4 font-black uppercase tracking-widest text-2xl md:text-4xl drop-shadow-lg ${GOLDEN_TEXT_GRADIENT}`}>
              {liveState.texto_futuro}
            </p>
          )}
        </div>

        {/* SLIDER DE PROMOÇÕES */}
        {!isTabletMode && !isMobile && promotions.length > 0 && (
          <div className="absolute right-12 bottom-12 z-30 pointer-events-none">
            <div className="w-[450px] aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-yellow-500/30 bg-black relative">
              {promotions.map((promo, idx) => (
                <img
                  key={promo.id || idx}
                  src={`${API_URL}${promo.image_url}`}
                  alt="Promoção"
                  className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                    idx === safePromoIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const PriceCard = ({ index, qtdPessoas, colData, liveState, defaults, mediaData, isActive, isTablet }) => {
  const defSingle = defaults.find(
    (d) => d.tipo_dia === liveState.tipo_dia && d.periodo === colData.key && d.qtd_pessoas === 1
  );
  
  const defCombo = defaults.find(
    (d) => d.tipo_dia === liveState.tipo_dia && d.periodo === colData.key && d.qtd_pessoas === qtdPessoas
  );

  let finalPrice = defCombo ? parseFloat(defCombo.valor) : 0;
  let showQuestionMarks = false;

  if (colData.type === 'current') {
    const apiSingle = parseFloat(liveState.valor_atual);

    if (qtdPessoas === 1) {
      finalPrice = apiSingle;
    } else if (defSingle && defSingle.valor > 0) {
      finalPrice = finalPrice * (apiSingle / parseFloat(defSingle.valor));
    }
  } else if (colData.type === 'future') {
    if (liveState.texto_futuro === '???' && !liveState.valor_futuro) {
      showQuestionMarks = true;
    } else if (liveState.valor_futuro) {
      const overrideSingle = parseFloat(liveState.valor_futuro);

      if (qtdPessoas === 1) {
        finalPrice = overrideSingle;
      } else if (defSingle && defSingle.valor > 0) {
        finalPrice = finalPrice * (overrideSingle / parseFloat(defSingle.valor));
      }
    }
  } else if (colData.type === 'past') {
    if (liveState.valor_passado) {
      const overrideSingle = parseFloat(liveState.valor_passado);

      if (qtdPessoas === 1) {
        finalPrice = overrideSingle;
      } else if (defSingle && defSingle.valor > 0) {
        finalPrice = finalPrice * (overrideSingle / parseFloat(defSingle.valor));
      }
    }
  }

  const formatPrice = (val) =>
    val
      .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      .replace('R$', '')
      .trim();

  let mainDisplayPrice = showQuestionMarks ? '???' : `R$ ${formatPrice(finalPrice)}`;
  let subText = null;
  let topText = null;

  if (qtdPessoas === 2) {
    mainDisplayPrice = showQuestionMarks ? '???' : `R$ ${formatPrice(finalPrice / 2)}`;
    topText = 'CADA UM PAGA';
    subText = showQuestionMarks ? '' : `VALOR TOTAL DA DUPLA: R$ ${formatPrice(finalPrice)}`;
  } else if (qtdPessoas === 3) {
    mainDisplayPrice = showQuestionMarks ? '???' : `R$ ${formatPrice(finalPrice / 3)}`;
    topText = 'CADA UM PAGA';
    subText = showQuestionMarks ? '' : `VALOR TOTAL DO TRIO: R$ ${formatPrice(finalPrice)}`;
  }

  const title = mediaData?.titulo || (qtdPessoas === 1 ? 'INDIVIDUAL' : qtdPessoas === 2 ? 'MÃO AMIGA' : 'MARMITA');
  const mediaUrl = mediaData?.media_url ? `${API_URL}${mediaData.media_url}` : null;
  const isVideo = mediaUrl && (mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm'));

  // ESTILO INATIVO (Colunas do Passado e Futuro)
  if (!isActive) {
    return (
      <div className="bg-[#151515]/60 border border-white/5 rounded-3xl p-6 flex flex-col justify-center min-h-[140px]">
        <h3 className="text-white/40 font-black uppercase tracking-widest text-sm mb-2">{title}</h3>
        
        {qtdPessoas === 1 ? (
          <div className="text-white/30 font-bold text-3xl font-mono tracking-tight">
            {mainDisplayPrice}
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-white/20 font-bold text-[10px] tracking-widest">{topText}</span>
            <div className="text-white/30 font-bold text-2xl font-mono tracking-tight">
              {mainDisplayPrice}
            </div>
            <span className="text-white/20 text-[9px] uppercase font-bold tracking-widest mt-1">
              {subText}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ESTILO ATIVO (Coluna Atual - GOLDEN ERA)
  return (
    <div className={`relative rounded-[2rem] overflow-hidden flex-1 min-h-[220px] flex flex-col justify-end p-8 ${GOLDEN_GLASS_ACTIVE}`}>
      {/* Background Media com Sépia e Grayscale para tons de Ouro */}
      {mediaUrl && (
        <div className="absolute inset-0 z-0">
          {isVideo ? (
            <video src={mediaUrl} className="w-full h-full object-cover grayscale-[0.4] sepia-[0.3] opacity-60 mix-blend-screen" autoPlay loop muted playsInline />
          ) : (
            <img src={mediaUrl} className="w-full h-full object-cover grayscale-[0.4] sepia-[0.3] opacity-60 mix-blend-screen" alt="" />
          )}
          {/* Gradiente para escurecer a base da imagem e dar leitura ao texto */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
        </div>
      )}

      <div className={`relative z-10 w-full flex flex-col ${index === 1 ? 'items-end text-right' : 'items-start text-left'}`}>
        <h3 className={`font-black uppercase tracking-[0.2em] text-xl md:text-2xl drop-shadow-md mb-1 ${GOLDEN_TEXT_GRADIENT}`}>{title}</h3>

        {qtdPessoas === 1 ? (
          <div className="font-black text-5xl md:text-6xl text-white drop-shadow-[0_2px_15px_rgba(0,0,0,1)] tracking-tighter">
            {mainDisplayPrice}
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-yellow-500/80 font-black text-xs md:text-sm tracking-widest drop-shadow-md">
              {topText}
            </span>
            <div className="font-black text-5xl md:text-6xl text-white drop-shadow-[0_2px_15px_rgba(0,0,0,1)] tracking-tighter">
              {mainDisplayPrice}
            </div>
            <span className="text-yellow-500/60 font-bold text-[10px] md:text-xs uppercase tracking-widest mt-1">
              {subText}
            </span>
          </div>
        )}

        {mediaData?.aviso_categoria && (
          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5 backdrop-blur-md">
             <span className="text-yellow-400 font-bold text-xs uppercase tracking-widest drop-shadow-sm">{mediaData.aviso_categoria}</span>
          </div>
        )}
      </div>
    </div>
  );
};