export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
          light: '#22d3ee',
        },
        dark: {
          base: '#020813',
          surface: '#061224',
          glass: 'rgba(6, 18, 36, 0.6)',
          border: 'rgba(6, 182, 212, 0.15)',
          text: '#ffffff',
          muted: '#8ba3b8',
        },
        light: {
          base: '#f0f5f9',
          surface: '#ffffff',
          glass: 'rgba(255, 255, 255, 0.7)',
          border: 'rgba(0, 0, 0, 0.05)',
          text: '#0f172a',
          muted: '#64748b',
        }
      },
      boxShadow: {
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glow-primary': '0 0 20px rgba(6, 182, 212, 0.4)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.4)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite linear',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
}