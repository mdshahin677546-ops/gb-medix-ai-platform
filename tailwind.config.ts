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
        leaf: "#2f6f5e",
        clay: "#a8523a",
        mist: "#f4f7f5"
      }
    }
  },
  plugins: []
};

export default config;
