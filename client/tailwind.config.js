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
          tinta:  '#131211',
          papel:  '#1a1816',
          couro:  '#2c2825',
          latao:  '#c9a04e',
          osso:   '#ece3d0',
          vinho:  '#b24a52',
          mana:   '#4a7a8a',
          cura:   '#5a7a5a',
          apoio:  '#8a8578',
          borda:  '#3a3530',
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
