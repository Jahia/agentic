import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

const temp = mkdtempSync("agentic-benchmark-");
console.log(`Running benchmarks in ${temp}`);

const child = spawn("npm", ["init", "@jahia/module@latest", "crumb"], {
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

const root = resolve(temp, "crumb");

copyFileSync(resolve(import.meta.dirname, "prompt.md"), resolve(root, "prompt.md"));

spawnSync("node", [resolve(import.meta.dirname, "..", "..", "dist"), "copilot"], {
  cwd: root,
  stdio: "inherit",
});

spawnSync(
  "copilot",
  ["--autopilot", "--allow-all", "--prompt", "Read ./prompt.md and follow the instructions."],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (existsSync(resolve(root, "pages.json"))) {
  console.log("Benchmark successful!");
  const pages = readFileSync(resolve(root, "pages.json"), "utf-8");
  console.log("Pages:", pages);
}
