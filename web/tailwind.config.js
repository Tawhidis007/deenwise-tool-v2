/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--color-surface)",
        card: "var(--color-surface)",
        bg: "var(--color-bg)",
        accent: "var(--color-accent)",
        accent2: "var(--color-accent-2)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
      },
    },
  },
  plugins: [],
};

