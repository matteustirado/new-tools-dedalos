import React, { useMemo, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const Barcode = ({ value }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        const cleanValue = value.replace(/\D/g, '');

        if (cleanValue) {
          JsBarcode(canvasRef.current, cleanValue, {
            format: 'CODE128',
            displayValue: false,
            height: 25,
            width: 1.5,
            margin: 0,
            background: 'transparent',
            lineColor: '#000',
          });
        }
      } catch (e) {
        console.error('Erro ao gerar barcode:', e);
      }
    }
  }, [value]);

  if (!value) {
    return (
      <div className="bg-white px-2 py-1 inline-block rounded-sm mt-1 h-[25px] w-[100px] bg-gray-300 animate-pulse"></div>
    );
  }

  return (
    <div className="bg-white px-2 py-1 inline-block rounded-sm mt-1">
      <canvas ref={canvasRef} />
    </div>
  );
};

const LogoTriangle = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="gradLogo" x1="0%" y1="100%" x2="50%" y2="0%">
        <stop offset="0%" stopColor="#FFCC00" />
        <stop offset="100%" stopColor="#FF6600" />
      </linearGradient>
    </defs>
    <path d="M50 5 L95 95 H5 Z" stroke="url(#gradLogo)" strokeWidth="4" />
    <path d="M50 25 L80 85 H20 Z" stroke="url(#gradLogo)" strokeWidth="3" />
    <path d="M50 45 L65 75 H35 Z" stroke="url(#gradLogo)" strokeWidth="2" />
    <circle cx="50" cy="65" r="3" fill="#FFCC00" />
  </svg>
);

const HeaderIcons = () => (
  <div className="flex gap-1 mb-0.5 opacity-90">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFCC00" strokeWidth="3">
      <path d="M12 4L21 20H3L12 4Z" />
    </svg>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFCC00" strokeWidth="3">
      <circle cx="12" cy="12" r="9" />
    </svg>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFCC00" strokeWidth="3">
      <path d="M5 5L19 19M5 19L19 5" />
    </svg>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFCC00" strokeWidth="3">
      <rect x="4" y="4" width="16" height="16" />
    </svg>
  </div>
);

const formatName = (name) => {
  if (!name) return 'NOME';
  const parts = name.trim().split(' ');
  return parts.length <= 2 ? name : `${parts[0]} ${parts[1]}`;
};

export default function BadgeTemplate({ data = {}, config = {} }) {
  const {
    headerHeight = 30,
    photoShape = 'circle',
    nameSize = 24,
    roleSize = 14,
    textures = [],
    logoUrl = null,
    logoSize = 80,
    contentY = 0,
    photoY = 0,
  } = config;

  const admissionDate = data.admission_date
    ? new Date(data.admission_date).toLocaleDateString('pt-BR')
    : 'DD/MM/AAAA';

  const getTexturePath = (name) => {
    return new URL(`../assets/image/${name}.png`, import.meta.url).href;
  };

  return (
    <div
      id="badge-print-area"
      className="w-[480px] h-[270px] bg-[#FF4500] relative overflow-hidden shadow-xl print:shadow-none border border-white/10"
    >
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#FF6600] to-[#FF4500] overflow-hidden">
        {textures.includes('marca_dagua') && (
          <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{ opacity: 0.8 }}>
            <img src={getTexturePath('marca_dagua')} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {textures.includes('pontilhado') && (
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.6 }}>
            <img src={getTexturePath('pontilhado')} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {textures.includes('direcionais') && (
          <div className="absolute inset-0 pointer-events-none mix-blend-screen" style={{ opacity: 0.5 }}>
            <img src={getTexturePath('direcionais')} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      <div
        className="absolute top-0 left-0 w-full bg-black z-10 flex justify-between px-4 transition-all duration-300 shadow-lg"
        style={{ height: `${headerHeight}%` }}
      >
        <div className="flex items-center h-full">
          <div
            className="flex items-center justify-center transition-all duration-300"
            style={{ height: `${logoSize}%`, width: 'auto', aspectRatio: '1/1' }}
          >
            {logoUrl ? (
              <img
                src={logoUrl.startsWith('http') ? logoUrl : `${API_URL}${logoUrl}`}
                alt="Logo"
                className="h-full w-auto object-contain"
              />
            ) : (
              <div className="w-10 h-10">
                <LogoTriangle />
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-0 right-0 top-3 text-center pointer-events-none">
          <h1
            className="text-2xl font-black text-white tracking-wider uppercase"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            DÉDALOS BAR
          </h1>
        </div>

        <div className="flex flex-col items-end justify-end h-full pb-2">
          <HeaderIcons />
          <p className="text-[8px] text-white font-medium whitespace-nowrap leading-none mt-0.5">
            Admissão: {admissionDate}
          </p>
        </div>
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center">
        <div
          className="absolute transition-all duration-300"
          style={{ top: `calc(35% + ${photoY}px)`, transform: 'translateY(-50%)' }}
        >
          <div
            className="w-28 h-28 border-[3px] border-[#FFCC00] bg-gray-800 overflow-hidden shadow-2xl"
            style={{ borderRadius: photoShape === 'circle' ? '50%' : photoShape === 'rounded' ? '1rem' : '0' }}
          >
            {data.photo_url ? (
              <img
                src={data.photo_url.startsWith('http') || data.photo_url.startsWith('data:') ? data.photo_url : `${API_URL}${data.photo_url}`}
                alt="Foto"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <span className="material-symbols-outlined text-5xl text-white/20">person</span>
              </div>
            )}
          </div>
        </div>

        <div
          className="absolute w-full px-2 flex flex-col items-center transition-all duration-300"
          style={{ top: `calc(65% + ${contentY}px)`, transform: 'translateY(-20%)' }}
        >
          <h2
            className="font-black text-white uppercase leading-none drop-shadow-lg"
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: `${nameSize}px` }}
          >
            {formatName(data.name)}
          </h2>

          <p
            className="font-medium text-white uppercase tracking-wide drop-shadow-md mb-1"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: `${roleSize}px` }}
          >
            {data.role || 'CARGO'}
          </p>

          <div>
            <Barcode value={data.cpf} />
          </div>
        </div>
      </div>
    </div>
  );
}