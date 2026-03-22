import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        input: "var(--bg-input)",
        "border-default": "var(--border-default)",
        "border-light": "var(--border-light)",
        "border-focus": "var(--border-focus)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-placeholder": "var(--text-placeholder)",
        "text-muted": "var(--text-muted)",
        "accent-pink": "var(--accent-pink)",
        "accent-pink-bg": "var(--accent-pink-bg)",
        "accent-pink-subtle": "var(--accent-pink-subtle)",
        "accent-pink-border": "var(--accent-pink-border)",
        "accent-pink-border-strong": "var(--accent-pink-border-strong)",
        "accent-blue": "var(--accent-blue)",
        "accent-blue-hover": "var(--accent-blue-hover)",
        "accent-blue-bg": "var(--accent-blue-bg)",
        "accent-blue-border": "var(--accent-blue-border)",
        "accent-blue-border-strong": "var(--accent-blue-border-strong)",
        "accent-green": "var(--accent-green)",
        "accent-green-hover": "var(--accent-green-hover)",
        "accent-green-bg": "var(--accent-green-bg)",
        "accent-green-text": "var(--accent-green-text)",
        disconnected: "var(--bg-disconnected)",
      },
      spacing: {
        page: "var(--space-page)",
        section: "var(--space-section)",
      },
      borderRadius: {
        hero: "var(--radius-hero)",
        card: "var(--radius-card)",
        input: "var(--radius-input)",
        button: "var(--radius-button)",
        chip: "var(--radius-chip)",
        badge: "var(--radius-badge)",
        logo: "var(--radius-logo)",
      },
    },
  },
  plugins: [],
};

export default config;
