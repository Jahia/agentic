---
name: jahia-dev-accessibility
description: Audits a Jahia JS module for WCAG 2.1 AA accessibility violations using axe-core and Playwright. Runs automated checks against all live pages, reports violations by severity, and fixes them in the React views and CSS. Invoke after building components or before final review.
allowed-tools: Bash, Read, Write, Edit
---

# Skill: jahia-dev-accessibility

Runs a live accessibility audit against all published pages of the site, reports violations, and fixes them in the source code.

---

## Step 1 — Confirm pages are live

You need the list of public page URLs. Look for `pages.json` in the module root first:

```bash
cat pages.json 2>/dev/null || echo "not found"
```

If absent, derive URLs from the site structure or ask the user. All pages must be accessible at `http://localhost:8080`.

---

## Step 2 — Install audit tooling

Check if `@axe-core/playwright` and `playwright` are available:

```bash
node -e "require('@axe-core/playwright'); require('playwright'); console.log('ok')" 2>/dev/null || echo "missing"
```

If missing, install temporarily (project-local, not committed):

```bash
npm install --no-save @axe-core/playwright playwright
npx playwright install chromium --with-deps
```

---

## Step 3 — Run the audit

Save this script as `/tmp/a11y-audit.mjs` and run it:

```js
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { readFileSync } from "fs";

const urls = JSON.parse(readFileSync("pages.json", "utf-8"));

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();

for (const url of urls) {
  console.log(`\n${"=".repeat(60)}\nAuditing: ${url}\n${"=".repeat(60)}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  if (results.violations.length === 0) {
    console.log("✅ No violations found.");
    continue;
  }

  for (const v of results.violations) {
    console.log(`\n[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
    console.log(`Help: ${v.helpUrl}`);
    for (const node of v.nodes) {
      console.log(`  Target: ${node.target.join(" > ")}`);
      console.log(`  HTML:   ${node.html}`);
      if (node.failureSummary) {
        console.log(`  Fix:    ${node.failureSummary}`);
      }
    }
  }
}

await browser.close();
```

```bash
node /tmp/a11y-audit.mjs 2>&1 | tee /tmp/a11y-report.txt
```

---

## Step 4 — Interpret results

Group violations by impact. Focus on `critical` and `serious` first — they contribute most to a poor score.

Common violations in Jahia JS modules and their fixes:

### 🔴 Critical / Serious

**`color-contrast`** — text fails WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
```css
/* Bad */
color: #aaa; background: #fff;

/* Fix — use a contrast checker: https://webaim.org/resources/contrastchecker/ */
color: #595959; /* 7:1 ratio on white */
```

**`image-alt`** — `<img>` missing `alt` attribute
```tsx
/* Bad */
<img src={buildNodeUrl(props.image)} />

/* Fix — use content from CND, fall back to empty string for decorative */
<img src={buildNodeUrl(props.image)} alt={props.imageAlt ?? ""} />
```
Add `- imageAlt (string) i18n` to the CND and `imageAlt?: string` to `types.ts`.

**`button-name`** — `<button>` or `<a>` is empty (icon-only without label)
```tsx
/* Bad */
<button><svg>...</svg></button>

/* Fix */
<button aria-label="Open menu"><svg aria-hidden="true">...</svg></button>
```

**`landmark-one-main`** — page has no `<main>` landmark
```tsx
/* Fix — wrap page content in <main> */
<main id="main-content">
  {/* page content */}
</main>
```

**`page-has-heading-one`** — page has no `<h1>` element
```tsx
/* Fix — ensure the hero or first section renders an <h1> */
<h1>{props.title}</h1>
```

**`link-name`** — `<a>` with no accessible text
```tsx
/* Bad */
<a href={url}><img src="..." /></a>

/* Fix */
<a href={url}><img src="..." alt={props.linkLabel ?? "Learn more"} /></a>
```

### 🟡 Moderate

**`heading-order`** — headings skip levels (e.g. `<h1>` → `<h3>`)
```tsx
/* Review: the first heading in a component should be h2 (after the page h1) */
/* Section titles: h2, subsections: h3 */
```

**`region`** — content is outside landmark regions  
Wrap page sections in semantic elements: `<header>`, `<nav>`, `<main>`, `<footer>`, `<section aria-label="...">`.

**`list`** — `<ul>` or `<ol>` contains elements other than `<li>`
```tsx
/* Bad */
<ul>
  <div>item</div>
</ul>

/* Fix */
<ul>
  <li>item</li>
</ul>
```

**`html-has-lang`** — `<html>` element missing `lang` attribute  
This is set at the page template level. Verify the template registered in `src/templates/` includes `lang`:
```tsx
/* In the page template */
<html lang={currentLanguage ?? "en"}>
```
Jahia provides the language via `useServerContext()`:
```tsx
import { useServerContext } from "@jahia/javascript-modules-library";
const { currentLanguage } = useServerContext();
```

**`aria-required-children`** — ARIA role is missing required children  
Avoid misusing ARIA roles. Prefer native HTML elements (`<ul>/<li>`, `<table>/<tr>/<td>`).

---

## Step 5 — Fix in source

For each violation:

1. Identify the component: match `node.target` HTML to a `.server.tsx` file
2. Edit the view to apply the fix
3. If the fix requires a new CND field (e.g. `imageAlt`), update `definition.cnd` and `types.ts`
4. Run `yarn build && yarn jahia-deploy`

After all fixes:

```bash
# Re-run the audit to verify violations are resolved
node /tmp/a11y-audit.mjs 2>&1 | grep -E "(CRITICAL|SERIOUS|MODERATE|No violations)"
```

Iterate until only `minor` violations remain (or none).

---

## Step 6 — Proactive checks beyond axe-core

axe-core catches ~30–40% of WCAG issues automatically. Also check manually:

- **Keyboard navigation**: can every interactive element (link, button, form field) be reached with Tab?
- **Focus indicators**: is `:focus` visible on all interactive elements?
  ```css
  /* Ensure focus ring is never suppressed globally */
  /* Bad */
  * { outline: none; }
  /* Fix — use :focus-visible */
  :focus-visible { outline: 2px solid #0969da; outline-offset: 2px; }
  ```
- **Skip link**: add a "Skip to main content" link as the first focusable element
  ```tsx
  <a href="#main-content" className={styles.skipLink}>Skip to main content</a>
  ```
  ```css
  .skipLink {
    position: absolute;
    top: -100%;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px 16px;
    z-index: 999;
  }
  .skipLink:focus { top: 0; }
  ```
- **Motion**: if any CSS animation exists, wrap it in `@media (prefers-reduced-motion: no-preference)`
- **Touch targets**: interactive elements should be at least 44×44px

---

## Step 7 — Report summary

After fixing, report:

```
## Accessibility Audit Summary

Pages audited: N
Violations fixed:
  - [critical] color-contrast: 3 instances → fixed (updated CSS contrast ratios)
  - [serious] image-alt: 2 instances → fixed (added imageAlt CND field)
  - [serious] button-name: 1 instance → fixed (added aria-label to icon button)
  - [moderate] heading-order: 2 instances → fixed (restructured h2/h3 hierarchy)

Remaining violations: N (all minor / informational)

Axe tags checked: wcag2a, wcag2aa, wcag21aa
```

---

## References

- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- axe-core rules: https://dequeuniversity.com/rules/axe/
- WCAG 2.1 Quick Ref: https://www.w3.org/WAI/WCAG21/quickref/
- MDN ARIA: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA
