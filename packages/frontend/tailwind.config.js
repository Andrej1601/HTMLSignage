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
        },
      },
    },
  },
  plugins: [],
}
