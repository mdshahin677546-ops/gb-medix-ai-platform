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
        ink: "#e7f4ff",
        night: "#06111d",
        leaf: "#19d3c5",
        mint: "#63f5d7",
        clay: "#ff6b6b",
        amber: "#ffd166",
        mist: "#0b1b2a",
        pearl: "#f6fbff"
      }
    }
  },
  plugins: []
};

export default config;
