#!/usr/bin/env node
// Reads URLs from pages-to-review.json, runs a11y (axe-core) + SEO (Lighthouse) checks.
// On pass: writes pages.json and exits 0. On fail: exits 1 without writing pages.json.
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import { pathToFileURL } from "url";

// Resolve the tools from the module root, where Step 1 installs them, not from this file's folder
const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const { default: lighthouse } = await import(pathToFileURL(require.resolve("lighthouse")).href);

const SCORED_MODES = new Set(["binary", "numeric"]);

// A string array is expected; tolerate { url } objects, which agents write despite the instructions
const entries = JSON.parse(readFileSync("pages-to-review.json", "utf-8"));
const urls = Array.isArray(entries)
  ? entries.map(entry => (typeof entry === "string" ? entry : entry?.url))
  : [];
if (urls.length === 0 || !urls.every(url => typeof url === "string")) {
  console.error('pages-to-review.json must be a JSON array of URLs: ["http://localhost:8080/…", …]');
  process.exit(1);
}
const port = 9222;
const browser = await chromium.launch({
  args: ["--no-sandbox", `--remote-debugging-port=${port}`],
});
const context = await browser.newContext();
const page = await context.newPage();

const results = [];

for (const url of urls) {
  process.stdout.write(`\nChecking ${url} … `);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  // A11y
  const axe = await new AxeBuilder({ page }).analyze();

  // SEO — Lighthouse reuses the already-open browser via the debug port
  const lhr = (await lighthouse(url, { port, output: "json", onlyCategories: ["seo"] }))?.lhr;
  const seoViolations = lhr
    ? Object.values(lhr.audits).filter(
        a => SCORED_MODES.has(a.scoreDisplayMode) && a.score !== null && a.score < 1,
      )
    : [];

  process.stdout.write(`a11y=${axe.violations.length} violation(s) seo=${seoViolations.length} violation(s)\n`);
  results.push({ url, violations: axe.violations, seoViolations });
}

await browser.close();

// ── Report ──────────────────────────────────────────────────────────────────
let failed = false;

for (const r of results) {
  const pageOk = r.violations.length === 0 && r.seoViolations.length === 0;
  if (!pageOk) failed = true;

  console.log(`\n${"─".repeat(70)}`);
  console.log(`${pageOk ? "✅" : "❌"} ${r.url}`);

  for (const v of r.violations) {
    console.log(`   ❌ A11y [${v.id}] — ${v.description} (${v.nodes.length} node${v.nodes.length !== 1 ? "s" : ""})`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`        ${node.html.slice(0, 100)}`);
    }
  }

  for (const a of r.seoViolations) {
    console.log(`   ❌ SEO  [${a.id}] — ${a.title}`);
    if (a.description) console.log(`        ${a.description.slice(0, 120)}`);
  }
}

console.log(`\n${"═".repeat(70)}`);
if (failed) {
  console.log("\n❌ FAIL — fix the issues above, redeploy, and re-run.");
  process.exit(1);
} else {
  writeFileSync("pages.json", JSON.stringify(urls, null, 2));
  console.log("\n✅ PASS — pages.json written.");
  process.exit(0);
}
