import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const targets = ["claude", "copilot", "cursor", "codex", "gemini", "opencode", "windsurf"];
const harness = resolve(import.meta.dirname, "..", "harness");
const dist = resolve(import.meta.dirname, "..", "..", "dist");

rmSync(dist, { recursive: true, force: true });

for (const target of targets) {
  mkdirSync(join(dist, target), { recursive: true });
  spawnSync("cp", ["-r", harness, join(dist, target, ".apm")], { stdio: "inherit" });
  writeFileSync(
    join(dist, target, "apm.yml"),
    JSON.stringify({
      name: "Jahia harness",
      version: "1.0.0",
      description: "Jahia harness for agentic development",
      author: "Jahia",
      includes: "auto",
    }),
  );
  const opt = { cwd: join(dist, target), stdio: "inherit" } as const;
  spawnSync("apm", ["compile", "--target", target], opt);
  spawnSync("apm", ["install", "--runtime", target, "--target", target], opt);
  rmSync(join(dist, target, ".apm"), { recursive: true, force: true });
  rmSync(join(dist, target, "apm_modules"), { recursive: true, force: true });
  rmSync(join(dist, target, ".gitignore"), { force: true });
  rmSync(join(dist, target, "apm.yml"), { force: true });
  rmSync(join(dist, target, "apm.lock.yaml"), { force: true });
}

export {};
