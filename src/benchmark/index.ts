import { spawn, spawnSync, execSync } from "node:child_process";
import { once } from "node:events";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import lighthouse from "lighthouse";
import type { BenchmarkRun, PageResult } from "./types.ts";

const JAHIA_URL = "http://localhost:8080";
const JAHIA_USER = "root";
const JAHIA_PASSWORD = "root1234";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const resultsDir = join(repoRoot, "results");
const resultsBranch = "results";

// ─── Results worktree setup ──────────────────────────────────────────────────

if (!existsSync(join(resultsDir, ".git"))) {
  spawnSync("git", ["fetch", "origin", resultsBranch], { cwd: repoRoot, stdio: "inherit" });
  spawnSync(
    "git",
    ["worktree", "add", "-b", resultsBranch, resultsDir, `origin/${resultsBranch}`],
    { cwd: repoRoot, stdio: "inherit" },
  );
} else {
  spawnSync("git", ["pull", "--rebase", "origin", resultsBranch], {
    cwd: resultsDir,
    stdio: "inherit",
  });
}

// ─── Benchmark run ───────────────────────────────────────────────────────────

const temp = mkdtempSync("agentic-benchmark-");
console.log(`Running benchmark in ${temp}`);

const child = spawn("npm", ["init", "@jahia/module@latest", "forsure"], {
  cwd: temp,
  stdio: ["pipe", "inherit", "inherit"],
});

await setTimeout(3000);
child.stdin.write("\r"); // Module name
await setTimeout(100);
child.stdin.write("\r"); // Path
await setTimeout(100);
child.stdin.write("\x1B[B\r"); // Empty template set
child.stdin.end();
await once(child, "exit");

const root = resolve(temp, "forsure");

if (process.env["GITHUB_OUTPUT"]) {
  appendFileSync(process.env["GITHUB_OUTPUT"], `project_dir=${root}\n`);
}

copyFileSync(resolve(import.meta.dirname, "prompt.md"), resolve(root, "prompt.md"));

// ─── Start Jahia ─────────────────────────────────────────────────────────────

console.log("Starting Jahia via docker compose...");
spawnSync("docker", ["compose", "up", "--wait"], {
  cwd: root,
  stdio: "inherit",
  timeout: 5 * 60 * 1000, // 5 min max for Jahia startup
});

// Wait for Jahia to be fully ready (tools API available)
console.log("Waiting for Jahia to be ready...");
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const status = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -u ${JAHIA_USER}:${JAHIA_PASSWORD} ${JAHIA_URL}/cms/login`,
      { encoding: "utf-8", timeout: 5000 },
    ).trim();
    if (status === "200") {
      console.log("Jahia is ready.");
      break;
    }
  } catch {
    // not ready yet
  }
  if (attempt === 59) {
    console.error("Jahia did not become ready within 5 minutes");
    process.exit(1);
  }
  await setTimeout(5000);
}

// ─── Provision mcp-servlet ───────────────────────────────────────────────────

console.log("Provisioning mcp-servlet...");
const provisionYaml = [
  "- addMavenRepository: 'https://store.jahia.com/nexus/content/repositories/jahia-public-app-store@id=JahiaStore'",
  "- addMavenRepository: 'https://devtools.jahia.com/nexus/content/groups/public/@snapshots@noreleases@id=JahiaSnapshot'",
  "- installBundle:",
  "    - 'mvn:org.jahia.modules/mcp-servlet'",
  "",
].join("\n");
const provisionResult = spawnSync(
  "curl",
  [
    "-s", "-w", "%{http_code}",
    "-u", `${JAHIA_USER}:${JAHIA_PASSWORD}`,
    "-X", "POST",
    "-H", "Content-Type: application/yaml",
    "--data-binary", provisionYaml,
    `${JAHIA_URL}/modules/api/provisioning`,
  ],
  { encoding: "utf-8", timeout: 120_000 },
);
console.log("Provisioning response:", provisionResult.stdout);

// Wait for mcp-servlet to register (the MCP endpoint becomes available)
console.log("Waiting for MCP endpoint...");
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const resp = execSync(
      `curl -s -w "\n%{http_code}" -u ${JAHIA_USER}:${JAHIA_PASSWORD} -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' ${JAHIA_URL}/modules/mcp`,
      { encoding: "utf-8", timeout: 10000 },
    );
    const lines = resp.trim().split("\n");
    const statusCode = lines[lines.length - 1];
    if (attempt % 5 === 0) {
      console.log(`  attempt ${attempt + 1}/30: HTTP ${statusCode}`);
    }
    if (statusCode === "200") {
      console.log("MCP endpoint is ready.");
      break;
    }
  } catch {
    if (attempt % 5 === 0) {
      console.log(`  attempt ${attempt + 1}/30: connection failed`);
    }
  }
  if (attempt === 29) {
    console.error("MCP endpoint did not become available");
    process.exit(1);
  }
  await setTimeout(3000);
}

