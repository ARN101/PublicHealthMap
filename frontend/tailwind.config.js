/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f5c4c',
          dark: '#0a4539',
          soft: '#e8f3ef',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'sans-serif'],
        display: ['"IBM Plex Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
