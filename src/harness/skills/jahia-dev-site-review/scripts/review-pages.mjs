#!/usr/bin/env node
// Runs a11y (axe-core) + SEO checks on every URL in pages.json.
// Exits 1 if any page has critical/serious a11y violations or missing SEO basics.
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { readFileSync } from "fs";

const IMPACTS = { minor: 0.1, moderate: 0.25, serious: 0.5, critical: 1 };

const urls = JSON.parse(readFileSync("pages.json", "utf-8"));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();

const results = [];

for (const url of urls) {
  process.stdout.write(`\nChecking ${url} … `);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  // A11y
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const a11yScore = Math.exp(
    -axe.violations.reduce((t, v) => t + (IMPACTS[v.impact] ?? 0), 0),
  );

  // SEO
  const title = await page.title();
  const metaDesc = await page
    .$eval('meta[name="description"]', el => el.getAttribute("content"))
    .catch(() => null);
  const h1s = await page.$$eval("h1", els => els.map(e => e.textContent?.trim()));
  const imgsMissingAlt = await page.$$eval(
    "img",
    els => els.filter(e => !e.getAttribute("alt")).map(e => e.outerHTML.slice(0, 80)),
  );

  const seoIssues = [];
  if (!title) seoIssues.push("missing <title>");
  if (!metaDesc) seoIssues.push("missing <meta name=description>");
  if (h1s.length === 0) seoIssues.push("no <h1>");
  if (h1s.length > 1) seoIssues.push(`${h1s.length} <h1> elements (must be exactly 1)`);
  if (imgsMissingAlt.length > 0)
    seoIssues.push(`${imgsMissingAlt.length} <img> missing alt attribute`);

  process.stdout.write(`a11y=${a11yScore.toFixed(3)}\n`);
  results.push({ url, a11yScore, violations: axe.violations, seoIssues });
}

await browser.close();

// ── Report ──────────────────────────────────────────────────────────────────
let failed = false;

for (const r of results) {
  const critical = r.violations.filter(v => v.impact === "critical" || v.impact === "serious");
  const pageOk = critical.length === 0 && r.seoIssues.length === 0;
  if (!pageOk) failed = true;

  console.log(`\n${"─".repeat(70)}`);
  console.log(`${pageOk ? "✅" : "❌"} ${r.url}`);
  console.log(`   A11y score : ${r.a11yScore.toFixed(3)}  (1.0 = perfect)`);

  for (const v of r.violations) {
    const marker = v.impact === "critical" || v.impact === "serious" ? "🔴" : "🟡";
    console.log(`   ${marker} [${v.impact}] ${v.id} — ${v.description} (${v.nodes.length} node${v.nodes.length !== 1 ? "s" : ""})`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`        ${node.html.slice(0, 100)}`);
    }
  }

  for (const issue of r.seoIssues) {
    console.log(`   🔍 SEO: ${issue}`);
  }
}

console.log(`\n${"═".repeat(70)}`);
const avg = results.reduce((t, r) => t + r.a11yScore, 0) / results.length;
console.log(`Average a11y score: ${avg.toFixed(3)}`);
console.log(failed ? "\n❌ FAIL — fix the issues above, redeploy, and re-run." : "\n✅ PASS");

process.exit(failed ? 1 : 0);
