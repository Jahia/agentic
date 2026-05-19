#!/usr/bin/env node
// Runs the Copilot CLI benchmark, tees output to copilot-output.log,
// parses results, and writes benchmark-result.json.

const { spawn } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

async function run() {
  const prompt = readFileSync(resolve('benchmark/prompt.md'), 'utf8').trim();
  const moduleDir = resolve('crumbleco');

  console.log('=== Starting CrumbleCo benchmark (GitHub Copilot CLI) ===');
  const startMs = Date.now();
  const chunks = [];

  await new Promise((done) => {
    const child = spawn('copilot', ['-p', prompt, '--autopilot', '--allow-all'], {
      cwd: moduleDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const onData = (chunk) => { process.stdout.write(chunk); chunks.push(chunk); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', done);
    child.on('error', done);
  });

  const durationSeconds = Math.round((Date.now() - startMs) / 1000);
  const raw = Buffer.concat(chunks).toString('utf8');
  writeFileSync('copilot-output.log', raw);

  const text = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // PAGE_URL: homepage http://... OR PAGE_URL: http://...
  const pageMatches = [...text.matchAll(/PAGE_URL:[^\n]*?(https?:\/\/[^\s>]+)/g)];
  // Prefer the homepage URL; fall back to the last match
  const homeMatch = pageMatches.find(m => m[1].includes('/home.html'));
  const pageUrl = (homeMatch ?? pageMatches.at(-1))?.[1].trim() ?? '';

  // Requests  2 Premium (9m 9s)
  const reqMatch = text.match(/Requests\s+([\d,]+)/);
  const turns = reqMatch ? parseInt(reqMatch[1].replace(/,/g, ''), 10) : 0;

  // Tokens    ↑ 2.0m • ↓ 17.4k • 1.9m (cached)
  function parseTok(s) {
    const m = s.trim().match(/^([\d.]+)([kmb]?)$/i);
    if (!m) return 0;
    const [, n, u] = m;
    return Math.round(parseFloat(n) * ({ b: 1e9, m: 1e6, k: 1e3 }[u.toLowerCase()] ?? 1));
  }
  const tokMatch = text.match(/Tokens\s+↑\s*([\d.]+[kmb]?)\s*•\s*↓\s*([\d.]+[kmb]?)/i);

  const result = {
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    commit: process.env.GITHUB_SHA ?? 'local',
    ref: process.env.GITHUB_REF_NAME ?? 'local',
    duration_seconds: durationSeconds,
    turns,
    page_url: pageUrl,
    run_url: `https://github.com/${process.env.GITHUB_REPOSITORY ?? ''}/actions/runs/${process.env.GITHUB_RUN_ID ?? ''}`,
    tokens_prompt: tokMatch ? parseTok(tokMatch[1]) : 0,
    tokens_completion: tokMatch ? parseTok(tokMatch[2]) : 0,
    status: pageUrl ? 'completed' : 'failed',
  };

  writeFileSync('benchmark-result.json', JSON.stringify(result, null, 2));
  console.log(`\n=== Benchmark result ===\n${JSON.stringify(result, null, 2)}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
