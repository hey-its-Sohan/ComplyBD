/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12211c",
        forest: {
          50: "#f3f8f5",
          100: "#dcebe3",
          200: "#b7d4c5",
          500: "#2f7d5b",
          600: "#1f6b4c",
          700: "#18563d",
          800: "#134533",
          900: "#0e3326",
        },
        brass: {
          400: "#d4a853",
          500: "#c4922a",
        },
        clay: "#f6f1e8",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Bengali"', "system-ui", "sans-serif"],
        display: ['"Fraunces"', '"Noto Serif Bengali"', "Georgia", "serif"],
        bn: ['"Noto Sans Bengali"', '"Plus Jakarta Sans"', "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(18,33,28,0.04), 0 12px 32px -16px rgba(18,33,28,0.18)",
      },
    },
  },
  plugins: [],
};
