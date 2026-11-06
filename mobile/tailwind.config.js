/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Night-sky palette (the default look) – deep blues with a mint accent.
        night: { 950: "#050d2b", 900: "#081a4f", 800: "#0d2a7a", 700: "#123a9c", card: "#0f2a6e", soft: "#17398f" },
        mint: { 300: "#7af5c9", 400: "#3ee9a8", 500: "#1dd49a" },
      },
      boxShadow: { glow: "0 0 24px rgba(62, 233, 168, 0.35)" },
    },
  },
  plugins: [],
};
