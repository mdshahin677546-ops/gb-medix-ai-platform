import type { RoundtablePublicationStatus, RoundtableViewModel, RoundtableCardModel } from "./types";

/**
 * Public display gate — the SINGLE authority for what may appear on public pages.
 *
 * Unapproved or retracted content is NEVER shown as a valid medical conclusion.
 * `update_required` and `archived` MAY be shown but ONLY with a conspicuous status
 * (see `publicStatusPresentation`), never disguised as the latest valid content.
 */

/** Statuses that must NEVER be publicly visible. */
const HARD_BLOCKED: ReadonlySet<RoundtablePublicationStatus> = new Set([
  "draft",
  "review_required",
  "in_medical_review",
  "changes_requested",
  "retracted"
]);

/** Statuses that render, but as "current valid" content. */
const FULLY_PUBLIC: ReadonlySet<RoundtablePublicationStatus> = new Set([
  "approved",
  "published"
]);

/** Statuses that render only with a prominent caveat state. */
const CAVEATED_PUBLIC: ReadonlySet<RoundtablePublicationStatus> = new Set([
  "update_required",
  "archived"
]);

export type PublicVisibility = "full" | "caveated" | "blocked";

export function roundtableVisibility(status: RoundtablePublicationStatus): PublicVisibility {
  if (HARD_BLOCKED.has(status)) return "blocked";
  if (FULLY_PUBLIC.has(status)) return "full";
  if (CAVEATED_PUBLIC.has(status)) return "caveated";
  return "blocked";
}

/** True only when the roundtable may appear in public listings/detail at all. */
export function canDisplayRoundtablePublicly(
  rt: Pick<RoundtableViewModel | RoundtableCardModel, "reviewStatus">
): boolean {
  return roundtableVisibility(rt.reviewStatus) !== "blocked";
}

/** True only for "current, valid medical content" (indexing, featured slots). */
export function isCurrentValidRoundtable(
  rt: Pick<RoundtableViewModel | RoundtableCardModel, "reviewStatus">
): boolean {
  return roundtableVisibility(rt.reviewStatus) === "full";
}

export type StatusPresentation = {
  /** i18n key for a short, human-readable status label. */
  labelKey: string;
  /** Semantic status color token (see tailwind + globals). */
  tone: "success" | "review" | "attention" | "critical" | "info";
  /** Whether a caveat banner must be rendered above the content. */
  showCaveat: boolean;
};

export function publicStatusPresentation(status: RoundtablePublicationStatus): StatusPresentation {
  switch (status) {
    case "approved":
    case "published":
      return { labelKey: "status.reviewed", tone: "success", showCaveat: false };
    case "update_required":
      return { labelKey: "status.updateRequired", tone: "attention", showCaveat: true };
    case "archived":
      return { labelKey: "status.archived", tone: "info", showCaveat: true };
    default:
      // Blocked statuses should never reach a rendered page; caveat as a safety net.
      return { labelKey: "status.unavailable", tone: "critical", showCaveat: true };
  }
}
