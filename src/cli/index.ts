#!/usr/bin/env node
import { argv } from "node:process";
import * as p from "@clack/prompts";
import { styleText } from "node:util";
import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";

const targets = ["claude", "copilot", "cursor", "codex", "gemini", "opencode", "windsurf"];
let target: string | undefined | symbol = argv[2];
const interactive = !target;

p.intro("@jahia/agentic");
p.log.message(
  "The goal of this CLI is to provide a fully functional harness for agentic development of Jahia modules.",
);

if (!target) {
  p.log.info(
    `You skip this prompt by running ${styleText("blueBright", "npx @jahia/agentic@latest <agent>")}`,
  );

  // Check if the workspace is git clean beforehand
  const gitStatus = spawnSync("git", ["status", "--porcelain"], { encoding: "utf-8" });
  if (gitStatus.error) p.log.error(`Failed to check git status: ${gitStatus.error.message}`);

  if (gitStatus.stdout.trim() !== "") {
    p.log.warn(
      "You have uncommitted changes in your workspace. It's safer to run this CLI on a clean workspace to avoid losing work.",
    );
    const confirm = await p.confirm({ message: "Do you want to continue?" });
    if (!confirm || p.isCancel(confirm)) {
      p.cancel("Come back soon!");
      process.exit(0);
    }
  }

  target = await p.select({
    message: "Which agent do you use?",
    options: [
      { value: "claude", label: "Claude", hint: "Will create CLAUDE.md and .claude/" },
      { value: "codex", label: "Codex", hint: "Will create AGENTS.md and .agents/" },
      { value: "copilot", label: "Copilot", hint: "Will create AGENTS.md, .agents/ and .github/" },
      { value: "cursor", label: "Cursor", hint: "Will create .agents/ and .cursor/" },
      { value: "gemini", label: "Gemini", hint: "Will create AGENTS.md, GEMINI.md and .agents/" },
      { value: "opencode", label: "OpenCode", hint: "Will create AGENTS.md and .agents/" },
      { value: "windsurf", label: "Windsurf", hint: "Will create AGENTS.md and .windsurf/" },
    ],
  });

  if (p.isCancel(target)) {
    p.cancel("Come back soon!");
    process.exit(0);
  }
}

if (!targets.includes(target)) {
  p.cancel(`Invalid target: ${target}\nValid targets are: ${targets.join(", ")}`);
  process.exit(1);
}

const src = resolve(import.meta.dirname, target);
const dst = process.cwd();

const entries = readdirSync(src, { withFileTypes: true, recursive: true });

const dirsToCreate = new Set<string>();
const filesToCopy: Array<{ src: string; dst: string }> = [];

for (const entry of entries) {
  // To avoid creating empty directories, we create them lazily when we encounter a file in them
  if (!entry.isFile()) continue;

  const relativePath = entry.parentPath.substring(src.length + 1);

  dirsToCreate.add(resolve(dst, relativePath));
  filesToCopy.push({
    src: resolve(entry.parentPath, entry.name),
    dst: resolve(dst, relativePath, entry.name),
  });
}

// Ensure dirsToCreate are not files
for (const dir of dirsToCreate) {
  const entry = statSync(dir, { throwIfNoEntry: false });
  if (entry?.isFile()) {
    p.cancel(`Cannot create directory ${dir} because a file with the same name exists.`);
    process.exit(1);
  }
}

// Count files to overwrite
let overwriteCount = 0;

for (const { src, dst } of filesToCopy) {
  try {
    accessSync(dst, constants.R_OK | constants.W_OK);
    const existingContent = readFileSync(dst, "utf-8");
    const newContent = readFileSync(src, "utf-8");
    if (existingContent !== newContent) overwriteCount++;
  } catch {
    // File doesn't exist, no problem
  }
}

if (interactive && overwriteCount > 0) {
  const confirm = await p.confirm({
    message: `There are ${overwriteCount} file${overwriteCount >= 2 ? "s" : ""} that will be overwritten. Do you want to continue?`,
  });
  if (!confirm || p.isCancel(confirm)) {
    p.cancel("Come back soon!");
    process.exit(0);
  }
} else if (overwriteCount > 0) {
  p.log.warn(
    `Harness already exists, ${overwriteCount} file${overwriteCount >= 2 ? "s" : ""} will be overwritten.`,
  );
}

// All good, do the actual copying
// mkdirSync(resolve(dst, relativePath), { recursive: true });
// copyFileSync(resolve(entry.parentPath, entry.name), resolve(dst, relativePath, entry.name));

for (const dir of dirsToCreate) {
  mkdirSync(dir, { recursive: true });
}

for (const { src, dst } of filesToCopy) {
  copyFileSync(src, dst);
}

p.outro(`Harness created successfully!

To update the harness in the future, run ${styleText("blueBright", "npx @jahia/agentic@latest " + target)}`);
