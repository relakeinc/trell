import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dub-style tokens
        content: {
          default: "rgb(64 64 64)", // neutral-700
          emphasis: "rgb(23 23 23)", // neutral-900
          muted: "rgb(163 163 163)", // neutral-400
          subtle: "rgb(115 115 115)", // neutral-500
        },
        "bg-inverted": "rgb(0 0 0 / <alpha-value>)",
        // Orbit-style auth tokens
        canvas: "#ffffff",
        surface: "#ffffff",
        ink: "#171717",
        // Trell legacy tokens
        trell: {
          bg: "#f5f5f5",
          "bg-subtle": "#f5f5f5",
          muted: "#737373",
          "muted-bg": "#f5f5f5",
          card: "#ffffff",
          line: "#e5e5e5",
          "line-default": "#e5e5e5",
          "line-emphasis": "#a3a3a3",
          ink: "#171717",
          "ink-default": "#404040",
          "ink-subtle": "#737373",
          "ink-muted": "#a3a3a3",
          accent: "#171717",
          blue: "#2563eb",
          "blue-light": "#dbeafe",
          green: "#16a34a",
          "green-light": "#dcfcf1",
          red: "#dc2626",
          "red-light": "#fee2e2",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        card: "16px",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        "card-soft": "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
