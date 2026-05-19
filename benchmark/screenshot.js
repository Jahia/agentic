#!/usr/bin/env node
/**
 * CrumbleCo Benchmark Screenshot Utility
 *
 * Takes full-page screenshots of all benchmark pages.
 * Authenticates to Jahia before capturing live-mode pages.
 *
 * Usage:
 *   node screenshot.js \
 *     --output-dir ./results/screenshots/20250519-120000 \
 *     --homepage http://localhost:8080/cms/render/live/en/sites/crumbleco/home.html \
 *     --blog      http://localhost:8080/cms/render/live/en/sites/crumbleco/home/blog.html
 *
 * Dependencies (install once):
 *   npm install playwright
 *   npx playwright install chromium
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// ── Parse CLI arguments ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, "");
  opts[key] = args[i + 1];
}

const outputDir = opts["output-dir"] ?? "./results/screenshots/latest";
const JAHIA_URL = "http://localhost:8080";
const LOGIN_URL = `${JAHIA_URL}/cms/login`;

// Collect page entries from args (every key except output-dir)
const pages = Object.entries(opts)
  .filter(([k]) => k !== "output-dir")
  .map(([slug, url]) => ({ slug, url }))
  .filter(({ url }) => url?.startsWith("http"));

if (pages.length === 0) {
  console.error("No page URLs provided. Pass --<slug> <url> pairs.");
  process.exit(1);
}

// ── Screenshot all pages ─────────────────────────────────────────────────────

async function run() {
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Authenticate once — cookie persists across pages
  console.log("[auth] Logging in to Jahia...");
  const loginPage = await context.newPage();
  await loginPage.goto(LOGIN_URL, { waitUntil: "networkidle" });

  // Fill login form
  await loginPage.fill('input[name="username"], #username, input[type="text"]', "root");
  await loginPage.fill('input[name="password"], #password, input[type="password"]', "root1234");
  await Promise.all([
    loginPage.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {}),
    loginPage.keyboard.press("Enter"),
  ]);
  await loginPage.close();

  // Screenshot each page
  const results = [];
  for (const { slug, url } of pages) {
    const outFile = path.join(outputDir, `${slug}.png`);
    console.log(`[screenshot] ${slug} → ${url}`);

    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

      // Wait a moment for any lazy-loaded images
      await page.waitForTimeout(1500);

      await page.screenshot({ path: outFile, fullPage: true });
      console.log(`[screenshot] ✓ saved ${path.basename(outFile)}`);
      results.push({ slug, url, file: outFile, status: "ok" });
    } catch (err) {
      console.error(`[screenshot] ✗ ${slug}: ${err.message}`);
      results.push({ slug, url, file: outFile, status: "error", error: err.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // Summary
  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\n[done] ${ok}/${results.length} screenshots saved to ${outputDir}`);

  // Write manifest
  const manifestPath = path.join(outputDir, "manifest.json");
  const fs = await import("node:fs/promises");
  await fs.writeFile(manifestPath, JSON.stringify({ outputDir, pages: results }, null, 2));
}

run().catch((err) => {
  console.error("[fatal]", err.message);
  process.exit(1);
});
