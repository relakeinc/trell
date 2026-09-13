import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        content: {
          default: "rgb(64 64 64)",
          emphasis: "rgb(23 23 23)",
          muted: "rgb(163 163 163)",
          subtle: "rgb(115 115 115)",
        },
        "bg-inverted": "rgb(0 0 0 / <alpha-value>)",
        canvas: "#ffffff",
        surface: "#ffffff",
        ink: "#171717",
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
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--primary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "12px",
        "2xl": "16px",
        card: "16px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": [
          "0.625rem",
          {
            lineHeight: "0.875rem",
          },
        ],
      },
      boxShadow: {
        "card-soft": "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
      },
      keyframes: {
        "fade-up": {
          from: {
            opacity: "0",
            transform: "translateY(8px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
      },
    },
    keyframes: {
      typing: {
        "0%, 100%": {
          transform: "translateY(0)",
          opacity: "0.5",
        },
        "50%": {
          transform: "translateY(-2px)",
          opacity: "1",
        },
      },
      "loading-dots": {
        "0%, 100%": {
          opacity: "0",
        },
        "50%": {
          opacity: "1",
        },
      },
      wave: {
        "0%, 100%": {
          transform: "scaleY(1)",
        },
        "50%": {
          transform: "scaleY(0.6)",
        },
      },
      blink: {
        "0%, 100%": {
          opacity: "1",
        },
        "50%": {
          opacity: "0",
        },
      },
    },
    "text-blink": {
      "0%, 100%": {
        color: "var(--primary)",
      },
      "50%": {
        color: "var(--muted-foreground)",
      },
    },
    "bounce-dots": {
      "0%, 100%": {
        transform: "scale(0.8)",
        opacity: "0.5",
      },
      "50%": {
        transform: "scale(1.2)",
        opacity: "1",
      },
    },
    "thin-pulse": {
      "0%, 100%": {
        transform: "scale(0.95)",
        opacity: "0.8",
      },
      "50%": {
        transform: "scale(1.05)",
        opacity: "0.4",
      },
    },
    "pulse-dot": {
      "0%, 100%": {
        transform: "scale(1)",
        opacity: "0.8",
      },
      "50%": {
        transform: "scale(1.5)",
        opacity: "1",
      },
    },
    "shimmer-text": {
      "0%": {
        backgroundPosition: "150% center",
      },
      "100%": {
        backgroundPosition: "-150% center",
      },
    },
    "wave-bars": {
      "0%, 100%": {
        transform: "scaleY(1)",
        opacity: "0.5",
      },
      "50%": {
        transform: "scaleY(0.6)",
        opacity: "1",
      },
    },
    shimmer: {
      "0%": {
        backgroundPosition: "200% 50%",
      },
      "100%": {
        backgroundPosition: "-200% 50%",
      },
    },
    "spinner-fade": {
      "0%": {
        opacity: "0",
      },
      "100%": {
        opacity: "1",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
