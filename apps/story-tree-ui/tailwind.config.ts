import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--color-page)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        border: "var(--color-border)",
        highlight: "var(--color-highlight)",
        "text-primary": "var(--color-text-primary)",
        "text-muted": "var(--color-text-muted)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "var(--font-sans-stack)"],
        mono: ["var(--font-geist-mono)", "var(--font-mono-stack)"],
      },
      boxShadow: {
        panel: "0 16px 40px rgba(8, 15, 35, 0.45)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
