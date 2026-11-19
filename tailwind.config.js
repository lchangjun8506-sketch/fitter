/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        card: v('card'),
        fill: v('fill'),
        elev: v('elev'),
        seg: v('seg'),
        elevcard: v('elevcard'),
        ink: v('ink'),
        sub: v('sub'),
        onink: v('onink'),
        up: v('up'),
        down: v('down'),
        sep: 'var(--sep)',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Pretendard Variable', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: { apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
    },
  },
  plugins: [],
};
