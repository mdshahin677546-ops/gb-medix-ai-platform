import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1e2528",
        night: "#101615",
        leaf: "#2f6f5e",
        mint: "#9fe6c1",
        clay: "#a8523a",
        amber: "#e7b363",
        mist: "#f4f7f5",
        pearl: "#fbfaf6"
      }
    }
  },
  plugins: []
};

export default config;
