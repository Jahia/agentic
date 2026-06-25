# Agentic Harness Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Jahia benchmark harness so a lean orchestrator agent manages a developer/reviewer loop via file-based communication, preventing context-window bloat.

**Architecture:** The main `claude` process (orchestrator) reads `prompt.md`, writes a structured `PLAN.md`, then spawns two subagents in a loop: `@jahia-dev-worker` (CND + views + CSS + deploy) and `@jahia-reviewer` (code review). Agents communicate exclusively through three small files (`PLAN.md`, `DEV_STATUS.md`, `REVIEW.md`) so the orchestrator never reads source code — only status summaries.

**Tech Stack:** Claude Code agent system (`.claude/agents/*.md`), Claude Code skills (`.claude/skills/*/SKILL.md`), APM harness compilation, TypeScript benchmark runner.

## Global Constraints

- All source edits go in `src/harness/` — the build step compiles them to `dist/claude/`
- `yarn lint && yarn build` must pass before any commit
- Do NOT run `yarn benchmark` — that is the full 45-minute CI run
- Agent files use APM front-matter: `name`, `description`, `allowed-tools`
- Skills use APM front-matter: `name`, `description`
- The compilation target for verification is Claude Code only (`dist/claude/.claude/`)
- `results/benchmark.json` must NOT be modified in this work

---

## File Map

### Created
- `src/harness/agents/jahia-dev-worker/jahia-dev-worker.agent.md` — developer subagent; reads `PLAN.md`, builds components, deploys, creates content, writes `DEV_STATUS.md`
- `src/harness/agents/jahia-reviewer/jahia-reviewer.agent.md` — reviewer subagent; reads source, applies `/jahia-dev-review` criteria, writes `REVIEW.md`
- `src/harness/skills/jahia-orchestrate/SKILL.md` — orchestrator skill; writes `PLAN.md`, drives dev→review loop, writes `pages.json`

### Modified
- `src/benchmark/prompt.md` — replace `/jahia` with `/jahia-orchestrate`; add module-path hint

---

## Communication Protocol

All files are written/read in the **project root** (the module being built, e.g. `/tmp/agentic-benchmark-XXXXX/forsure/`).

### `PLAN.md` — Orchestrator → Worker
```markdown
# Build Plan — Round N

## Module
- Path: <absolute path>
- Site key: forsure
- Namespace: <ns>

## Pages
- Homepage: hero section + product grid + testimonials
- Car Insurance product page
- Health Insurance product page
- Home Insurance product page

## Components
- HeroSection: hero image, title (mix:title), subtitle, CTA
- SectionContainer: 1/2/3 columns, accepts TextCard and MediaCard children
- TextCard: title, body, CTA link
- MediaCard: image (weakreference), title, body, CTA
- TestimonialSection: list of Testimonial child nodes
- Testimonial: quote, author name, author title

## Efficiency Rules
- ONE build+deploy at the end — do not deploy after each component
- Skip /jahia-dev-accessibility
- Skip UI validation in Page Builder
- CND: write directly, skip @jahia-cnd-author (follow CND patterns from .claude/agents/cnd-jahia-mixins.md)

## Round N Fix-Ups (only present from round 2+)
<reviewer findings that must be fixed>

## Done when
- All components have definition.cnd + default.server.tsx + component.module.css
- `yarn build && yarn jahia-deploy` succeeded (exit 0)
- All pages created via MCP and published
- pages.json written: ["http://localhost:8080/cms/render/live/en/sites/forsure/home.html", ...]
```

### `DEV_STATUS.md` — Worker → Orchestrator
```markdown
# Dev Status

## Status
COMPLETE | FAILED

## Components built
- forsure:heroSection ✓
- forsure:sectionContainer ✓
...

## Deploy
SUCCESS | FAILED

## Content
- 4 pages created and published ✓ | SKIPPED | FAILED

## pages.json written
YES | NO

## Notes
<any errors or skipped items>
```

