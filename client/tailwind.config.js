/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rpg: {
          dark: '#0c0e14',
          panel: '#151922',
          border: '#272f40',
          accent: '#6366f1',
          crimson: '#e11d48',
          gold: '#eab308',
          parchment: '#f8fafc'
        }
      }
    },
  },
  plugins: [],
}
