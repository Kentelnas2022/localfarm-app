/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        farm: {
          50: '#f4f9f1',
          100: '#e5f2df',
          500: '#68a554',
          600: '#558b43',
          700: '#436d35',
        },
      },
    },
  },
  plugins: [],
};
