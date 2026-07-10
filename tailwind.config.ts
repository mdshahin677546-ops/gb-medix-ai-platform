import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

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
        mist: "#0b1b2a"
      },
      fontFamily: {
        sans: [
          "var(--font-body)",
          "PingFang SC",
          "Microsoft YaHei",
          ...defaultTheme.fontFamily.sans
        ],
        display: [
          "var(--font-display)",
          "PingFang SC",
          "Microsoft YaHei",
          ...defaultTheme.fontFamily.sans
        ],
        mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono]
      }
    }
  },
  plugins: []
};

export default config;
