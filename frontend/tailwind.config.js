/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080c10",
        surface: "#0f1419",
        border: "#1e2830",
        accent: "#00d4aa",
        "accent-dim": "#00d4aa33",
        warning: "#f59e0b",
        danger: "#ef4444",
        success: "#10b981",
        muted: "#4a5568",
        text: "#e2e8f0",
        "text-dim": "#718096",
      },
      fontFamily: {
        mono: ["'Fira Code'", "'JetBrains Mono'", "monospace"],
        display: ["'Space Mono'", "monospace"],
        body: ["'DM Sans'", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};
