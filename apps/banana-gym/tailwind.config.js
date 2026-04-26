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
          DEFAULT: '#ff4d00',
          dark: '#cc3d00',
          light: '#ff7033',
        },
        dark: {
          base: '#050505',
          surface: '#111111',
          glass: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
          text: '#ffffff',
          muted: '#a1a1aa',
        },
        light: {
          base: '#f3f4f6',
          surface: '#ffffff',
          glass: 'rgba(255, 255, 255, 0.65)',
          border: 'rgba(0, 0, 0, 0.1)',
          text: '#1f2937',
          muted: '#6b7280',
        }
      },
      boxShadow: {
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glow-primary': '0 0 20px rgba(255, 77, 0, 0.4)',
        'glow-yellow': '0 0 20px rgba(234, 179, 8, 0.4)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite linear', // 👈 Adicionamos a animação aqui
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
        shimmer: { // 👈 E o movimento do brilho aqui
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
}