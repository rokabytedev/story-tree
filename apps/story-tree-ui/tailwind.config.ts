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
        "surface-elevated": "var(--color-surface-elevated)",
        border: "var(--color-border)",
        highlight: "var(--color-highlight)",
        "accent-muted": "var(--color-accent-muted)",
        "text-primary": "var(--color-text-primary)",
        "text-muted": "var(--color-text-muted)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "var(--font-sans-stack)"],
        mono: ["var(--font-geist-mono)", "var(--font-mono-stack)"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(46, 37, 27, 0.12), 0 3px 6px rgba(108, 88, 76, 0.08)",
        "panel-hover": "0 4px 14px rgba(108, 88, 76, 0.12)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