// ─── Create API token ────────────────────────────────────────────────────────

console.log("Creating personal API token...");
const tokenMutation = JSON.stringify({
  query: `mutation { admin { personalApiTokens { createToken(name: "agentic-benchmark", state: ACTIVE) } } }`,
});
const tokenResponse = execSync(
  `curl -s -u ${JAHIA_USER}:${JAHIA_PASSWORD} -H "Content-Type: application/json" -H "Origin: ${JAHIA_URL}" -X POST ${JAHIA_URL}/modules/graphql -d '${tokenMutation.replace(/'/g, "'\\''")}'`,
  { encoding: "utf-8", timeout: 15000 },
);
const tokenData = JSON.parse(tokenResponse);
const apiToken: string = tokenData?.data?.admin?.personalApiTokens?.createToken;
if (!apiToken) {
  console.error("Failed to create API token:", tokenResponse);
  process.exit(1);
}
console.log("API token created successfully.");

// ─── Write MCP config ────────────────────────────────────────────────────────

const mcpConfigDir = join(root, ".github", "copilot");
mkdirSync(mcpConfigDir, { recursive: true });
const mcpConfig = {
  servers: {
    "my-jahia": {
      type: "http",
      url: `${JAHIA_URL}/modules/mcp`,
      headers: {
        Authorization: `APIToken ${apiToken}`,
      },
    },
  },
};
writeFileSync(join(mcpConfigDir, "mcp.json"), JSON.stringify(mcpConfig, null, 2));
console.log("MCP config written to .github/copilot/mcp.json");

// ─── Install harness ─────────────────────────────────────────────────────────

spawnSync("node", [resolve(import.meta.dirname, "..", "..", "dist"), "copilot"], {
  cwd: root,
  stdio: "inherit",
});

// ─── Run copilot ─────────────────────────────────────────────────────────────

// Run copilot, streaming stdout live while capturing it for stats parsing
const copilotProc = spawn(
  "copilot",
  ["--autopilot", "--allow-all", "--model", "claude-sonnet-4.6", "--prompt", "Read ./prompt.md and follow the instructions."],
  {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, GH_TOKEN: process.env["COPILOT_TOKEN"] },
  },
);

let copilotOutput = "";
copilotProc.stdout.on("data", (chunk: Buffer) => {
  const text = chunk.toString();
  copilotOutput += text;
  process.stdout.write(text);
});
copilotProc.stderr.on("data", (chunk: Buffer) => {
  const text = chunk.toString();
  copilotOutput += text;
  process.stderr.write(text);
});

await once(copilotProc, "exit");

const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
const runDir = join(resultsDir, runId);
mkdirSync(runDir, { recursive: true });

if (!existsSync(resolve(root, "pages.json"))) {
  console.error("Benchmark failed: pages.json not found");
  process.exit(1);
}

const rawPages = readFileSync(resolve(root, "pages.json"), "utf-8");
console.log("pages.json:", rawPages);

const urls: string[] = JSON.parse(rawPages);

