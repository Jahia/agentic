---
name: jahia-review-site
description: Scores live pages for accessibility and SEO.
allowed-tools: Bash, Read, Write, Edit
---

# Skill: jahia-review-site

Reads URLs from `pages-to-review.json`, runs automated a11y and SEO checks, and — only if all checks pass — writes `pages.json`. Exits non-zero without writing `pages.json` if any violation is found.

**A11y:** axe-core WCAG 2.1 AA — any violation fails.

**SEO:** Lighthouse SEO category — any failing audit fails. Violations reported by audit ID (e.g. `document-title`, `meta-description`, `hreflang`, `is-crawlable`, `link-text`, `image-alt`).

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

The script exits 1 if any page has any a11y violation or any failing Lighthouse SEO audit.

**Common violations and where to fix them:**

| Violation | Fix location |
|---|---|
| `landmark-*` empty nav or footer | Page template — ensure `<nav>` has inline content, `<footer>` has fallback text |
| `page-has-heading-one` | Page template — add `<h1>{title}</h1>` |
| `image-alt` | Component `.server.tsx` — use `imageAlt \|\| title \|\| 'Image'` |
| `color-contrast` | Component `.module.css` — check foreground/background ratio ≥ 4.5:1 |
| `heading-order` | Component — components start at `<h2>`, sub-items at `<h3>` |
| `document-title` (SEO) | Page template `<head>` — ensure `<title>` is present and non-empty |
| `meta-description` (SEO) | Page template `<head>` — add `<meta name="description" content={…} />` |
| `hreflang` (SEO) | Page template `<head>` — add `<link rel="alternate" hreflang="…" />` for multilingual sites |
| `is-crawlable` (SEO) | Remove `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex` |
| `link-text` (SEO) | Replace icon-only links with visible text or add `aria-label` |

After fixing, redeploy and re-run:

```bash
yarn build && yarn jahia-deploy
node "$SCRIPT"
```

Iterate until the script exits 0 and `pages.json` is written.

---

## Validation checklist
- [ ] Script exits 0 (zero a11y violations, zero failing SEO audits)
- [ ] `pages.json` exists (created by the script on pass)
