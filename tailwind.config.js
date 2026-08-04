/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        sprout: "rgb(var(--sprout) / <alpha-value>)",
        flare: "rgb(var(--flare) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["DM Serif Display", "Georgia", "serif"]
      },
      boxShadow: {
        card: "0 28px 70px rgb(var(--shadow) / .42), 0 4px 16px rgb(var(--shadow) / .2)",
        soft: "0 12px 40px rgb(var(--shadow) / .28)"
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
