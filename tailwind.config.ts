import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#047857",
          "primary-dark": "#065F46",
        },
        background: "#F8FAFC",
        text: {
          primary: "#1E293B",
          secondary: "#64748B",
        },
      },
      fontFamily: {
        sans: ["var(--font-tajawal)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
