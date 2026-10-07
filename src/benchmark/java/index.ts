import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { parseStats, runClaude } from "../claude.ts";
import { printChecks, scoreQuoteModule } from "./score.ts";

// The Java scenario: the agent writes and deploys a Java module, then score.ts checks it over HTTP.

const JAHIA_URL = "http://localhost:8080";

const root = mkdtempSync(join(tmpdir(), "agentic-benchmark-java-"));
console.log(`Running the Java benchmark in ${root}`);
if (process.env["GITHUB_OUTPUT"]) {
  appendFileSync(process.env["GITHUB_OUTPUT"], `project_dir=${root}\n`);
}

copyFileSync(resolve(import.meta.dirname, "prompt.md"), resolve(root, "prompt.md"));
copyFileSync(resolve(import.meta.dirname, "compose.yml"), resolve(root, "compose.yml"));

console.log("Starting Jahia via docker compose...");
spawnSync("docker", ["compose", "up", "--wait"], { cwd: root, stdio: "inherit", timeout: 10 * 60 * 1000 });

for (let attempt = 0; ; attempt++) {
  try {
    const { status } = await fetch(`${JAHIA_URL}/sites/systemsite/home.html`, { signal: AbortSignal.timeout(5000) });
    if (status === 200) break;
  } catch {
    // not ready yet
  }
  if (attempt === 60) {
    console.error("Jahia did not become ready within 5 minutes");
    process.exit(1);
  }
  await setTimeout(5000);
}
console.log("Jahia is ready.");

spawnSync("node", [resolve(import.meta.dirname, "..", "..", "..", "dist"), "claude"], { cwd: root, stdio: "inherit" });

const output = await runClaude(root, "Read ./prompt.md and follow the instructions.");
const { durationSeconds, costUSD } = parseStats(output);

const checks = await scoreQuoteModule(root, JAHIA_URL);
const report = `${printChecks(checks)}\n\nAgent: ${durationSeconds} s, $${costUSD.toFixed(2)}\n`;
console.log(report);
if (process.env["GITHUB_STEP_SUMMARY"]) {
  appendFileSync(process.env["GITHUB_STEP_SUMMARY"], report);
}

spawnSync("docker", ["compose", "down", "--volumes"], { cwd: root, stdio: "inherit", timeout: 60_000 });

process.exit(checks.every((check) => check.passed) ? 0 : 1);
