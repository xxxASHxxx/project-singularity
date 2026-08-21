/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0A0A0B',
        panel: '#141416',
        border: '#262626',
        'red-accent': '#FF3B30',
        'red-dim': '#B3261E',
        'amber-accent': '#FF8A00',
        'amber-dim': '#C4600A',
        'green-accent': '#22C55E',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