### `REVIEW.md` — Reviewer → Orchestrator
```markdown
# Code Review — Round N

## Verdict
PASS | NEEDS_WORK

## Critical Issues (must fix)
- [C1] src/components/Hero/definition.cnd — jmix:droppableContent used directly
  Fix: extend namespacemix:component instead

## Warnings (fix if time allows)
...

## Suggestions (informational, do not re-deploy for these)
...
```

---

## Task 1: Developer Worker Agent

**Files:**
- Create: `src/harness/agents/jahia-dev-worker/jahia-dev-worker.agent.md`

**Interfaces:**
- Consumes: `PLAN.md` in the working directory
- Produces: `DEV_STATUS.md` in the working directory; all source files; deployed module

- [ ] **Step 1: Create the agent file**

```markdown
---
name: jahia-dev-worker
description: Developer worker for the Jahia benchmark. Reads PLAN.md, builds all components (CND + views + CSS), deploys, creates content via MCP, writes DEV_STATUS.md. Invoked by the orchestrator.
allowed-tools: Read, Write, Edit, Bash
tools:
  Read: true
  Write: true
  Edit: true
  Bash: true
---

You are the Jahia developer worker. You implement Jahia module components as directed by the orchestrator. Your context window is precious — do not read files you don't need.

## Step 0 — Read your plan

```bash
cat PLAN.md
```

Parse the plan carefully. Note:
- Module path
- Components to build
- Efficiency rules (follow them exactly)
- Round N Fix-Ups section (present from round 2 — fix these and ONLY these before re-deploying)

---

## Step 1 — Load CND reference files

```bash
find . -maxdepth 4 -name "cnd-jahia-mixins*" 2>/dev/null | head -3
```

Read the file found. Also read `cnd-string-selectors.md` (links, choices) and `cnd-child-nodes.md` (repeatable children) from the same directory.

---

## Step 2 — Resolve namespace

```bash
grep "^<" settings/definitions.cnd | head -5
grep "pageComponent" settings/definitions.cnd
ls src/components/
```

Note the namespace prefix and whether `namespacemix:pageComponent` exists.

---

## Step 3 — Build all components

For **each component** in the plan:

1. Create `src/components/<Category>/<Name>/definition.cnd`
   - Namespace declarations at top
   - Extend `namespacemix:pageComponent` (for page-area components) or `namespacemix:component` (for children)
   - Use `mix:title` for titles, NOT `- title (string)`
   - Use `(weakreference, picker[type='image']) < jmix:image` for images
   - Use `j:linkType (string, choicelist[linkTypeInitializer]) mandatory` for links
   - Child items use `+ * (ns:childType) orderable`
   - i18n on ALL user-visible string/textarea/richtext properties

2. Create `src/components/<Category>/<Name>/types.ts`
   - All props use `?:` (optional) even if mandatory in CND
   - Import `JCRNodeWrapper` from `@jahia/javascript-modules-library` for node refs

3. Create `src/components/<Category>/<Name>/default.server.tsx`
   - Import `Props` from `./types.js`
   - Use semantic HTML: `<section>`, `<article>`, `<header>`, `<main>`
   - `<h1>` only once per page template; use `<h2>`/`<h3>` in components
   - Guard all props: `{prop?.value && <span>{prop.value}</span>}`
   - Guard node URLs: `prop["j:linknode"] ? buildNodeUrl(prop["j:linknode"]) : "#"`
   - `alt` text on every `<img>` using a CND string prop

4. Create `src/components/<Category>/<Name>/component.module.css`
   - Scoped CSS for the component
   - Mobile-first responsive
   - Colour contrast ≥ 4.5:1 for text on background

**Do not deploy between components.** Build everything first.

---

## Step 4 — Single deploy

```bash
yarn build && yarn jahia-deploy
```

If it fails, read the error, fix it, and retry. Record the outcome.

---

## Step 5 — Create content (only if deploy succeeded)

Use MCP tools (the `jahia` MCP server) to:
1. Discover the site key
2. Create the 4 pages (homepage + 3 product pages) as specified in PLAN.md
3. Create content nodes and populate them with realistic copy
4. Publish all pages

Verify pages are publicly accessible:
```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/cms/render/live/en/sites/forsure/home.html"
```
Expected: 200

---

## Step 6 — Write pages.json

Create `pages.json` in the project root with the array of public page URLs:

```json
["http://localhost:8080/cms/render/live/en/sites/forsure/home.html", "..."]
```

---

## Step 7 — Write DEV_STATUS.md

Write a `DEV_STATUS.md` file in the project root:

```
# Dev Status

