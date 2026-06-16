import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import remarkGfm from "remark-gfm";
import remarkGithub from "remark-github";
import remarkHtml from "remark-html";
import { remark } from "remark";
import type { BenchmarkRun } from "./types.js";

const ROOT = resolve(import.meta.dirname, "..", "..");
const RESULTS_DIR = join(ROOT, "results");
const OUT_DIR = join(ROOT, ".website-dist");
const REPO = "Jahia/agentic";

// ─── Releases ────────────────────────────────────────────────────────────────

interface Release {
  version: string;
  date: string; // ISO 8601
  notesHtml: string;
}

function parseChangelog(md: string): Array<{ version: string; notesMd: string }> {
  const releases: Array<{ version: string; notesMd: string }> = [];
  const sections = md.split(/^## /m).slice(1);
  for (const section of sections) {
    const newline = section.indexOf("\n");
    const version = section.slice(0, newline).trim();
    const notesMd = section.slice(newline + 1).trim();
    if (version) releases.push({ version, notesMd });
  }
  return releases;
}

async function renderNotes(notesMd: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkGithub, { repository: REPO })
    .use(remarkHtml, { sanitize: false })
    .process(notesMd);
  return String(file);
}

function getTagDate(version: string): string | null {
  const tag = `@jahia/agentic@${version}`;
  const result = spawnSync("git", ["log", tag, "-1", "--format=%aI"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  const date = result.stdout?.trim();
  return date || null;
}

async function loadReleases(): Promise<Release[]> {
  const changelogPath = join(ROOT, "CHANGELOG.md");
  if (!existsSync(changelogPath)) return [];
  const md = readFileSync(changelogPath, "utf-8");
  const parsed = parseChangelog(md);
  const releases: Release[] = [];
  for (const { version, notesMd } of parsed) {
    const date = getTagDate(version);
    if (!date) continue;
    const notesHtml = await renderNotes(notesMd);
    releases.push({ version, date, notesHtml });
  }
  return releases;
}

function scoreColor(score: number | null): string {
  if (score === null) return "#6e7681";
  const pct = score * 100;
  if (pct >= 100) return "#3fb950";
  if (pct >= 75) return "#d29922";
  return "#f85149";
}

function scoreBadge(label: string, score: number | null): string {
  const color = scoreColor(score);
  const text = score === null ? "N/A" : `${Math.round(score * 100)}%`;
  return `<span class="badge" style="background:${color}">${label}: ${text}</span>`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// Pricing for Claude Sonnet 4.6
const PRICE_INPUT_PER_M = 3.0;
const PRICE_CACHED_PER_M = 0.3;
const PRICE_OUTPUT_PER_M = 15.0;

function estimateCost(tokens: { input: number; output: number; cached: number }): number {
  return (
    (tokens.input * PRICE_INPUT_PER_M +
      tokens.cached * PRICE_CACHED_PER_M +
      tokens.output * PRICE_OUTPUT_PER_M) /
    1_000_000
  );
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f6f8fa;
  --surface: #ffffff;
  --surface-hover: #f3f4f6;
  --border: #d0d7de;
  --text: #1f2328;
  --text-muted: #57606a;
  --accent: #0969da;
  --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
body { background: var(--bg); color: var(--text); font-family: var(--font); line-height: 1.6; min-height: 100vh; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Header ── */
.header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; gap: 16px; }
.header h1 { font-size: 1.1rem; font-weight: 600; color: var(--text); }
.header .subtitle { font-size: 0.85rem; color: var(--text-muted); }

/* ── Page layout ── */
.container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

/* ── Run grid (homepage) ── */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s; text-decoration: none; display: block; color: inherit; }
.card:hover { border-color: var(--accent); box-shadow: 0 4px 12px rgba(9,105,218,0.1); transform: translateY(-2px); text-decoration: none; }
.card-screenshot { width: 100%; aspect-ratio: 16/9; object-fit: cover; object-position: top; background: #eaeef2; display: flex; align-items: center; justify-content: center; }
.card-screenshot img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.card-screenshot .placeholder { color: var(--text-muted); font-size: 0.85rem; }
.card-body { padding: 14px 16px; }
.card-date { font-size: 0.85rem; font-weight: 600; color: var(--text); }
.card-duration { font-size: 0.8rem; color: var(--text-muted); margin-left: 6px; }
.card-tokens { font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; }
.card-scores { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.badge { display: inline-block; font-size: 0.75rem; font-weight: 600; color: #fff; padding: 2px 8px; border-radius: 20px; }
.branch-badge { display: inline-block; font-size: 0.7rem; font-weight: 600; color: #fff; padding: 2px 8px; border-radius: 4px; background: #6366f1; margin-left: 6px; }
.empty { text-align: center; color: var(--text-muted); padding: 80px 0; font-size: 1.1rem; }

/* ── Back link ── */
.back { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px; }
.back:hover { color: var(--accent); text-decoration: none; }

/* ── Run meta ── */
.run-meta { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; }
.run-meta-item { display: flex; flex-direction: column; gap: 2px; }
.run-meta-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.run-meta-value { font-size: 0.9rem; color: var(--text); font-weight: 500; }
.run-meta-link { font-size: 0.85rem; color: var(--accent); }

/* ── Fake browser ── */
.browser { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: 0 2px 8px rgba(31,35,40,0.06); }
.browser-chrome { background: #eaeef2; padding: 10px 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
.browser-dots { display: flex; gap: 6px; flex-shrink: 0; }
.browser-dot { width: 12px; height: 12px; border-radius: 50%; }
.browser-dot.red    { background: #ff5f57; }
.browser-dot.yellow { background: #ffbd2e; }
.browser-dot.green  { background: #28c840; }
.browser-url { flex: 1; background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.browser-chrome-badges { display: flex; gap: 6px; flex-shrink: 0; }
.browser-tabs { display: flex; background: #eaeef2; border-bottom: 1px solid var(--border); overflow-x: auto; }
.browser-tab { padding: 10px 18px; font-size: 0.82rem; color: var(--text-muted); cursor: pointer; border: none; background: transparent; white-space: nowrap; border-bottom: 2px solid transparent; transition: color 0.12s, border-color 0.12s; }
.browser-tab:hover { color: var(--text); }
.browser-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--surface); }
.browser-content { background: #fff; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
.tab-panel img { width: 100%; display: block; }
.tab-panel .no-screenshot { padding: 60px; text-align: center; color: #57606a; font-size: 0.9rem; background: #f6f8fa; }

/* ── Release banner ── */
.release-banner { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 16px; padding: 12px 0; border-top: 1px solid var(--border); }
.release-banner + .release-banner { border-top: none; padding-top: 0; }
.release-tag { font-size: 0.8rem; font-weight: 700; color: var(--accent); background: #dbeafe; border: 1px solid #93c5fd; border-radius: 20px; padding: 2px 10px; white-space: nowrap; flex-shrink: 0; }
.release-notes { font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; }
.release-notes ul { margin: 0; padding-left: 1.2em; }
.release-notes li { margin: 0; }
.release-notes p { margin: 0; }
.release-notes code { background: #f0f0f0; border-radius: 3px; padding: 1px 4px; font-size: 0.8em; }
`;

// ─── Templates ──────────────────────────────────────────────────────────────

function page(title: string, body: string, cssDepth = 0): string {
  const cssPath = cssDepth === 0 ? "./styles.css" : "../".repeat(cssDepth) + "styles.css";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${cssPath}">
</head>
<body>
${body}
</body>
</html>`;
}

function releaseBanner(release: Release): string {
  return `<div class="release-banner">
  <span class="release-tag">🏷 v${escHtml(release.version)}</span>
  <div class="release-notes">${release.notesHtml}</div>
</div>`;
}

function homepage(runs: BenchmarkRun[], releases: Release[]): string {
  const sorted = [...runs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const sortedReleases = [...releases].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const items: string[] = [];

  let releaseIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const runTime = new Date(sorted[i]!.date).getTime();
    const nextRunTime = i + 1 < sorted.length ? new Date(sorted[i + 1]!.date).getTime() : -Infinity;

    // Inject releases that fall before this run (newer) — only before the first run
    if (i === 0) {
      while (
        releaseIdx < sortedReleases.length &&
        new Date(sortedReleases[releaseIdx]!.date).getTime() > runTime
      ) {
        items.push(releaseBanner(sortedReleases[releaseIdx]!));
        releaseIdx++;
      }
    }

    items.push(runCard(sorted[i]!));

    // Inject releases that fall between this run and the next
    while (releaseIdx < sortedReleases.length) {
      const releaseTime = new Date(sortedReleases[releaseIdx]!.date).getTime();
      if (releaseTime <= runTime && releaseTime > nextRunTime) {
        items.push(releaseBanner(sortedReleases[releaseIdx]!));
        releaseIdx++;
      } else {
        break;
      }
    }
  }

  // Any remaining releases older than all runs
  while (releaseIdx < sortedReleases.length) {
    items.push(releaseBanner(sortedReleases[releaseIdx]!));
    releaseIdx++;
  }

  const gridContent = sorted.length
    ? items.join("\n")
    : `<p class="empty">No benchmark runs yet.</p>`;

  return page(
    "Jahia Benchmark",
    `
<header class="header">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0969da" stroke-width="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
  <div>
    <h1>Jahia Benchmark</h1>
    <span class="subtitle">Harness quality over time</span>
  </div>
</header>
<main class="container">
  <div class="grid">
    ${gridContent}
  </div>
</main>`,
  );
}

function runCard(run: BenchmarkRun): string {
  const home = run.pages[0];
  const hasScreenshot = home?.screenshot != null;
  const screenshotSrc = hasScreenshot ? `run/${run.id}/${home!.screenshot}` : null;

  const screenshotHtml = screenshotSrc
    ? `<img src="${screenshotSrc}" alt="Homepage screenshot" loading="lazy">`
    : `<span class="placeholder">No screenshot</span>`;

  const scores =
    home != null
      ? [scoreBadge("A11y", home.accessibilityScore), scoreBadge("SEO", home.seoScore)].join("")
      : "";

  const totalTokens = run.tokens.input + run.tokens.output;
  const cost = estimateCost(run.tokens);
  const branch = run.branch || "main";
  const branchBadge = branch !== "main" ? `<span class="branch-badge">${escHtml(branch)}</span>` : "";

  return `<a class="card" href="run/${run.id}/">
  <div class="card-screenshot">${screenshotHtml}</div>
  <div class="card-body">
    <div>
      <span class="card-date">${formatDate(run.date)}</span>
      <span class="card-duration">· ${formatDuration(run.durationSeconds)}</span>
      ${branchBadge}
    </div>
    <div class="card-tokens">↑${formatCount(run.tokens.input)} ↓${formatCount(run.tokens.output)} · ${formatCount(totalTokens)} total tokens · ${formatCost(cost)}</div>
    <div class="card-scores">${scores}</div>
  </div>
</a>`;
}

function detailPage(run: BenchmarkRun): string {
  const totalTokens = run.tokens.input + run.tokens.output;
  const cost = estimateCost(run.tokens);
  const firstPage = run.pages[0];
  const githubLink = run.githubRunUrl
    ? `<a class="run-meta-link" href="${run.githubRunUrl}" target="_blank" rel="noopener">View run logs ↗</a>`
    : "";

  const branch = run.branch || "main";
  const branchItem = branch !== "main" ? `
  <div class="run-meta-item">
    <span class="run-meta-label">Branch</span>
    <span class="run-meta-value"><span class="branch-badge">${escHtml(branch)}</span></span>
  </div>` : "";

  const metaBox = `
<div class="run-meta">
  ${branchItem}
  <div class="run-meta-item">
    <span class="run-meta-label">Date</span>
    <span class="run-meta-value">${formatDate(run.date)}</span>
  </div>
  <div class="run-meta-item">
    <span class="run-meta-label">Duration</span>
    <span class="run-meta-value">${formatDuration(run.durationSeconds)}</span>
  </div>
  <div class="run-meta-item">
    <span class="run-meta-label">Tokens</span>
    <span class="run-meta-value">↑${formatCount(run.tokens.input)} ↓${formatCount(run.tokens.output)} · ${formatCount(run.tokens.cached)} cached</span>
  </div>
  <div class="run-meta-item">
    <span class="run-meta-label">Total</span>
    <span class="run-meta-value">${formatCount(totalTokens)} tokens</span>
  </div>
  <div class="run-meta-item">
    <span class="run-meta-label">Est. Cost</span>
    <span class="run-meta-value">${formatCost(cost)}</span>
  </div>
  ${githubLink ? `<div class="run-meta-item">${githubLink}</div>` : ""}
</div>`;

  const tabs = run.pages
    .map(
      (p, i) =>
        `<button class="browser-tab${i === 0 ? " active" : ""}" onclick="showTab(${i})">${escHtml(p.title || "<untitled>")}</button>`,
    )
    .join("\n");

  const panels = run.pages
    .map((p, i) => {
      const imgHtml = p.screenshot
        ? `<img src="${p.screenshot}" alt="${escHtml(p.title)}">`
        : `<div class="no-screenshot">No screenshot available for this run</div>`;

      return `<div class="tab-panel${i === 0 ? " active" : ""}" id="tab-${i}">
  <div class="browser-content">${imgHtml}</div>
</div>`;
    })
    .join("\n");

  const urlBarDefault = firstPage ? escHtml(firstPage.url) : "";
  const firstPageBadges = firstPage
    ? scoreBadge("A11y", firstPage.accessibilityScore) + scoreBadge("SEO", firstPage.seoScore)
    : "";

  const body = `
<header class="header">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0969da" stroke-width="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
  <div>
    <h1>Jahia Benchmark</h1>
    <span class="subtitle">Run detail</span>
  </div>
</header>
<main class="container">
  <a class="back" href="../../">← All runs</a>
  ${metaBox}
  <div class="browser">
    <div class="browser-chrome">
      <div class="browser-dots">
        <span class="browser-dot red"></span>
        <span class="browser-dot yellow"></span>
        <span class="browser-dot green"></span>
      </div>
      <div class="browser-url" id="url-bar">${urlBarDefault}</div>
      <div class="browser-chrome-badges" id="score-badges">${firstPageBadges}</div>
    </div>
    <div class="browser-tabs">${tabs}</div>
    ${panels}
  </div>
</main>
<script>
const pageData = ${JSON.stringify(run.pages.map((p) => ({ url: p.url, a11y: p.accessibilityScore, seo: p.seoScore })))};
function scoreColor(s) {
  if (s === null) return '#6e7681';
  const pct = s * 100;
  return pct >= 100 ? '#3fb950' : pct >= 75 ? '#d29922' : '#f85149';
}
function badge(label, score) {
  const color = scoreColor(score);
  const text = score === null ? 'N/A' : Math.round(score * 100) + '%';
  return '<span class="badge" style="background:' + color + '">' + label + ': ' + text + '</span>';
}
function showTab(idx) {
  document.querySelectorAll('.browser-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
  const d = pageData[idx];
  document.getElementById('url-bar').textContent = d?.url ?? '';
  document.getElementById('score-badges').innerHTML = d ? badge('A11y', d.a11y) + badge('SEO', d.seo) : '';
}
</script>`;

  return page(`Run ${run.id} — Jahia Benchmark`, body, 2);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Build ───────────────────────────────────────────────────────────────────

const benchmarkPath = join(RESULTS_DIR, "benchmark.json");
if (!existsSync(benchmarkPath)) {
  console.error("No results/benchmark.json found. Run the benchmark first.");
  process.exit(1);
}

const runs: BenchmarkRun[] = JSON.parse(readFileSync(benchmarkPath, "utf-8")) as BenchmarkRun[];
const releases = await loadReleases();
console.log(`Loaded ${releases.length} release(s) from CHANGELOG.md`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "styles.css"), CSS);
writeFileSync(join(OUT_DIR, "index.html"), homepage(runs, releases));

for (const run of runs) {
  const runOutDir = join(OUT_DIR, "run", run.id);
  mkdirSync(runOutDir, { recursive: true });
  writeFileSync(join(runOutDir, "index.html"), detailPage(run));

  const runSrcDir = join(RESULTS_DIR, run.id);
  for (const p of run.pages) {
    if (p.screenshot == null) continue;
    const src = join(runSrcDir, p.screenshot);
    const dst = join(runOutDir, p.screenshot);
    if (existsSync(src)) {
      copyFileSync(src, dst);
    }
  }
}

console.log(`✅ Website built → ${OUT_DIR}`);
