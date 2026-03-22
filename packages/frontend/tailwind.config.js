/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wellness/Spa Theme
        spa: {
          primary: '#8B6F47',
          'primary-light': '#B8976A',
          'primary-dark': '#6B5435',
          secondary: '#7FA99B',
          'secondary-light': '#A8C7BC',
          'secondary-dark': '#5A7A70',
          accent: '#D4A574',
          'accent-warm': '#E8C79B',
          'bg-primary': '#F9F7F4',
          'bg-secondary': '#EDE9E3',
          'text-primary': '#2C2416',
          'text-secondary': '#5A4E3F',
          success: '#10B981',
          'success-light': '#D1FAE5',
          'success-dark': '#047857',
          warning: '#F59E0B',
          'warning-light': '#FEF3C7',
          'warning-dark': '#B45309',
          error: '#EF4444',
          'error-light': '#FEE2E2',
          'error-dark': '#B91C1C',
          info: '#3B82F6',
          'info-light': '#DBEAFE',
          'info-dark': '#1D4ED8',
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
