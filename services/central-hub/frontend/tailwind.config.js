/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial de Desarrollo y Diseño
        primary: '#75A4DB',      // Celeste DyD
        secondary: '#537A41',    // Celeste oscuro
        success: '#488A44',      // Verde DyD
        warning: '#FFE824',      // Amarillo DyD
        danger: '#D65100',       // Naranja DyD
        dark: '#110402',         // Negro rojizo DyD
        'dyd-blue': '#75A4DB',
        'dyd-green': '#488A44',
        'dyd-yellow': '#FFE824',
        'dyd-orange': '#D65100',
      },
    },
  },
  plugins: [],
}
