// GB MEDIX AI — Roundtable UI Batch 1.1: safe conversion-context tests.
//
// Executes the REAL implementation: the actual TS sources (consult-context,
// locale-path, i18n) are compiled with the project tsc (path alias resolved) into a
// git-ignored temp dir and required. Every assertion runs against real function
// behavior — no source-string scraping, no mirrored logic.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const cwd = process.cwd();
const LIB = join(cwd, "lib", "public-funnel");
const files = ["types.ts", "i18n.ts", "consult-context.ts", "locale-path.ts"].map((f) => join(LIB, f));

mkdirSync(join(cwd, ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(cwd, ".tmp", "conv-"));
const requireCjs = createRequire(import.meta.url);
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
  throw new Error("tsc compile of conversion-context libs failed:\n" + (error.stdout || error.message));
}
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const emitted = resolve(outDir, "lib", "public-funnel");
const cc = requireCjs(join(emitted, "consult-context.js"));
const lp = requireCjs(join(emitted, "locale-path.js"));
const i18n = requireCjs(join(emitted, "i18n.js"));

const SENSITIVE = {
  symptomText: "chest pain since 3am", symptom: "cough", freeText: "long note",
  email: "a@b.com", phone: "+15551234567", mobile: "13800000000",
  token: "secret-token", cookie: "sid=abc", authorization: "Bearer xyz",
  mrn: "MRN-99", patientName: "Jane Doe", dob: "1990-01-01", ssn: "123-45-6789", note: "private"
};

// ---------- sanitizeConsultParams: allowlist only ----------
test("sanitizeConsultParams keeps allowlist, drops every sensitive key", () => {
  const out = cc.sanitizeConsultParams({ source: "roundtable_card", topic: "sleep_mood", context: "education", ...SENSITIVE });
  assert.deepEqual(out, { source: "roundtable_card", topic: "sleep_mood", context: "education" });
  for (const k of Object.keys(SENSITIVE)) assert.equal(k in out, false, `sensitive key leaked: ${k}`);
});

test("sanitizeConsultParams: context may only be the education marker", () => {
  assert.equal(cc.sanitizeConsultParams({ context: "malware" }).context, undefined);
  assert.equal(cc.sanitizeConsultParams({ context: "individual_diagnosis" }).context, undefined);
  assert.equal(cc.sanitizeConsultParams({ context: cc.CONSULT_CONTEXT_MARKER }).context, "education");
});

test("sanitizeConsultParams: rejects malformed source/topic and non-strings", () => {
  assert.equal(cc.sanitizeConsultParams({ source: "has space" }).source, undefined);
  assert.equal(cc.sanitizeConsultParams({ source: "UPPER" }).source, undefined);
  assert.equal(cc.sanitizeConsultParams({ source: "a".repeat(41) }).source, undefined);
  assert.equal(cc.sanitizeConsultParams({ topic: "<script>" }).topic, undefined);
  assert.equal(cc.sanitizeConsultParams({ source: 123, topic: { x: 1 } }).source, undefined);
  assert.equal(cc.sanitizeConsultParams({ topic: "chronic-2" }).topic, "chronic-2");
});

// ---------- buildConsultHref: safe URL only ----------
test("buildConsultHref emits only allowlisted params and always the education marker", () => {
  const href = cc.buildConsultHref("en", { source: "roundtable_card", topic: "chronic", ...SENSITIVE, context: "malware" });
  assert.ok(href.startsWith("/en/consult?"), `unexpected path: ${href}`);
  const url = new URL(href, "http://x");
  const keys = [...url.searchParams.keys()].sort();
  assert.deepEqual(keys, ["context", "source", "topic"]);
  assert.equal(url.searchParams.get("context"), "education");
  assert.equal(url.searchParams.get("source"), "roundtable_card");
  assert.equal(url.searchParams.get("topic"), "chronic");
  for (const k of Object.keys(SENSITIVE)) assert.equal(url.searchParams.has(k), false, `sensitive key in URL: ${k}`);
});

test("buildConsultHref attaches education marker even with no params, and honors locale", () => {
  const href = cc.buildConsultHref("zh");
  assert.equal(href, "/zh/consult?context=education");
});

// ---------- swapLocaleInPath: locale swap + route-aware query safety ----------
test("swapLocaleInPath swaps only the locale segment; roundtable filters preserved", () => {
  assert.equal(
    lp.swapLocaleInPath("/en/roundtable", "?query=sleep&sort=latest&category=chronic", "zh"),
    "/zh/roundtable?query=sleep&sort=latest&category=chronic"
  );
  assert.equal(lp.swapLocaleInPath("/en", "", "zh"), "/zh");
  assert.equal(lp.swapLocaleInPath("/zh/roundtable/adult-sleep-quality", "", "en"), "/en/roundtable/adult-sleep-quality");
  // search without a leading "?" is normalized
  assert.equal(lp.swapLocaleInPath("/en/roundtable", "query=sleep", "zh"), "/zh/roundtable?query=sleep");
  // empty "?" is treated as no query
  assert.equal(lp.swapLocaleInPath("/en/services", "?", "zh"), "/zh/services");
});

