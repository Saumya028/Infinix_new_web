/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0f766e",   // teal — swap for the real Infinix brand color
          dark: "#0b544e",
        },
      },
    },
  },
  plugins: [],
};
