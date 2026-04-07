import React from 'react';
import BananaIconFilled from '../assets/BananaIcon.webp'; 
import BananaIconOutline from '../assets/BananaLike.webp';

export default function BananasIcon({ type = 'outline', size = 24, className = '' }) {
  const imageSrc = type === 'filled' ? BananaIconFilled : BananaIconOutline;

  return (
    <img 
      src={imageSrc} 
      alt={type === 'filled' ? "Curtiu com Banana" : "Dar Banana"} 
      width={size}
      height={size}
      className={`object-contain drop-shadow-md transition-all duration-300 ${className}`} 
      style={{ width: size, height: size }}
    />
  );
}