import React from 'react';

const BananasIcon = ({ type = 'outline', size = 28, className = '' }) => {
  const isFilled = type === 'filled';
  const gradId = 'bananagrad_official_checkin';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill={isFilled ? `url(#${gradId})` : 'none'}
      stroke={isFilled ? 'none' : 'currentColor'}
      strokeWidth={isFilled ? '0' : '16'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-all duration-300 ${className} ${
        isFilled ? 'drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'text-white/80'
      }`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#facc15', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#ca8a04', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {isFilled ? (
        <g>
          <path
            d="M192 448C176 448 160 416 160 384H224C224 416 208 448 192 448Z"
            fill="#6B472A"
          />
          <path
            d="M128 320C128 248 160 192 192 192C224 192 256 248 256 320V384H128V320Z"
            fill={`url(#${gradId})`}
          />
          <path
            d="M128 320C96 320 64 256 64 192C64 128 96 64 128 64C160 64 192 128 192 192C192 256 160 320 128 320Z"
            fill={`url(#${gradId})`}
          />
          <path
            d="M256 320C288 320 320 256 320 192C320 128 288 64 256 64C224 64 192 128 192 192C192 256 224 320 256 320Z"
            fill={`url(#${gradId})`}
          />
          <path
            d="M192 192C192 128 176 96 192 96C208 96 192 128 192 192V192Z"
            fill="#F4EDE4"
          />
        </g>
      ) : (
        <g>
          <path d="M192 448C160 448 128 392 128 320C96 320 64 256 64 192C64 128 96 64 128 64C160 64 192 128 192 192C192 256 224 320 256 320C288 320 320 256 320 192C320 128 288 64 256 64C224 64 192 128 192 192C192 128 176 96 192 96C208 96 192 128 192 192C192 256 160 320 128 320M128 320C128 248 160 192 192 192C224 192 256 248 256 320" />
        </g>
      )}
    </svg>
  );
};

export default BananasIcon;