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
        arcanum: {
          tinta: '#131211',
          papel: '#1a1816',
          couro: '#2c2825',
          osso: '#ece3d0',
          latao: '#c9a04e',
          vinho: '#8a2c38',
          vida: '#b24a52',
          mana: '#6f93ad',
          cura: '#5e9b76',
          condicao: '#9a83c6',
          apoio: '#aaa292',
          borda: '#574e45'
        },
        rpg: {
          dark: '#131211',
          panel: '#1a1816',
          border: '#2c2825',
          accent: '#c9a04e',
          crimson: '#8a2c38',
          gold: '#c9a04e',
          parchment: '#ece3d0'
        }
      },
      fontFamily: {
        serif: ['"IM Fell English"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      }
    },
  },
  plugins: [],
};
