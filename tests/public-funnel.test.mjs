// GB MEDIX AI — Roundtable UI Batch 1: public growth-funnel tests.
//
// Executes the REAL public-funnel library: the actual TS sources (types/gate/
// demo-data/repository/analytics/i18n) are compiled with the project tsc into a
// git-ignored temp dir (CommonJS) and required — no source-string mirrors of the
// logic. The public display gate (the medical-safety authority) and funnel
// invariants are asserted against real behavior. Component/page structure that
// cannot be safely rendered outside a Next.js request (client hooks, path alias
// value imports) is covered by supplementary source guards.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const cwd = process.cwd();
const LIB = join(cwd, "lib", "public-funnel");
const files = ["types.ts", "gate.ts", "demo-data.ts", "repository.ts", "analytics.ts", "i18n.ts"].map((f) => join(LIB, f));

mkdirSync(join(cwd, ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(cwd, ".tmp", "funnel-"));
const requireCjs = createRequire(import.meta.url);
// Compile with a generated tsconfig so the project's "@/*" path alias resolves
// (i18n.ts has an `import type { Lang } from "@/lib/lang"`). rootDir=cwd keeps the
// emitted tree under <outDir>/lib/public-funnel/*.js.
const tsconfigPath = join(outDir, "tsconfig.json");
writeFileSync(tsconfigPath, JSON.stringify({
  compilerOptions: {
    outDir, rootDir: cwd, baseUrl: cwd, paths: { "@/*": ["*"] },
    jsx: "react-jsx", module: "commonjs", target: "es2020", moduleResolution: "node",
    esModuleInterop: true, skipLibCheck: true, noEmitOnError: true
  },
  files
}));
try {
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", tsconfigPath], { stdio: "pipe" });
} catch (error) {
  rmSync(outDir, { recursive: true, force: true });
  throw new Error("tsc compile of lib/public-funnel failed:\n" + (error.stdout || error.message));
}
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const emitted = resolve(outDir, "lib", "public-funnel");
const gate = requireCjs(join(emitted, "gate.js"));
const repo = requireCjs(join(emitted, "repository.js"));
const demo = requireCjs(join(emitted, "demo-data.js"));
const i18n = requireCjs(join(emitted, "i18n.js"));
const analytics = requireCjs(join(emitted, "analytics.js"));

const HARD_BLOCKED = ["draft", "review_required", "in_medical_review", "changes_requested", "retracted"];
const FULLY_PUBLIC = ["approved", "published"];
const CAVEATED = ["update_required", "archived"];

// ---------- P1: publication gate is the safety authority ----------
test("P1 gate: unapproved/in-review/retracted are BLOCKED from public display", () => {
  for (const s of HARD_BLOCKED) {
    assert.equal(gate.roundtableVisibility(s), "blocked", `${s} must be blocked`);
    assert.equal(gate.canDisplayRoundtablePublicly({ reviewStatus: s }), false, `${s} must not be publicly displayable`);
    assert.equal(gate.isCurrentValidRoundtable({ reviewStatus: s }), false);
  }
});

test("P1 gate: approved/published are fully public; update_required/archived are caveated", () => {
  for (const s of FULLY_PUBLIC) {
    assert.equal(gate.roundtableVisibility(s), "full");
    assert.equal(gate.publicStatusPresentation(s).showCaveat, false);
    assert.equal(gate.isCurrentValidRoundtable({ reviewStatus: s }), true);
  }
  for (const s of CAVEATED) {
    assert.equal(gate.roundtableVisibility(s), "caveated");
    assert.equal(gate.canDisplayRoundtablePublicly({ reviewStatus: s }), true);
    assert.equal(gate.publicStatusPresentation(s).showCaveat, true, `${s} must show a caveat`);
    assert.equal(gate.isCurrentValidRoundtable({ reviewStatus: s }), false, `${s} is not 'current valid'`);
  }
});

// ---------- P1: repository applies the gate ----------
for (const locale of ["en", "zh"]) {
  test(`P1 repo(${locale}): listing never contains a blocked/retracted roundtable`, () => {
    const cards = repo.listPublicRoundtables(locale, {});
    assert.ok(cards.length >= 2, "demo set should expose at least 2 displayable roundtables");
    for (const c of cards) {
      assert.equal(HARD_BLOCKED.includes(c.reviewStatus), false, `blocked status leaked: ${c.slug}`);
      assert.equal(c.isDemo, true, "every public card must be flagged demo");
    }
    // the retracted fixture is never listed
    assert.equal(cards.some((c) => c.slug === "retracted-example"), false);
  });

  test(`P1 repo(${locale}): getPublicRoundtable blocks retracted, allows caveated`, () => {
    assert.equal(repo.getPublicRoundtable(locale, "retracted-example"), null, "retracted must not be viewable");
    assert.equal(repo.getPublicRoundtable(locale, "does-not-exist"), null);
    const upd = repo.getPublicRoundtable(locale, "childhood-fever-basics");
    assert.ok(upd, "update_required fixture must still be viewable (with caveat)");
    assert.equal(gate.publicStatusPresentation(upd.reviewStatus).showCaveat, true);
    assert.equal(upd.isDemo, true);
  });

  test(`P1 repo(${locale}): featured & sitemap expose only current-valid content`, () => {
    const featured = repo.listFeaturedRoundtables(locale, 10);
    for (const f of featured) assert.equal(FULLY_PUBLIC.includes(f.reviewStatus), true, `featured must be current-valid: ${f.slug}`);
    assert.equal(featured.some((f) => f.slug === "childhood-fever-basics"), false, "caveated not featured");
    assert.equal(featured.some((f) => f.slug === "retracted-example"), false);
  });
}

test("P1 sitemap slugs exclude retracted and caveated (update_required)", () => {
  const slugs = repo.publicSitemapSlugs();
  assert.equal(slugs.includes("retracted-example"), false);
  assert.equal(slugs.includes("childhood-fever-basics"), false);
  assert.ok(slugs.includes("adult-sleep-quality"));
});

// ---------- card counts are real (never fabricated) ----------
test("card counts equal the underlying array lengths (no fabricated numbers)", () => {
  const vm = repo.getPublicRoundtable("en", "adult-sleep-quality");
  const card = repo.toCardModel(vm);
  assert.equal(card.disagreementCount, vm.disagreements.length);
  assert.equal(card.perspectiveCount, vm.perspectives.length);
  assert.equal(card.evidenceCount, vm.claims.length);
});

// ---------- search & filter ----------
test("search filters by query; no-match returns empty (drives No-Results state)", () => {
  const none = repo.listPublicRoundtables("en", { query: "zzzzz-nonexistent-topic" });
  assert.equal(none.length, 0);
  const hit = repo.listPublicRoundtables("en", { query: "sleep" });
  assert.ok(hit.length >= 1);
});

// ---------- i18n ----------
test("i18n resolves zh dict and falls back to en for other locales", () => {
  assert.equal(i18n.getFunnelCopy("zh").nav.roundtable, "医学圆桌");
  assert.equal(i18n.getFunnelCopy("en").nav.roundtable, "Medical Roundtable");
  assert.equal(i18n.getFunnelCopy("fr").nav.roundtable, "Medical Roundtable"); // fallback
  assert.equal(i18n.funnelLocale("zh"), "zh");
  assert.equal(i18n.funnelLocale("fr"), "en");
});

// ---------- analytics adapter: allowlist only, no PII/free-text ----------
test("analytics emitter never leaks non-allowlisted keys (no symptom text/PII)", () => {
  const captured = [];
  globalThis.window = { __gbFunnelSink: (name, props) => captured.push([name, props]) };
  analytics.emitFunnelEvent("roundtable_to_consult_click", {
    slug: "adult-sleep-quality", category: "sleep_mood", locale: "en",
    // hostile extras that must be stripped:
    symptomText: "chest pain since 3am", token: "secret", email: "a@b.com"
  });
  delete globalThis.window;
  assert.equal(captured.length, 1);
  const props = captured[0][1];
  assert.equal(props.slug, "adult-sleep-quality");
  assert.equal("symptomText" in props, false);
  assert.equal("token" in props, false);
  assert.equal("email" in props, false);
});

// ---------- no-fabrication guard on demo content ----------
test("demo content is flagged demo and makes no fabricated medical claims", () => {
  const collect = (v, out = []) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
    else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
    return out;
  };
  for (const locale of ["en", "zh"]) {
    const vms = demo.allDemoRoundtables(locale);
    for (const vm of vms) assert.equal(vm.isDemo, true, `${vm.slug} must be demo`);
    const strings = collect(vms.map((v) => ({ ...v, reviewStatus: undefined })));
    const banned = /治愈率|治愈|100%\s*有效|保证疗效|cure rate|guaranteed cure|主任医师|三甲医院背书/i;
    for (const s of strings) assert.equal(banned.test(s), false, `fabricated medical claim: ${s}`);
  }
});

