/**
 * GB MEDIX AI mobile theme base — independent brand system (not derived from any
 * reference product's brand, logo, colors, or assets).
 */
export const theme = {
  colors: {
    background: "#06111d",
    surface: "#0b1b2a",
    ink: "#e7f4ff",
    inkMuted: "#9fb4c8",
    leaf: "#19d3c5",
    mint: "#63f5d7",
    amber: "#ffd166",
    danger: "#ff6b6b"
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12, lg: 16 }
} as const;

export type Theme = typeof theme;
