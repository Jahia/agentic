# AGENTS.md — `@jahia/agentic`

This document helps AI agents understand the structure and conventions of this repository.

## What this repo does

`@jahia/agentic` is an **agentic harness CLI** for Jahia JavaScript module development. It ships a curated set of skills, instructions, prompts, and agent configs for AI coding agents. Running `npx @jahia/agentic@latest` installs the harness into a Jahia project.

The harness is compiled (via [Microsoft APM](https://microsoft.github.io/apm/)) from the raw primitives in `src/harness/` into agent-specific files for Claude, Copilot, Cursor, Codex, Gemini, OpenCode, and Windsurf.

---

## Repository layout

```
src/
  harness/              ← Source of truth for the harness
    instructions/       ← Long-lived agent behaviour rules (.instructions.md)
    skills/             ← Slash-command skills; one folder per skill, each has SKILL.md
  benchmark/            ← Automated benchmark: scaffolds a Jahia project, runs the agent, scores the output
    prompt.md           ← Task given to the agent during the benchmark run
    index.ts            ← Benchmark runner (Node.js script)
    types.ts            ← BenchmarkRun / PageResult types
  build/
    index.ts            ← Build script: compiles harness for all targets via APM, then bundles the CLI
  cli/
    index.ts            ← Interactive CLI entry point (npx @jahia/agentic)
dist/                   ← Build output (committed, published to npm)
results/                ← Git worktree on the `results` branch; benchmark history stored here
```

---

## Build & validation

```bash
yarn install            # install dependencies
yarn build              # compile harness + bundle CLI → dist/
yarn lint               # tsc --noEmit + oxlint
yarn benchmark          # run the full benchmark (requires COPILOT_TOKEN env var + running Jahia)
```

> `yarn build` calls `node src/build/index.ts` which runs APM for each target and bundles `src/cli/index.ts` with rolldown.

---

## Harness structure

### Instructions (`src/harness/instructions/`)

- `jahia.instructions.md` — Always-on agent principles. Loaded by every agent as persistent context.

### Skills (`src/harness/skills/`)

Each folder is a skill. The folder name becomes the slash command (e.g. `jahia-dev-build-component` → `/jahia-dev-build-component`). Each skill contains a single `SKILL.md` file, optionally with a `references/` subfolder for supporting documentation.

Key skills:

| Skill | Purpose |
|---|---|
| `jahia` | Universal entry point — classifies the request and delegates |
| `jahia-dev` | Development GPS — detects project state, recommends next step |
| `jahia-dev-build-component` | Builds a complete component (CND + view + CSS) |
| `jahia-dev-define-content-type` | Authors a CND content type definition |
| `jahia-dev-create-view` | Implements a React view (`.server.tsx` + CSS Module) |
| `jahia-dev-create-page-template` | Creates a page template with Areas |
| `jahia-dev-accessibility` | WCAG 2.1 AA audit with axe-core + fixes |
| `jahia-content-create-content` | Creates Jahia sites, pages, and content via MCP tools |

---

## Benchmark

The benchmark CI job (`.github/workflows/benchmark.yml`) runs on every push to `main` when `src/benchmark/**` or `src/harness/**` changes.

**What it measures:**
- `accessibilityScore` — `exp(-sum(violation_impact))` per page; closer to 1 is better
- `seoScore` — Lighthouse SEO score (0–1)
- `durationSeconds` — total agent runtime

**Scoring formula for accessibility:**
```
score = Math.exp(-violations.reduce((t, { impact }) => t + impacts[impact], 0))
impacts = { minor: 0.1, moderate: 0.25, serious: 0.5, critical: 1 }
```

A score of `1.0` means zero violations; `0.607` ≈ one serious violation; `0.368` ≈ one critical violation.

**Failure condition:** If the agent does not produce a `pages.json` file within the 60-minute CI timeout, the benchmark job fails with no score.

**Benchmark history:** Stored as JSON in the `results` branch (`results/benchmark.json`) and visualised at [jahia.github.io/agentic](https://jahia.github.io/agentic/).

---

## Key conventions

- **TypeScript everywhere** — all source files are `.ts` / `.tsx`; use `node src/X/index.ts` directly (via `type: "module"` + tsx loader)
- **`yarn lint`** runs `tsc --noEmit && oxlint` — must pass before merging
- **`yarn build`** must succeed before pushing harness changes (it proves APM can compile all targets)
- **Skills are agent-agnostic** — write skills using APM SKILL.md format; the build step compiles them to agent-specific syntax
- **No `yarn dev` from agents** — enforced in global instructions; always use `yarn build && yarn jahia-deploy` for one-shot deploys
- **Accessibility budget** — the benchmark rewards a11y quality. Proactive semantic HTML in skills is preferred over post-hoc audits.

---

## Making harness changes

1. Edit the relevant file(s) in `src/harness/`
2. Run `yarn lint && yarn build` to validate
3. The benchmark CI will automatically run on merge to `main` and record a new result

For skill additions, create a new folder under `src/harness/skills/<skill-name>/` with a `SKILL.md` file following the APM format (front-matter: `name`, `description`, `allowed-tools`).
