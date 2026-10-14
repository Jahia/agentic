#!/usr/bin/env node
// Reads URLs from pages-to-review.json, runs a11y (axe-core) + SEO (Lighthouse) checks, and checks that no
// page lost content since the last pass. On pass: writes pages.json and exits 0. On fail: exits 1 without
// writing pages.json.
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import { pathToFileURL } from "url";

// Resolve the tools from the module root, where Step 1 installs them, not from this file's folder
const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const { default: lighthouse } = await import(pathToFileURL(require.resolve("lighthouse")).href);

const SCORED_MODES = new Set(["binary", "numeric"]);

// The text and headings of each page at the last pass. A fix that moves content where the template does not
// render it leaves no a11y or SEO violation: only the drop shows it
const BASELINE = "review-pages-baseline.json";
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf-8")) : {};

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

  const content = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return { text: main.innerText.replace(/\s+/g, " ").trim().length, headings: main.querySelectorAll("h2, h3, h4, h5, h6").length };
  });
  const before = baseline[url];
  const contentLost = before !== undefined && (content.text < before.text * 0.7 || content.headings < before.headings);

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
  results.push({ url, violations: axe.violations, seoViolations, content, before, contentLost });
}

await browser.close();

// ── Report ──────────────────────────────────────────────────────────────────
let failed = false;

for (const r of results) {
  const pageOk = r.violations.length === 0 && r.seoViolations.length === 0 && !r.contentLost;
  if (!pageOk) failed = true;

  console.log(`\n${"─".repeat(70)}`);
  console.log(`${pageOk ? "✅" : "❌"} ${r.url}`);

  for (const v of r.violations) {
    console.log(`   ❌ A11y [${v.id}] — ${v.description} (${v.nodes.length} node${v.nodes.length !== 1 ? "s" : ""})`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`        ${node.html.slice(0, 100)}`);
    }
  }

  if (r.contentLost) {
    console.log(
      `   ❌ Content — ${r.content.text} characters and ${r.content.headings} headings, down from ${r.before.text} and ${r.before.headings} at the last pass`,
    );
    console.log("        A change hid content: restore it. If you removed it on purpose, delete " + BASELINE + ".");
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
  writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(results.map(r => [r.url, r.content])), null, 2));
  console.log("\n✅ PASS — pages.json written.");
  process.exit(0);
}
