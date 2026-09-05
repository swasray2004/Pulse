import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050608",
          900: "#0A0C10",
          850: "#0E1116",
          800: "#12151C",
          700: "#1A1E27",
          600: "#262B37",
        },
        signal: {
          400: "#7C8CFF",
          500: "#5B6EF5",
          600: "#4A5CE0",
        },
        pulse: {
          400: "#3DF0B8",
          500: "#0BE39F",
          600: "#00C787",
        },
        amber: {
          400: "#FFB454",
          500: "#FF9B2E",
        },
        rose: {
          400: "#FF6B81",
          500: "#F5486A",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "pulse-gradient":
          "linear-gradient(135deg, #5B6EF5 0%, #4A5CE0 35%, #0BE39F 100%)",
        "pulse-radial":
          "radial-gradient(circle at 20% 20%, rgba(91,110,245,0.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(11,227,159,0.20), transparent 45%)",
        grain: "url('/noise.png')",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(91,110,245,0.45)",
        "glow-pulse": "0 0 40px -8px rgba(11,227,159,0.45)",
        glass: "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      keyframes: {
        ripple: {
          "0%": { transform: "scale(0.6)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "pulse-node": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        ripple: "ripple 1.6s cubic-bezier(0.2,0.6,0.3,1) infinite",
        "pulse-node": "pulse-node 2.4s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
