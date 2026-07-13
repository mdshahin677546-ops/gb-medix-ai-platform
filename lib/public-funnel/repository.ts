import type { RoundtableViewModel, RoundtableCardModel } from "./types";
import { canDisplayRoundtablePublicly, isCurrentValidRoundtable } from "./gate";
import { allDemoRoundtables, topRiskTier } from "./demo-data";

/**
 * Public roundtable data access. The source in this batch is the DEMO fixture set
 * (no Prisma model exists yet); every accessor applies the public display gate, so
 * blocked (unapproved/retracted) content is never returned for public rendering.
 * When a real published-roundtable data source ships, only this file changes.
 */

export type RoundtableSort = "popular" | "latest" | "updated" | "controversial" | "needs_attention" | "all";

export type RoundtableListFilters = {
  category?: string;
  sort?: RoundtableSort;
  query?: string;
};

export function toCardModel(vm: RoundtableViewModel): RoundtableCardModel {
  return {
    id: vm.id,
    slug: vm.slug,
    isDemo: vm.isDemo,
    title: vm.title,
    category: vm.category,
    coreQuestion: vm.coreQuestion,
    consensusSummary: vm.consensusSummary,
    disagreementCount: vm.disagreements.length,
    perspectiveCount: vm.perspectives.length,
    evidenceCount: vm.claims.length,
    reviewStatus: vm.reviewStatus,
    version: vm.version,
    updatedAt: vm.updatedAt,
    readingTimeMinutes: vm.readingTimeMinutes,
    topRiskTier: topRiskTier(vm.riskSignals)
  };
}

/** Publicly-viewable roundtables for a locale (gate applied), optionally filtered/sorted. */
export function listPublicRoundtables(locale: "en" | "zh", filters: RoundtableListFilters = {}): RoundtableCardModel[] {
  let rows = allDemoRoundtables(locale).filter(canDisplayRoundtablePublicly);

  if (filters.category && filters.category !== "all") {
    rows = rows.filter((r) => r.category === filters.category);
  }
  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim().toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.coreQuestion.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q));
  }

  const cards = rows.map(toCardModel);
  switch (filters.sort) {
    case "updated":
    case "latest":
      cards.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      break;
    case "controversial":
      cards.sort((a, b) => b.disagreementCount - a.disagreementCount);
      break;
    case "needs_attention":
      cards.sort((a, b) => (a.topRiskTier === "urgent" ? -1 : 1) - (b.topRiskTier === "urgent" ? -1 : 1));
      break;
    default:
      // "popular"/"all": stable by evidence + reading depth as a demo proxy.
      cards.sort((a, b) => b.evidenceCount - a.evidenceCount);
  }
  return cards;
}

/** A single publicly-viewable roundtable, or null if it does not exist or is blocked. */
export function getPublicRoundtable(locale: "en" | "zh", slug: string): RoundtableViewModel | null {
  const found = allDemoRoundtables(locale).find((r) => r.slug === slug);
  if (!found || !canDisplayRoundtablePublicly(found)) return null;
  return found;
}

/** Featured = current, fully-valid roundtables only (never caveated/blocked). */
export function listFeaturedRoundtables(locale: "en" | "zh", limit = 4): RoundtableCardModel[] {
  return allDemoRoundtables(locale)
    .filter(isCurrentValidRoundtable)
    .map(toCardModel)
    .slice(0, limit);
}

/** Slugs that may appear in a public sitemap (current, fully-valid only). */
export function publicSitemapSlugs(): string[] {
  return allDemoRoundtables("en").filter(isCurrentValidRoundtable).map((r) => r.slug);
}
