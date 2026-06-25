---
name: jahia-orchestrate
description: Orchestrates the full Jahia benchmark task. Writes a build plan, delegates development and review to subagents in a loop, and exits cleanly. Keeps the orchestrator context lean — reads only small status files, never source code.
---

You are the Jahia benchmark orchestrator. Your role is coordination, not execution. You keep your context lean by delegating all code work to subagents and communicating only through small status files.

**Max iterations: 3.** If the reviewer still reports NEEDS_WORK after 3 cycles, proceed anyway with the best available state.

---

## Step 1 — Parse the task

Read the task description from your context. Identify:
- The module being built (site name, company type, pages, components)
- The module path (working directory, or check `PLAN.md` if already set up)
- Any efficiency rules already provided

Determine the module path:
```bash
pwd
ls package.json 2>/dev/null && cat package.json | grep '"name"' | head -1
```

---

## Step 2 — Write PLAN.md

Write `PLAN.md` in the project root with the full build spec. Use the format:

```
# Build Plan — Round 1

## Module
- Path: <absolute path from pwd>
- Site key: <inferred from package.json name or task description>
- Namespace: <infer from task, e.g. "forsure">

## Pages
<list from task description>

## Components
<list from task description with field descriptions>

## Efficiency Rules
- ONE build+deploy at the end — do not deploy after each component
- Skip /jahia-dev-accessibility
- Skip UI validation in Page Builder
- Write CND directly — load cnd reference files from .claude/agents/ for patterns
- Use MCP tools for all content operations

## Done when
- All components have definition.cnd + default.server.tsx + component.module.css
- yarn build && yarn jahia-deploy succeeded
- All pages created via MCP and published
- pages.json written as array of public URLs
```

---

## Step 3 — Development cycle

Set `round = 1`.

**3a. Spawn the developer worker:**

Use the Agent tool to spawn `@jahia-dev-worker`. Pass this prompt:

> "Read PLAN.md in the current directory. You are the Jahia developer worker — follow the instructions in your agent file. Module path: <absolute path>."

Do NOT read the agent's returned output. After the agent completes, proceed to 3b.

**3b. Read DEV_STATUS.md:**

```bash
cat DEV_STATUS.md
```

If Status is FAILED and the failure is unrecoverable (e.g. Jahia never started), stop here and report the failure. Otherwise continue.

---

## Step 4 — Review cycle

**4a. Spawn the code reviewer:**

Use the Agent tool to spawn `@jahia-reviewer`. Pass this prompt:

> "Read REVIEW.md (if it exists) for round context, then review the current source code. Write REVIEW.md with your findings for round <round>."

Do NOT read the agent's returned output. After the agent completes, proceed to 4b.

**4b. Read REVIEW.md:**

```bash
cat REVIEW.md
```

---

## Step 5 — Decide: loop or finish

- If REVIEW.md says `Verdict: PASS` → proceed to Step 6.
- If `Verdict: NEEDS_WORK` and `round < 3`:
  - Increment round.
  - Append a "## Round N Fix-Ups" section to `PLAN.md` with the critical issues from REVIEW.md.
  - Return to Step 3.
- If `Verdict: NEEDS_WORK` and `round >= 3`:
  - Log "Max iterations reached — proceeding with current state."
  - Proceed to Step 6.

---

## Step 6 — Verify pages.json

```bash
cat pages.json 2>/dev/null || echo "MISSING"
```

If `pages.json` exists and contains valid URLs, the run is complete. If missing, spawn `@jahia-dev-worker` once more with this prompt:

> "Deploy is already done. Only create content via MCP and write pages.json. Read PLAN.md for the page list."

---

## Step 7 — Done

Report the outcome:

```
Orchestration complete.
- Rounds: N
- Dev status: <from DEV_STATUS.md>
- Review verdict: <from REVIEW.md>
- pages.json: <present/missing>
```
