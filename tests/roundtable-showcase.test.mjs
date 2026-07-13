// GB MEDIX AI Medical Roundtable — SHOWCASE 1.0 tests.
//
// Executes the REAL showcase implementation: the actual TS view-model and the
// actual React showcase component are compiled (project tsc -> CommonJS in a
// git-ignored temp dir) and the component is rendered to static HTML with the
// real react-dom/server. Assertions run against real rendered output and real
// data — not source-string mirrors. A small source guard (no <form>/<input>/
// fetch/Server Action) supplements, but the behavioral render is primary.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const DIR = join(process.cwd(), "app", "[lang]", "roundtable");
const dataTs = join(DIR, "showcase-data.ts");
const compTsx = join(DIR, "roundtable-showcase.tsx");
const pageTsx = join(DIR, "page.tsx");

mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(process.cwd(), ".tmp", "showcase-"));
const requireCjs = createRequire(import.meta.url);
try {
  execFileSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", dataTs, compTsx, "--outDir", outDir, "--rootDir", DIR,
     "--jsx", "react-jsx", "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node",
     "--esModuleInterop", "--skipLibCheck"],
    { stdio: "pipe" }
  );
} catch (error) {
  rmSync(outDir, { recursive: true, force: true });
  throw error;
}
const React = requireCjs("react");
const { renderToStaticMarkup } = requireCjs("react-dom/server");
const dataMod = requireCjs(resolve(outDir, "showcase-data.js"));
const compMod = requireCjs(resolve(outDir, "roundtable-showcase.js"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const render = (lang) => renderToStaticMarkup(React.createElement(compMod.RoundtableShowcase, { lang }));
const zh = render("zh");
const en = render("en");

const collectStrings = (v, out = []) => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
};

// ---- zh and en pages both render ----
test("both zh and en showcase render real HTML", () => {
  assert.ok(zh.length > 500);
  assert.ok(en.length > 500);
  assert.equal(dataMod.resolveShowcaseLang("zh"), "zh");
  assert.equal(dataMod.resolveShowcaseLang("en"), "en");
  assert.equal(dataMod.resolveShowcaseLang("fr"), "en"); // unknown -> en default
  assert.equal(dataMod.resolveShowcaseLang(undefined), "en");
});

// ---- mandated safety disclaimer present (exact text), not footer-hidden ----
test("exact safety disclaimer is rendered in both languages", () => {
  assert.equal(
    dataMod.SAFETY_DISCLAIMER.zh,
    "规则级功能原型，仅用于平台能力展示；非临床验证、非医学诊断、非治疗建议、非生产医疗服务。所有医学内容正式发布前必须经过可信的医生审核流程。"
  );
  assert.equal(
    dataMod.SAFETY_DISCLAIMER.en,
    "Rule-based capability prototype for platform demonstration only. Not clinically validated, not a medical diagnosis, not treatment advice, and not a production medical service. Medical content requires trusted human medical review before publication."
  );
  assert.ok(zh.includes(dataMod.SAFETY_DISCLAIMER.zh));
  assert.ok(en.includes(dataMod.SAFETY_DISCLAIMER.en));
  // shown multiple times (hero + each of 3 core result regions) -> not tucked away once in a footer
  const count = (h, s) => h.split(s).length - 1;
  assert.ok(count(zh, dataMod.SAFETY_DISCLAIMER.zh) >= 4, "disclaimer must appear in hero and each core section");
  assert.ok(count(en, dataMod.SAFETY_DISCLAIMER.en) >= 4);
});

// ---- demonstration-data labelling ----
test("demonstration-data badge is present", () => {
  assert.equal(dataMod.DEMONSTRATION_DATA, true);
  assert.ok(zh.includes("模拟数据"));
  assert.ok(en.includes("Demonstration Data"));
});

// ---- no free-text medical input, no form/server-action/api ----
test("rendered pages contain no free-text input, form, or textarea", () => {
  for (const html of [zh, en]) {
    assert.equal(html.includes("<input"), false);
    assert.equal(html.includes("<textarea"), false);
    assert.equal(html.includes("<form"), false);
  }
});

test("source guard: no fetch / Server Action / onSubmit / action= in showcase files", () => {
  for (const f of [dataTs, compTsx, pageTsx]) {
    const src = readFileSync(f, "utf8");
    assert.equal(/fetch\s*\(/.test(src), false, `${f} must not call fetch`);
    assert.equal(src.includes('"use server"'), false, `${f} must not be a Server Action`);
    assert.equal(/onSubmit/.test(src), false, `${f} must not submit a form`);
    assert.equal(/\baction=/.test(src), false, `${f} must not set a form action`);
    assert.equal(/axios|XMLHttpRequest|WebSocket/.test(src), false, `${f} must not open network`);
  }
});

// ---- allowed and blocked examples correctly identified ----
test("gate examples are correctly classified with block reasons", () => {
  const gate = dataMod.GATE_SECTION.zh;
  const allowed = gate.examples.filter((e) => e.verdict === "allowed");
  const blocked = gate.examples.filter((e) => e.verdict === "blocked");
  assert.ok(allowed.length >= 4);
  assert.ok(blocked.length >= 6);
  // allowed carry no block reason; blocked carry high_risk or privacy
  assert.ok(allowed.every((e) => e.blockReason === null));
  assert.ok(blocked.every((e) => e.blockReason === "high_risk" || e.blockReason === "privacy"));
  // the mandated blocked categories are represented
  assert.ok(blocked.some((e) => e.blockReason === "privacy"));
  assert.ok(blocked.filter((e) => e.blockReason === "high_risk").length >= 5);
  // rendered HTML shows both allowed and blocked labels + a blocked status
  assert.ok(zh.includes(gate.allowedHeading));
  assert.ok(zh.includes(gate.blockedHeading));
  assert.ok(zh.includes("high_risk_blocked（模拟）"));
  assert.ok(zh.includes("privacy_blocked（模拟）"));
});

// ---- awaiting medical review vs published not conflated ----
test("awaiting_medical_review and publication are distinct; PublicationPlan is not a real release", () => {
  const sm = dataMod.STATE_MACHINE_SECTION.en;
  const awaiting = sm.stages.find((s) => s.kind === "awaiting_review");
  const pubPlan = sm.stages.find((s) => s.label === "PublicationPlan");
  const approved = sm.stages.find((s) => s.label === "Approved");
  assert.ok(awaiting, "must have an awaiting_medical_review stage");
  assert.ok(pubPlan, "must have a PublicationPlan stage");
  assert.equal(awaiting.label, "Awaiting medical review");
  // PublicationPlan and Approved are simulated/not-yet, never marked completed
  assert.equal(pubPlan.kind, "planned");
  assert.equal(approved.kind, "planned");
  assert.ok(/NOT a public release/i.test(pubPlan.note));
  // no stage is labelled as a finished public "Published" success
  assert.equal(sm.stages.some((s) => /^published$/i.test(s.label) && s.kind === "completed"), false);
  // zh render makes the "not published" point explicit near the plan
  assert.ok(dataMod.STATE_MACHINE_SECTION.zh.stages.some((s) => s.note.includes("不等于已公开发布")));
});

// ---- consensus structure: >=5 roles, evidence + safety mandatory ----
test("consensus flow exposes >=5 roles with Evidence and Safety mandatory", () => {
  const c = dataMod.CONSENSUS_SECTION.en;
  assert.ok(c.roles.length >= 5);
  const ev = c.roles.find((r) => r.role === "evidence_medicine");
  const safety = c.roles.find((r) => r.role === "medical_safety_compliance");
  assert.ok(ev && ev.mandatory === true);
  assert.ok(safety && safety.mandatory === true);
  // supporting and opposing evidence both present with levels
  assert.ok(c.evidence.some((e) => e.stance === "supporting"));
  assert.ok(c.evidence.some((e) => e.stance === "opposing"));
  // review status shown as pending / not published
  assert.ok(/pending/i.test(c.reviewStatusValue));
  assert.ok(/not published/i.test(c.reviewStatusValue));
  assert.ok(en.includes("Agent roles")); // heading present (raw "&" is HTML-escaped in the render)
  assert.ok(en.includes("evidence_medicine") && en.includes("medical_safety_compliance"));
});

// ---- mobile key content is present in the DOM (not behind desktop-only) ----
test("key content (disclaimer + 3 section headings) is in the rendered DOM", () => {
  for (const [html, lang] of [[zh, "zh"], [en, "en"]]) {
    const d = dataMod.getShowcaseData(lang);
    assert.ok(html.includes(d.chrome.disclaimer));
    assert.ok(html.includes(d.gate.heading));
    assert.ok(html.includes(d.stateMachine.heading));
    assert.ok(html.includes(d.consensus.heading));
  }
  // core content is not wrapped in a desktop-only hidden container
  assert.equal(zh.includes('class="hidden'), false);
});

// ---- no patient PII / real clinical content in any showcase string ----
test("no PII or real clinical identifiers appear in showcase data", () => {
  const strings = [...collectStrings(dataMod.getShowcaseData("zh")), ...collectStrings(dataMod.getShowcaseData("en"))];
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const phone = /\d{7,}/;
  const mrn = /\b(mrn|medical record no|病历号|病案号)\b/i;
  for (const s of strings) {
    assert.equal(email.test(s), false, `email-like content: ${s}`);
    assert.equal(phone.test(s), false, `phone/id-like digits: ${s}`);
    assert.equal(mrn.test(s), false, `MRN-like content: ${s}`);
  }
});
