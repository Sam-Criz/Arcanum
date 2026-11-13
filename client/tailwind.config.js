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
        archive: {
          slate: '#141716',     // Fundo principal ardósia profunda
          moss: '#1c201e',      // Superfície secundária musgo escuro
          parchment: '#252a27', // Cards e painéis papel envelhecido
          hairline: '#343b37',  // Linha divisória fina pedra úmida
          flax: '#ebe7de',      // Texto principal linho natural
          warmgray: '#9b9689',  // Texto secundário cinza cálido
          terracotta: '#c86d51',// Destaque primário cobre oxidado
          sage: '#6d9775',      // Destaque secundário verde sálvia
          rust: '#b84a48',      // Vida / perigo vermelho ferrugem
          deepblue: '#5b8299',  // Recursos / mana azul ardósia
        },
        arcanum: {
          tinta: '#141716',
          papel: '#1c201e',
          couro: '#252a27',
          osso: '#ebe7de',
          latao: '#c86d51',
          vinho: '#b84a48',
          vida: '#b84a48',
          mana: '#5b8299',
          cura: '#6d9775',
          condicao: '#8b7ca8',
          apoio: '#9b9689',
          borda: '#343b37'
        },
        rpg: {
          dark: '#141716',
          panel: '#1c201e',
          border: '#343b37',
          accent: '#c86d51',
          crimson: '#b84a48',
          gold: '#c86d51',
          parchment: '#ebe7de'
        }
      },
      fontFamily: {
        serif: ['"Fraunces"', 'Newsreader', 'Georgia', 'serif'],
        display: ['"Fraunces"', 'Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    },
  },
  plugins: [],
};
