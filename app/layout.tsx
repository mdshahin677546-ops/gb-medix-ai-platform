import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gbmedix.ai";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "GB Medix AI | AI Health Management Platform",
    template: "%s | GB Medix AI"
  },
  description:
    "AI health assessment, TCM-inspired constitution insights, and personalized wellness guidance for global health management.",
  keywords: [
    "AI health assessment",
    "AI health management",
    "TCM body type test",
    "TCM constitution analysis",
    "personalized wellness plan",
    "AI wellness report",
    "health score"
  ],
  applicationName: "GB Medix AI",
  authors: [{ name: "GB Medix AI" }],
  creator: "GB Medix AI",
  publisher: "GB Medix AI",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "GB Medix AI",
    title: "GB Medix AI | AI Health Management Platform",
    description:
      "Start a free AI health assessment and unlock personalized wellness guidance with GB Medix AI.",
    images: [
      {
        url: "/assets/medical-body-scan.png",
        width: 1200,
        height: 630,
        alt: "GB Medix AI health assessment visualization"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "GB Medix AI | AI Health Management Platform",
    description:
      "Free AI health assessment with optional Premium health management report.",
    images: ["/assets/medical-body-scan.png"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