test("swapLocaleInPath drops query on non-roundtable/non-consult routes (safe default)", () => {
  // home / products / services carry no preserved query state
  assert.equal(lp.swapLocaleInPath("/zh", "?query=x", "en"), "/en");
  assert.equal(lp.swapLocaleInPath("/en/products", "?sort=popular&email=a%40b.com", "zh"), "/zh/products");
  assert.equal(lp.swapLocaleInPath("/en/services", "?ref=x", "zh"), "/zh/services");
});

test("swapLocaleInPath: roundtable route keeps ONLY safe filters, drops PHI mixed in", () => {
  const out = lp.swapLocaleInPath(
    "/en/roundtable",
    "?query=sleep&category=chronic&sort=latest&email=a%40b.com&token=secret&symptom=cough&prompt=full",
    "zh"
  );
  assert.equal(out, "/zh/roundtable?query=sleep&category=chronic&sort=latest");
  const url = new URL(out, "http://x");
  for (const bad of ["email", "token", "symptom", "prompt"]) assert.equal(url.searchParams.has(bad), false, `leaked ${bad}`);
});

const PHI = ["email", "phone", "mobile", "token", "cookie", "authorization", "auth", "symptom", "symptomText", "freeText", "prompt", "patientName", "dob", "ssn", "mrn", "note"];

test("swapLocaleInPath: /consult drops all PHI/unsafe query, keeps only consult allowlist", () => {
  // Codex-reported bad case: PHI must NOT survive the locale switch on /consult.
  const out = lp.swapLocaleInPath(
    "/en/consult",
    "?context=education&email=a%40b.com&token=secret&symptom=chest+pain",
    "zh"
  );
  const url = new URL(out, "http://x");
  assert.equal(url.pathname, "/zh/consult");
  assert.equal(url.searchParams.get("context"), "education");
  for (const bad of PHI) assert.equal(url.searchParams.has(bad), false, `PHI leaked on /consult: ${bad}`);

  // safe source/topic/context survive when valid
  const safe = lp.swapLocaleInPath(
    "/en/consult",
    "?source=roundtable_card&topic=chronic&context=education&authorization=Bearer%20x&phone=15551234567",
    "zh"
  );
  const su = new URL(safe, "http://x");
  assert.equal(su.searchParams.get("source"), "roundtable_card");
  assert.equal(su.searchParams.get("topic"), "chronic");
  assert.equal(su.searchParams.get("context"), "education");
  for (const bad of PHI) assert.equal(su.searchParams.has(bad), false, `PHI leaked: ${bad}`);
});

test("swapLocaleInPath: /ai-consult drops PHI/full-prompt, keeps safe source", () => {
  const out = lp.swapLocaleInPath(
    "/en/ai-consult",
    "?source=nav&prompt=full+text&patientName=Jane&cookie=sid&freeText=x&mrn=99",
    "zh"
  );
  const url = new URL(out, "http://x");
  assert.equal(url.pathname, "/zh/ai-consult");
  assert.equal(url.searchParams.get("source"), "nav");
  for (const bad of PHI) assert.equal(url.searchParams.has(bad), false, `PHI leaked on /ai-consult: ${bad}`);
});

// ---------- consultMetadata: consult-specific, non-diagnostic, no regression ----------
test("consultMetadata is consultation-specific, non-diagnostic, and distinct from other pages", () => {
  const en = i18n.getFunnelCopy("en");
  const m = cc.consultMetadata(en);
  assert.ok(m.title.includes("AI Health Consultation") && m.title.includes("GB Medix AI"));
  assert.match(m.description, /consultation/i);
  assert.match(m.description, /not a medical diagnosis/i);
  // must NOT reuse roundtable / knowledge / products / generic copy
  assert.notEqual(m.description, en.list.subtitle);
  assert.notEqual(m.description, en.knowledge.subtitle); // the pre-1.1 value
  assert.notEqual(m.description, en.products.note);

  const zh = i18n.getFunnelCopy("zh");
  const mz = cc.consultMetadata(zh);
  assert.ok(mz.description.includes("问诊"));
  assert.ok(mz.description.includes("不是医学诊断"));
  assert.notEqual(mz.description, zh.knowledge.subtitle);
});
