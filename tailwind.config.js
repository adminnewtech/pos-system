/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  direction: 'rtl',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        accent: {
          gold: '#d4af37',
          green: '#059669',
        },
      },
      fontFamily: {
        arabic: ['Tajawal', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
