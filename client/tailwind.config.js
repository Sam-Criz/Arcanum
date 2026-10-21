import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
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
};
