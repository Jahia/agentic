# CrumbleCo Benchmark

Measures how reliably the Jahia skills produce a working website, and tracks improvement over time.

**Task:** build a full CrumbleCo biscuit showcase site (homepage, 3 product pages, contact, blog with 3 posts) from a single prompt in yolo mode.

**Artifacts captured per run:** duration, token counts, cost, screenshots of every page, JSON result summary.

---

## Running locally

**Prerequisites**

- Node 22 (`node --version`)
- Docker with Compose v2 (`docker compose version`)
- [Claude Code CLI](https://docs.anthropic.com/claude-code) (`claude --version`)
- `ANTHROPIC_API_KEY` in your environment

**One-time setup**

```bash
# From repo root
cp -r benchmark/module-template crumbleco
cd crumbleco && yarn install && cd ..

# Install Playwright (for screenshots)
cd benchmark && npm install && npx playwright install chromium && cd ..
```

**Run**

```bash
export ANTHROPIC_API_KEY=sk-...
./benchmark/run.sh "$(pwd)/crumbleco"
```

The script will:
1. Start Jahia via `docker compose up --wait`
2. Build and deploy the base module
3. Create the `crumbleco` virtual site if it doesn't exist
4. Run Claude with `--dangerously-skip-permissions` and the task prompt
5. Parse token usage and cost from the stream-json output
6. Capture full-page screenshots of every page Claude reports back
7. Write `benchmark/results/latest.json` and append to `benchmark/results/runs.json`

Results land in `benchmark/results/` (gitignored except for `.gitkeep`).

---

## CI

The `benchmark` workflow (`.github/workflows/benchmark.yml`) triggers on:
- Manual dispatch (`workflow_dispatch`)
- Push to `main` that touches `src/harness/skills/**` or `benchmark/**`

Results are uploaded as a GitHub Actions artifact (`benchmark-<run>-<sha>`) and retained for 30 days.

**Required secret:** `ANTHROPIC_API_KEY` — set in the repository's _Settings → Secrets and variables → Actions_.

---

## Result schema

```json
{
  "timestamp": "2025-01-01T12:00:00Z",
  "run_id": "20250101-120000",
  "duration_seconds": 420,
  "tokens_input": 180000,
  "tokens_output": 12000,
  "cost_usd": 1.23,
  "status": "completed",
  "pages_found": 10,
  "pages": {
    "home": "http://localhost:8080/sites/crumbleco/home.html",
    "blog": "http://localhost:8080/sites/crumbleco/blog.html"
  },
  "screenshots_dir": "results/screenshots/20250101-120000",
  "log": "results/output-20250101-120000.log"
}
```

`status` is one of `completed` (≥7 page URLs found), `partial` (1–6), or `failed` (0).
