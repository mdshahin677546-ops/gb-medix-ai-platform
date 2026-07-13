import type { MetadataRoute } from "next";
import { publicSitemapSlugs } from "@/lib/public-funnel/repository";

// Absolute base is required by Next for sitemap entries. Driven by env so no host is
// hard-coded; the example.com fallback is an obvious placeholder for local/dev.
const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://gb-medix-ai.example.com").replace(/\/$/, "");
const LOCALES = ["en", "zh"] as const;
const STATIC_PATHS = ["", "/roundtable", "/ai-consult", "/services", "/knowledge", "/products"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const lang of LOCALES) {
    for (const p of STATIC_PATHS) {
      entries.push({ url: `${BASE}/${lang}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 });
    }
    // Only current, fully-valid roundtables — never unapproved/retracted/caveated.
    for (const slug of publicSitemapSlugs()) {
      entries.push({ url: `${BASE}/${lang}/roundtable/${slug}`, changeFrequency: "monthly", priority: 0.6 });
    }
  }
  return entries;
}
