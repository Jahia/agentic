---
name: jahia-dev-site-review
description: Scores live pages for accessibility (WCAG 2.1 AA via axe-core) and SEO (title, meta description, h1, alt). Use after deploying to get a pass/fail signal with per-violation detail before completing development.
allowed-tools: Bash, Read, Write, Edit
---

# Skill: jahia-dev-site-review

Runs automated a11y and SEO checks against every URL in `pages.json`. Reports a numeric score per page, lists violations by severity, and exits non-zero on any critical/serious a11y violation or missing SEO baseline.

**A11y scoring:** `Math.exp(-Σ impact_weights)` where `critical=1, serious=0.5, moderate=0.25, minor=0.1`. Score of 1.0 = perfect; 0.607 = one serious violation.

---

## Step 1 — Ensure tooling is installed

```bash
node -e "require('@axe-core/playwright'); require('playwright')" 2>/dev/null || \
  npm install --no-save @axe-core/playwright playwright && npx playwright install chromium --with-deps
```

---

## Step 2 — Run the review

```bash
SCRIPT=$(find .claude .agents -name "review-pages.mjs" 2>/dev/null | head -1)
node "$SCRIPT" 2>&1 | tee /tmp/site-review.txt
```

---

## Step 3 — Interpret and fix

The script exits 1 if any page has:
- A `🔴 [critical]` or `🔴 [serious]` a11y violation
- A `🔍 SEO` issue (missing title, meta description, h1, or img alt)

`🟡 [moderate]` and `🟡 [minor]` violations are reported but do not fail the run — fix them for a higher score.

**Common violations and where to fix them:**

| Violation | Fix location |
|---|---|
| `landmark-*` empty nav or footer | Page template — ensure `<nav>` has inline content, `<footer>` has fallback text |
| `page-has-heading-one` | Page template — add `<h1>{title}</h1>` |
| `image-alt` | Component `.server.tsx` — use `imageAlt \|\| title \|\| 'Image'` |
| `color-contrast` | Component `.module.css` — check foreground/background ratio ≥ 4.5:1 |
| `heading-order` | Component — components start at `<h2>`, sub-items at `<h3>` |
| Missing `<title>` | Page template `<head>` |
| Missing meta description | Page template `<head>` — add `<meta name="description" content={…} />` |
| Multiple `<h1>` | Remove `<h1>` from components; only the template renders one |

After fixing, redeploy and re-run:

```bash
yarn build && yarn jahia-deploy
node "$SCRIPT"
```

Iterate until the script exits 0.

---

## Validation checklist
- [ ] Script exits 0 (no critical/serious violations, no SEO issues)
- [ ] Average a11y score ≥ 0.8
- [ ] Every page has a unique, non-empty `<title>`
- [ ] Every page has `<meta name="description">`
- [ ] Every page has exactly one `<h1>`