const port = 1337;
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${port}`],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const pages: PageResult[] = [];

const impacts = { minor: 0.1, moderate: 0.25, serious: 0.5, critical: 1 };

for (const [i, rawUrl] of urls.entries()) {
  const url = new URL(rawUrl, "http://localhost:8080");
  console.log(`Navigating to ${url}...`);
  await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30_000 });
  const title = await page.title();
  console.log(`Taking a screenshot of ${title}...`);
  const screenshot = `screenshot-${i}.png`;
  await page.screenshot({ fullPage: true, path: join(runDir, screenshot) });
  console.log(`Analyzing accessibility of ${title}...`);
  const axe = new AxeBuilder({ page });
  const results = await axe.analyze();
  const accessibilityScore = Math.exp(
    -results.violations.reduce((t, { impact }) => t + (impact ? impacts[impact] : 0.01), 0),
  );
  console.log(`Running Lighthouse for ${title}...`);
  const result = await lighthouse(url.toString(), {
    port,
    output: "json",
    onlyCategories: ["seo"],
  });
  const seoScore = result?.lhr.categories.seo?.score ?? 0;
  console.log(
    `Results for ${title}: Accessibility Score = ${accessibilityScore.toFixed(2)}, SEO Score = ${seoScore.toFixed(2)}`,
  );
  pages.push({
    url: url.toString(),
    title,
    screenshot,
    accessibilityScore,
    seoScore,
  });
}

await browser.close();

// ─── Stop Jahia ──────────────────────────────────────────────────────────────

console.log("Stopping Jahia...");
spawnSync("docker", ["compose", "down", "--volumes"], {
  cwd: root,
  stdio: "inherit",
  timeout: 60_000,
});

// Parse token usage and duration from copilot's stdout summary
function parseStats(output: string): { durationSeconds: number; tokens: BenchmarkRun["tokens"] } {
  const durationMatch = output.match(/\((\d+)m\s+(\d+)s\)/);
  const durationSeconds = durationMatch
    ? parseInt(durationMatch[1]!) * 60 + parseInt(durationMatch[2]!)
    : 0;

  function parseCount(s: string): number {
    const n = parseFloat(s);
    const suffix = s.slice(-1).toLowerCase();
    if (suffix === "m") return Math.round(n * 1_000_000);
    if (suffix === "k") return Math.round(n * 1_000);
    return Math.round(n);
  }

  const tokensMatch = output.match(
    /↑\s*([\d.]+[mk]?)\s*•\s*↓\s*([\d.]+[mk]?)\s*•\s*([\d.]+[mk]?)\s*\(cached\)/i,
  );
  const tokens = tokensMatch
    ? {
        input: parseCount(tokensMatch[1]!),
        output: parseCount(tokensMatch[2]!),
        cached: parseCount(tokensMatch[3]!),
      }
    : { input: 0, output: 0, cached: 0 };

  return { durationSeconds, tokens };
}

const { durationSeconds, tokens } = parseStats(copilotOutput);

const benchmarkPath = join(resultsDir, "benchmark.json");
const existing: BenchmarkRun[] = existsSync(benchmarkPath)
  ? (JSON.parse(readFileSync(benchmarkPath, "utf-8")) as BenchmarkRun[])
  : [];

const run: BenchmarkRun = {
  id: runId,
  date: new Date().toISOString(),
  durationSeconds,
  tokens,
  githubRunUrl: process.env["GITHUB_RUN_URL"] || undefined,
  pages,
};

existing.push(run);
writeFileSync(benchmarkPath, JSON.stringify(existing, null, 2));
console.log(`Run saved to results/${runId}`);

// ─── Commit results to the worktree ─────────────────────────────────────────

const gitOpts = { cwd: resultsDir, stdio: "inherit" } as const;
const gitCI = [
  "-c",
  "user.name=GitHub Actions",
  "-c",
  "user.email=github-actions@github.com",
] as const;

spawnSync("git", ["add", "benchmark.json", runId], gitOpts);
spawnSync("git", [...gitCI, "commit", "-m", `chore: benchmark run ${runId}`], gitOpts);

if (process.env["GITHUB_ACTIONS"]) {
  spawnSync("git", ["push", "origin", resultsBranch], { cwd: resultsDir, stdio: "inherit" });
}