## Status
COMPLETE

## Components built
<list each component and whether CND + view + CSS were created>

## Deploy
SUCCESS | FAILED — <error if failed>

## Content
<number> pages created and published | SKIPPED | FAILED — <error>

## pages.json written
YES | NO

## Notes
<any issues, skipped items, or errors>
```

Set Status to FAILED if deploy or content creation failed and could not be recovered.
```

- [ ] **Step 2: Verify the file exists and lint passes**

```bash
ls src/harness/agents/jahia-dev-worker/jahia-dev-worker.agent.md
yarn lint
```

Expected: file exists, lint exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/harness/agents/jahia-dev-worker/jahia-dev-worker.agent.md
git commit -m "feat: add jahia-dev-worker agent for orchestrated benchmark"
```

---

## Task 2: Code Reviewer Agent

**Files:**
- Create: `src/harness/agents/jahia-reviewer/jahia-reviewer.agent.md`

**Interfaces:**
- Consumes: source files in `src/`, `settings/`; `DEV_STATUS.md` for context
- Produces: `REVIEW.md` in the working directory

- [ ] **Step 1: Create the agent file**

```markdown
---
name: jahia-reviewer
description: Code review agent for the Jahia benchmark. Reads the module source and writes REVIEW.md with findings from the jahia-dev-review criteria. Invoked by the orchestrator after each dev cycle.
allowed-tools: Read, Bash
tools:
  Read: true
  Bash: true
---

You are the Jahia code reviewer. Your job is to read the module source and report findings. You do NOT fix anything — you only report. Keep your analysis focused and your output concise.

## Step 1 — Collect files to review

```bash
find src/ -name "definition.cnd" | sort
find src/ -name "*.server.tsx" | sort
find src/ -name "types.ts" | sort
cat settings/definitions.cnd
```

Read ALL of the above files before forming any conclusions.

---

## Step 2 — Run critical checks

Scan for each of these. Report only what you actually find — do not guess or infer.

### 🔴 CRITICAL (must fix — causes broken pages or editor UX)

**C1** — Any concrete CND type (not a mixin) extending `jmix:droppableContent` directly
```bash
grep -rn "jmix:droppableContent" src/ --include="*.cnd" | grep -v "mixin"
```

**C2** — `fullPage` view with `componentType: "template"`
```bash
grep -rn "fullPage" src/ --include="*.server.tsx" | head -10
```

**C3** — CND type explicitly declaring `j:linknode` or `j:url` fields
```bash
grep -rn "j:linknode\|j:url" src/ --include="*.cnd"
```

**C4** — View using `j:linkType` value directly as an `href`
```bash
grep -rn "j:linkType" src/ --include="*.server.tsx" --include="*.client.tsx"
```

**C8** — All `<Area>` elements using the same generic `nodeType`
```bash
grep -rn "nodeType" src/templates/ --include="*.server.tsx"
```

### 🟡 WARNINGS (fix if time allows)

**W1** — User-visible CND string/textarea without `i18n`
```bash
grep -rn "(string\|textarea\|richtext)" src/ --include="*.cnd" | grep -v "i18n\|j:linkType\|j:url\|j:linknode"
```

**W4** — Props typed as required (not `?:`) in types.ts
```bash
grep -rn ": string\b\|: number\b\|: boolean\b" src/ --include="types.ts" | grep -v "?:"
```