// ---------- supplementary SOURCE guards on components/pages ----------
const read = (p) => readFileSync(join(cwd, p), "utf8");

test("public nav excludes supply chain / RFQ / merchant", () => {
  const header = read("components/public/SiteHeader.tsx");
  for (const bad of ["/rfq", "supply", "merchant", "供应链"]) {
    assert.equal(header.includes(bad), false, `public header must not link ${bad}`);
  }
  for (const good of ["/roundtable", "/ai-consult", "/services", "/knowledge", "/products", "/consult"]) {
    assert.ok(header.includes(good), `public header should link ${good}`);
  }
});

test("home page: roundtable hero precedes services which precede products; primary consult CTA present", () => {
  const home = read("app/[lang]/page.tsx");
  const iHero = home.indexOf('id="featured"');
  const iServices = home.indexOf('id="services"');
  const iProducts = home.indexOf('id="products"');
  assert.ok(iHero > 0 && iServices > iHero && iProducts > iServices, "order must be roundtable → services → products");
  assert.ok(home.includes("/consult"), "home must route to the real consult entry");
});

test("detail page: has all mandated sections; products after services; risk section has no product CTA; consult CTA mid+end", () => {
  const d = read("app/[lang]/roundtable/[slug]/page.tsx");
  for (const id of ["one-minute", "background", "perspectives", "consensus", "disagreements", "claims", "risk", "actions", "version", "related"]) {
    assert.ok(d.includes(`id="${id}"`), `detail must contain section ${id}`);
  }
  // services block appears before products block
  assert.ok(d.indexOf("relatedServices") < d.indexOf("relatedProducts"), "services must precede products");
  // exactly one mid CTA (ctaMid) and one end CTA (ctaEnd)
  assert.equal(d.split("detail.ctaMid").length - 1, 1, "exactly one mid-body consult CTA");
  assert.equal(d.split("detail.ctaEnd").length - 1, 1, "exactly one end-of-body consult CTA");
  // the risk section must not contain a product/shop CTA between id="risk" and id="actions"
  const riskBlock = d.slice(d.indexOf('id="risk"'), d.indexOf('id="actions"'));
  assert.equal(/products|\/shop/.test(riskBlock), false, "risk section must not contain a product purchase CTA");
});

test("consult CTA component targets the real /consult route", () => {
  const rt = read("components/public/roundtable.tsx");
  assert.ok(/href=\{`\/\$\{lang\}\/consult`\}/.test(rt), "ConsultationCTA must point at /{lang}/consult");
});
