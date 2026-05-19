#!/usr/bin/env node
// Updates the gh-pages gallery with the latest benchmark run.
// Expects:
//   - benchmark-result.json  in cwd
//   - SCREENSHOT_FILE env var  (e.g. screenshot-abc1234.png in cwd)
//   - PAGES_DIR env var        (path to the checked-out gh-pages branch, default: ./pages-out)
//   - REPO env var             (e.g. owner/repo — for commit links)

const { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } = require('fs');
const { resolve, join } = require('path');

const pagesDir = process.env.PAGES_DIR ?? resolve('pages-out');
const screenshotFile = process.env.SCREENSHOT_FILE;
const repo = process.env.REPO ?? '';
const templatePath = resolve('.github/benchmark/index-template.html');

if (!screenshotFile) {
  console.error('SCREENSHOT_FILE env var is required');
  process.exit(1);
}

const result = JSON.parse(readFileSync(resolve('benchmark-result.json'), 'utf8'));

mkdirSync(join(pagesDir, 'screenshots'), { recursive: true });

copyFileSync(resolve(screenshotFile), join(pagesDir, 'screenshots', screenshotFile));

const runsFile = join(pagesDir, 'runs.json');
const runs = existsSync(runsFile) ? JSON.parse(readFileSync(runsFile, 'utf8')) : [];

runs.unshift({
  ...result,
  screenshot: `screenshots/${screenshotFile}`,
  run_number: runs.length + 1,
});

writeFileSync(runsFile, JSON.stringify(runs, null, 2));

function runHtml(run, index) {
  const date = new Date(run.timestamp).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
  const shortCommit = (run.commit ?? 'unknown').slice(0, 7);
  const commitUrl = repo ? `https://github.com/${repo}/commit/${run.commit}` : '#';
  const runUrl = run.run_url ?? '#';
  const num = runs.length - index;

  const durationMins = run.duration_seconds > 0
    ? `${Math.round(run.duration_seconds / 60)}min`
    : '—';

  function fmtTok(n) {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}G`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
  }
  const totalTokens = (run.tokens_prompt ?? 0) + (run.tokens_completion ?? 0);
  const tokStr = totalTokens > 0 ? fmtTok(totalTokens) : null;

  const screenshotHtml = run.screenshot
    ? `<a href="${run.screenshot}" target="_blank" rel="noopener"><img src="${run.screenshot}" alt="Run ${num}" loading="lazy" /></a>`
    : `<div class="no-screenshot">No screenshot captured</div>`;

  return `
    <div class="run">
      <div class="run-header">
        <span class="run-number"><a href="${runUrl}" target="_blank" rel="noopener">#${num}</a></span>
        <span class="run-date">${date} UTC</span>
        <span class="run-commit"><a href="${commitUrl}" target="_blank" rel="noopener">${shortCommit}</a></span>
        <div class="run-meta">
          <span><strong>${durationMins}</strong></span>
          ${tokStr ? `<span><strong>${tokStr}</strong> tokens</span>` : ''}
        </div>
      </div>
      <div class="run-caption">
        <a class="run-num" href="${runUrl}" target="_blank" rel="noopener">#${num}</a>
        <span class="sep">·</span>
        <a href="${commitUrl}" target="_blank" rel="noopener">${shortCommit}</a>
        <span class="sep">·</span>
        <span title="${date} UTC">${durationMins}</span>
        ${tokStr ? `<span class="sep">·</span><span>${tokStr}</span>` : ''}
      </div>
      <div class="run-screenshot">${screenshotHtml}</div>
    </div>`;
}

const runsHtml = runs.map((run, i) => runHtml(run, i)).join('\n');

const RUNS_START = '<!-- RUNS_START -->';
const RUNS_END = '<!-- RUNS_END -->';

const base = readFileSync(templatePath, 'utf8');

const startIdx = base.indexOf(RUNS_START);
const endIdx = base.indexOf(RUNS_END);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('index.html is missing <!-- RUNS_START --> / <!-- RUNS_END --> markers');
}

const updatedHtml =
  base.slice(0, startIdx + RUNS_START.length) +
  '\n' + runsHtml + '\n    ' +
  base.slice(endIdx);

writeFileSync(join(pagesDir, 'index.html'), updatedHtml);

console.log(`Gallery updated: ${runs.length} run(s) in ${pagesDir}/index.html`);
