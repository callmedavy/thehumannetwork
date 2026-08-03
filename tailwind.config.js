/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        sprout: "#78B889",
        flare: "#D47C70"
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["DM Serif Display", "Georgia", "serif"]
      },
      boxShadow: {
        card: "0 28px 70px rgba(1, 13, 9, .42), 0 4px 16px rgba(1, 13, 9, .2)",
        soft: "0 12px 40px rgba(1, 13, 9, .28)"
      },
      borderRadius: {
        card: "1.5rem",
        button: "1rem",
        chip: ".75rem"
      }
    }
  },
  plugins: []
};
