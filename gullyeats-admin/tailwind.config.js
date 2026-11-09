export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The apps' orange, with GullyPlay's night purple as the second colour.
        brand: { DEFAULT: '#FE5200', 50: '#fff1ea', 100: '#ffe0cf', 300: '#ff9a66', 600: '#e04800' },
        night: { DEFAULT: '#1a0f45', deep: '#0b1230', soft: '#2a0f45' },
        lilac: '#a78bfa',
        ink: '#16131f',
        line: '#ebe9f1',
        canvas: '#f6f5fa',
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', '"Inter Tight"', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(26, 15, 69, 0.04), 0 8px 24px -8px rgba(26, 15, 69, 0.10)',
        float: '0 18px 40px -12px rgba(26, 15, 69, 0.28)',
        glow: '0 8px 20px -6px rgba(254, 82, 0, 0.55)',
      },
    },
  },
  plugins: [],
}
