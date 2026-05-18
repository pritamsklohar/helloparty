/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F5F7FB',
        surface: '#FFFFFF',
        surfaceAlt: '#EEF2F6',
        primary: '#7C3AED',
        primaryHover: '#6D28D9',
        secondary: '#EF4444',
        accent: '#F59E0B',
        success: '#10B981',
        muted: '#64748B',
        border: '#E2E8F0',
        white: '#1E293B', // Redefine white to be dark slate in the light theme!
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
        'float-up': 'float-up 1.5s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-60px)', opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
