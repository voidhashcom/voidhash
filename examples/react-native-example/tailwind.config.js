/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,tsx}", "./components/**/*.{js,ts,tsx}"],

  plugins: [],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
};
