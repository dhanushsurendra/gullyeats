export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#F97316', 50: '#fff4ea', 100: '#ffe6d0', 600: '#ea580c' },
        ink: '#1f2023',
        line: '#e7e7e4',
      },
      fontFamily: { sans: ['"Inter Tight"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
