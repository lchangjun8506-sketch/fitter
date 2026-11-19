/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0B0F',
        surface: '#15151C',
        raised: '#1E1E28',
        line: 'rgba(255,255,255,0.08)',
        lime: { DEFAULT: '#D4FF3A', dim: '#A8CC2E' },
        violet: { DEFAULT: '#8B7CFF' },
        coral: { DEFAULT: '#FF6B6B' },
        mute: '#8A8A99',
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '1.75rem' },
    },
  },
  plugins: [],
};
