/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0f1119",
        bg: "#0b0c10",
        accent: "#3dd598",
        accent2: "#7dd3fc",
        border: "#1f2533",
        text: "#e8ecf3",
        muted: "#9ea5b4",
      },
    },
  },
  plugins: [],
};
