---
name: jahia-review-site
description: Scores live pages for accessibility and SEO, and fails a page that lost content since the last pass.
allowed-tools: Bash, Read, Write, Edit
---

# Skill: jahia-review-site

Reads URLs from `pages-to-review.json`, runs automated a11y and SEO checks, and — only if all checks pass — writes `pages.json`. Exits non-zero without writing `pages.json` if any violation is found.

**A11y:** axe-core full ruleset (WCAG + best-practice) — any violation fails.

**SEO:** Lighthouse SEO category — any failing audit fails. Violations reported by audit ID (e.g. `document-title`, `meta-description`, `hreflang`, `is-crawlable`, `link-text`, `image-alt`).

**Content:** each pass records the text length and the `<h2>` to `<h6>` count of each page's `<main>` in `review-pages-baseline.json`. A page that has fewer headings, or 30% less text, than at the last pass fails: a change hid content, for instance by moving it to an area the template does not render. Restore the content. Delete the file only when you removed content on purpose.

---

## Step 1 — Ensure tooling is installed

```bash
node -e "require('@axe-core/playwright'); require('playwright'); require.resolve('lighthouse')" 2>/dev/null || \
  npm install --no-save @axe-core/playwright playwright lighthouse && npx playwright install chromium --with-deps
```

---

## Step 2 — Run the review

```bash
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
SCRIPT=$(find .claude .agents .kiro "$ROOT/.claude" "$ROOT/.agents" "$ROOT/.kiro" -name "review-pages.mjs" -print -quit 2>/dev/null)
node "${SCRIPT:?review-pages.mjs not found}" 2>&1 | tee /tmp/site-review.txt
```

---

## Step 3 — Interpret and fix

The script exits 1 if any page has any a11y violation, any failing Lighthouse SEO audit, or lost content since the last pass.

After fixing, redeploy and re-run:

```bash
yarn build && yarn jahia-deploy
```

Then run the command of Step 2 again: `$SCRIPT` does not survive from one command to the next.

Iterate until the script exits 0 and `pages.json` is written.

---

## Validation checklist
- [ ] Script exits 0 (zero a11y violations, zero failing SEO audits, no content lost)
- [ ] `pages.json` exists (created by the script on pass)
