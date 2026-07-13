import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://gb-medix-ai.example.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep internal/authenticated app surfaces out of the public index.
      disallow: [
        "/*/dashboard",
        "/*/account",
        "/*/checkout",
        "/*/success",
        "/*/rfq",
        "/*/assistant",
        "/merchant"
      ]
    },
    sitemap: `${BASE}/sitemap.xml`
  };
}