**W9** — Hardcoded URLs in views
```bash
grep -rn 'href="http\|href="/\|href=`/' src/ --include="*.server.tsx" --include="*.client.tsx"
```

---

## Step 3 — Write REVIEW.md

Write `REVIEW.md` in the project root. Be specific: include file path and line content for each finding.

```
# Code Review — Round <N>

## Verdict
PASS | NEEDS_WORK

(PASS if zero Critical issues. NEEDS_WORK if any Critical issue found.)

## Critical Issues (must fix before next deploy)
- [C1] src/components/Hero/definition.cnd:5 — extends jmix:droppableContent directly
  Fix: change to extend namespacemix:pageComponent

(Write "None" if no critical issues.)

## Warnings (fix if time allows, do NOT redeploy just for these)
...

## Suggestions (informational only)
...

## Summary
- Critical: N | Warnings: N | Suggestions: N
```

Set Verdict to PASS only if there are **zero Critical issues**. Warnings and suggestions alone do not block.
```

- [ ] **Step 2: Verify file exists and lint passes**

```bash
ls src/harness/agents/jahia-reviewer/jahia-reviewer.agent.md
yarn lint
```

Expected: file exists, lint exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/harness/agents/jahia-reviewer/jahia-reviewer.agent.md
git commit -m "feat: add jahia-reviewer agent for orchestrated benchmark"
```

---

## Task 3: Orchestrator Skill

**Files:**
- Create: `src/harness/skills/jahia-orchestrate/SKILL.md`

**Interfaces:**
- Consumes: initial task description in agent context (from prompt.md)
- Produces: `PLAN.md`, `DEV_STATUS.md`, `REVIEW.md` (via subagents); `pages.json`

- [ ] **Step 1: Create the skill file**

```markdown
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
```

- [ ] **Step 2: Verify file exists and lint passes**

```bash
ls src/harness/skills/jahia-orchestrate/SKILL.md
yarn lint
```

Expected: file exists, lint exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/harness/skills/jahia-orchestrate/SKILL.md
git commit -m "feat: add jahia-orchestrate skill for multi-agent benchmark loop"
```

---

## Task 4: Update prompt.md and Build

**Files:**
- Modify: `src/benchmark/prompt.md`
- Verify: `dist/claude/.claude/` compiled correctly

**Interfaces:**
- Consumes: existing prompt.md structure
- Produces: prompt.md that invokes `/jahia-orchestrate` instead of `/jahia`

- [ ] **Step 1: Replace the entry skill in prompt.md**

In `src/benchmark/prompt.md`, replace the first line:
```
/jahia
```
with:
```
/jahia-orchestrate
```

Keep everything else unchanged. The orchestrator skill will read the rest of the file as its task description.

- [ ] **Step 2: Run build to compile all agents and skills**

```bash
yarn build
```

Expected: exits 0. Check that compiled files exist:

```bash
ls dist/claude/.claude/agents/jahia-dev-worker.md
ls dist/claude/.claude/agents/jahia-reviewer.md
ls dist/claude/.claude/skills/jahia-orchestrate/SKILL.md
```

- [ ] **Step 3: Verify lint**

```bash
yarn lint
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/benchmark/prompt.md dist/
git commit -m "feat: wire orchestration into benchmark prompt; rebuild dist"
```

---

## Self-Review

**Spec coverage:**
- ✅ Top agent coordinates jobs → `/jahia-orchestrate` skill (Task 3)
- ✅ First subagent does dev work → `jahia-dev-worker` (Task 1)
- ✅ Second subagent does review → `jahia-reviewer` (Task 2)
- ✅ Loop without filling orchestrator context → file-based communication, Agent tool used but output not relied upon
- ✅ Communication through files → PLAN.md, DEV_STATUS.md, REVIEW.md

**Placeholder scan:** None found. All agent steps have concrete bash commands and explicit file formats.

**Type consistency:** No shared types across tasks — each agent file is standalone prose.
