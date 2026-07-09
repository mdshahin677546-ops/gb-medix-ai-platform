import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GB Medix AI Platform",
  description:
    "AI wellness and TCM-inspired body type analysis for global body pattern insights.",
  keywords: [
    "what is my body type",
    "why am I always tired",
    "TCM body type test",
    "AI wellness analysis"
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
