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
import { homedir } from "node:os";
import { setTimeout } from "node:timers/promises";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import lighthouse from "lighthouse";
import type { BenchmarkRun, PageResult } from "./types.ts";
import { checkCndFiles } from "../harness/skills/jahia-dev-review-cnd/scripts/check-cnd.mjs";

const JAHIA_URL = "http://localhost:8080";
const AUTHORIZATION = `Basic ${Buffer.from("root:root1234").toString("base64")}`;

const repoRoot = resolve(import.meta.dirname, "..", "..");
const resultsDir = join(repoRoot, "results");
const resultsBranch = "results";

//#MARK: worktree

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

//#MARK: npm init

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

//#MARK: dc up

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
    const { status } = await fetch(`${JAHIA_URL}/cms/login`, {
      headers: { AUTHORIZATION },
      signal: AbortSignal.timeout(5000),
    });
    if (status === 200) {
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

//#MARK: provision

console.log("Provisioning mcp-servlet...");
const provisionYaml = JSON.stringify(
  [
    {
      addMavenRepository:
        "https://store.jahia.com/nexus/content/repositories/jahia-public-app-store@id=JahiaStore@update=always",
    },
    {
      addMavenRepository:
        "https://devtools.jahia.com/nexus/content/groups/public/@snapshots@noreleases@id=JahiaSnapshot@update=always",
    },
    {
      installBundle: ["mvn:org.jahia.modules/mcp-servlet"],
      autoStart: true,
      uninstallPreviousVersion: true,
    },
  ],
  null,
  2,
);
const provisioningResponse = await fetch(`${JAHIA_URL}/modules/api/provisioning`, {
  method: "POST",
  headers: {
    AUTHORIZATION,
    "Content-Type": "application/yaml",
  },
  body: provisionYaml,
  signal: AbortSignal.timeout(120_000),
});
console.log("Provisioning response status:", provisioningResponse.status);
console.log("Provisioning response:", await provisioningResponse.text());

// Wait for mcp-servlet to register (the MCP endpoint becomes available)
console.log("Waiting for MCP endpoint...");
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const { status } = await fetch(`${JAHIA_URL}/modules/mcp`, {
      method: "POST",
      headers: {
        AUTHORIZATION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (attempt % 5 === 0) {
      console.log(`  attempt ${attempt + 1}/30: HTTP ${status}`);
    }
    if (status === 200) {
      console.log("MCP endpoint is ready.");
      // Extract mcp-servlet version from Jahia docker logs
      try {
        const logs = execSync(
          "docker compose logs jahia --no-color 2>/dev/null | grep 'Finished starting DX OSGi bundle mcp-servlet' | tail -1",
          { cwd: root, encoding: "utf-8", timeout: 10000 },
        );
        const versionMatch = logs.match(/mcp-servlet v([\d.]+\S*)/);
        if (versionMatch) {
          console.log(`mcp-servlet installed version: ${versionMatch[1]}`);
        }
      } catch {
        // Best-effort — version logging should never block the benchmark
      }
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

//#MARK: API token

console.log("Creating personal API token...");
const tokenMutation = JSON.stringify({
  query: `mutation { admin { personalApiTokens { createToken(name: "agentic-benchmark", state: ACTIVE) } } }`,
});
const patResponse = await fetch(`${JAHIA_URL}/modules/graphql`, {
  method: "POST",
  headers: {
    AUTHORIZATION,
    "Content-Type": "application/json",
    Origin: JAHIA_URL,
  },
  body: tokenMutation,
  signal: AbortSignal.timeout(15_000),
});
const tokenData = (await patResponse.json()) as any;
const apiToken = tokenData?.data?.admin?.personalApiTokens?.createToken as string | undefined;
if (!apiToken) {
  console.error("Failed to create API token:", tokenData);
  process.exit(1);
}
console.log("API token created successfully.");

//#MARK: MCP config

// Write to ~/.claude.json — the global config Claude Code reads for MCP server discovery.
// Merge with any existing content to avoid clobbering other settings.
const claudeConfigPath = join(homedir(), ".claude.json");
const existingClaudeConfig = existsSync(claudeConfigPath)
  ? (JSON.parse(readFileSync(claudeConfigPath, "utf-8")) as Record<string, unknown>)
  : {};
const claudeConfig = {
  ...existingClaudeConfig,
  mcpServers: {
    ...(existingClaudeConfig["mcpServers"] as Record<string, unknown>),
    jahia: {
      type: "http",
      url: `${JAHIA_URL}/modules/mcp`,
      headers: {
        Authorization: `APIToken ${apiToken}`,
      },
    },
  },
};
writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
console.log("MCP config written to ~/.claude.json");

//#MARK: install harness

spawnSync("node", [resolve(import.meta.dirname, "..", "..", "dist"), "claude"], {
  cwd: root,
  stdio: "inherit",
});

//#MARK: claude

// Run claude, streaming stdout live while capturing it for stats parsing
const claudeProc = spawn(
  "claude",
  [
    "--print",
    "--verbose",
    "--dangerously-skip-permissions",
    "--model",
    "claude-sonnet-4-6",
    "--max-turns",
    "500",
    "--output-format",
    "stream-json",
    "Read ./prompt.md and follow the instructions.",
  ],
  {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env },
  },
);

let claudeOutput = "";
claudeProc.stdout.on("data", (chunk: Buffer) => {
  const text = chunk.toString();
  claudeOutput += text;
  process.stdout.write(text);
});
claudeProc.stderr.on("data", (chunk: Buffer) => {
  process.stderr.write(chunk);
});

await once(claudeProc, "exit");

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

console.log("Checking CND quality...");
const cndResult = checkCndFiles(root);
console.log(
  `CND quality: score=${cndResult.score.toFixed(2)}, files=${cndResult.filesChecked}, issues=${cndResult.issues.length}`,
);

//#MARK: dc down

console.log("Stopping Jahia...");
spawnSync("docker", ["compose", "down", "--volumes"], {
  cwd: root,
  stdio: "inherit",
  timeout: 60_000,
});

// Parse token usage and duration from claude's stream-json output.
// The final line has type "result" with duration_ms and usage fields.
function parseStats(output: string): { durationSeconds: number; tokens: BenchmarkRun["tokens"] } {
  for (const line of output.trim().split("\n").reverse()) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (event["type"] === "result") {
        const usage = (event["usage"] as Record<string, number>) ?? {};
        return {
          durationSeconds: Math.round(((event["duration_ms"] as number) ?? 0) / 1000),
          tokens: {
            input: usage["input_tokens"] ?? 0,
            output: usage["output_tokens"] ?? 0,
            cached: usage["cache_read_input_tokens"] ?? 0,
          },
        };
      }
    } catch {
      // not a JSON line
    }
  }
  return { durationSeconds: 0, tokens: { input: 0, output: 0, cached: 0 } };
}

const { durationSeconds, tokens } = parseStats(claudeOutput);

// Extract branch name from GITHUB_REF (format: refs/heads/branch-name) or default to "main"
function extractBranch(githubRef?: string): string {
  if (!githubRef) return "main";
  const match = githubRef.match(/refs\/heads\/(.+)$/);
  return match?.[1] ?? "main";
}

const branch = extractBranch(process.env["GITHUB_REF"]);

//#MARK: git commit

const gitOpts = { cwd: resultsDir, stdio: "inherit" } as const;
const gitCI = [
  "-c",
  "user.name=GitHub Actions",
  "-c",
  "user.email=github-actions@github.com",
] as const;

// Pull latest before reading benchmark.json — concurrent CI runs both write it;
// without this pull the second writer clobbers the first entry.
spawnSync("git", ["pull", "origin", resultsBranch], { cwd: resultsDir, stdio: "inherit" });

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
  branch,
  pages,
  cndQualityScore: cndResult.filesChecked > 0 ? cndResult.score : null,
  cndIssues: cndResult.issues.length > 0 ? cndResult.issues : undefined,
};

existing.push(run);
writeFileSync(benchmarkPath, JSON.stringify(existing, null, 2));
console.log(`Run saved to results/${runId}`);

spawnSync("git", ["add", "benchmark.json", runId], gitOpts);
spawnSync("git", [...gitCI, "commit", "-m", `chore: benchmark run ${runId}`], gitOpts);

if (process.env["GITHUB_ACTIONS"]) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const push = spawnSync("git", ["push", "origin", resultsBranch], {
      cwd: resultsDir,
      stdio: "inherit",
    });
    if (push.status === 0) break;
    if (attempt === 4) {
      console.error("Failed to push results after 5 attempts");
      process.exit(1);
    }
    console.log(`Push attempt ${attempt + 1} rejected — pulling latest and retrying...`);
    // Undo our commit but keep screenshots; restore benchmark.json so the pull is clean
    spawnSync("git", ["reset", "--mixed", "HEAD~1"], { cwd: resultsDir, stdio: "inherit" });
    spawnSync("git", ["restore", "benchmark.json"], { cwd: resultsDir, stdio: "inherit" });
    spawnSync("git", ["pull", "origin", resultsBranch], { cwd: resultsDir, stdio: "inherit" });
    // Re-read fresh state and re-append our run
    const fresh: BenchmarkRun[] = existsSync(benchmarkPath)
      ? (JSON.parse(readFileSync(benchmarkPath, "utf-8")) as BenchmarkRun[])
      : [];
    if (!fresh.find((r) => r.id === run.id)) fresh.push(run);
    writeFileSync(benchmarkPath, JSON.stringify(fresh, null, 2));
    spawnSync("git", ["add", "benchmark.json", runId], gitOpts);
    spawnSync("git", [...gitCI, "commit", "-m", `chore: benchmark run ${runId}`], gitOpts);
  }
}
