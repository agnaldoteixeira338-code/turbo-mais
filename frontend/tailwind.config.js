/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta inspirada no roxo do Nubank (#820AD1)
        roxo: {
          50: '#f7efff',
          100: '#eedcfd',
          200: '#ddb9fb',
          300: '#c58bf7',
          400: '#a855f0',
          500: '#9327e6',
          600: '#820ad1',
          700: '#6b06ad',
          800: '#56078a',
          900: '#3f0566',
        },
        superficie: {
          DEFAULT: '#f5f3f7',
          escura: '#0f0d13',
          card: '#ffffff',
          'card-escuro': '#1b1822',
        },
        alta: '#0e9f6e',
        baixa: '#e02424',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 12, 34, 0.04), 0 8px 24px rgba(17, 12, 34, 0.06)',
      },
      keyframes: {
        entrar: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: { entrar: 'entrar .25s ease-out both' },
    },
  },
  plugins: [],
};
