---
name: jahia-dev-worker
description: Developer worker for Jahia module builds. Reads PLAN.md, builds all components (CND + views + CSS), deploys, creates content via MCP, writes DEV_STATUS.md. Invoked by the orchestrator.
allowed-tools: Read, Write, Edit, Bash
# MCP tools (jahia server) are also required — no tools: block so Claude Code allows all
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

**Fix-cycle guard:** If PLAN.md contains a `## Round N Fix-Ups` section (where N ≥ 2), this is a fix cycle. Skip Steps 5 (create content) and 6 (write pages.json) entirely — content was already created in round 1 and pages.json already exists. Apply only the listed fixes, redeploy (Step 4), and write DEV_STATUS.md (Step 7).

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

## Step 3 — Build page template, then all components

**Build the page template first.** Every website needs a root layout. Create:

`src/templates/<ModuleName>Template/default.server.tsx`

```tsx
import React from 'react';
import { Area, AbsoluteArea, jahiaComponent } from '@jahia/javascript-modules-library';
import styles from './template.module.css';

jahiaComponent(
  {
    componentType: 'template',
    nodeType: 'jnt:page',
    displayName: 'Default Template',
    name: 'default',
  },
  ({ 'jcr:title': title }, { renderContext }) => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
      </head>
      <body>
        <header className={styles.header}>
          <nav aria-label="Main navigation">
            <AbsoluteArea name="header-nav" parent={renderContext.getSite()} />
          </nav>
        </header>
        <main id="main-content">
          <Area name="pagecontent" />
        </main>
        <footer className={styles.footer}>
          <AbsoluteArea name="footer" parent={renderContext.getSite()} />
        </footer>
      </body>
    </html>
  )
);
```

Also create `src/templates/<ModuleName>Template/template.module.css` with minimal header/footer styles.

**Then, for each component** in the plan:

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

**Validate CND before deploying:**

```bash
CND_SCRIPT=$(find .claude .agents -name "check-cnd.mjs" 2>/dev/null | head -1)
[ -n "$CND_SCRIPT" ] && node "$CND_SCRIPT" src/
```

If the checker exits 1 (FAIL), fix every ERROR before proceeding. Warnings are informational only.

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
2. Create all pages as specified in PLAN.md — set each page's `jcr:title` to a full descriptive title (e.g. "Home | Acme Corp", "Car Insurance | Acme Corp") so the `<title>` tag is meaningful for SEO
3. Create content nodes and populate them with realistic copy
4. Publish all pages

**Verify every page renders real content** — do not proceed until all pages pass:

```bash
# Run for each page URL. Replace <url> with the actual /cms/render/live/... URL.
curl -s -o /tmp/page_check.html -w "%{http_code}" "<url>"
```

For each page, check four things:
1. HTTP status is `200` — if not, the page wasn't created or published correctly
2. No Jahia error markers: `grep -c "error details are shown in development mode\|pl\.touk\.throwing" /tmp/page_check.html` — if > 0, a component is throwing at render time; read the error and fix it
3. Page has a `<title>`: `grep -o '<title>[^<]*</title>' /tmp/page_check.html` — if empty or shows "Error", the template isn't rendering
4. `<main>` has real content: `sed -n 's/.*<main[^>]*>\(.*\)<\/main>.*/\1/p' /tmp/page_check.html | sed 's/<[^>]*>//g' | tr -d ' \n' | wc -c` — if < 100 characters, content wasn't populated; go back to MCP and create/publish content

**If any check fails:** investigate the error, fix the component or content, redeploy if needed, and re-verify. Do not write `pages.json` until all pages pass all four checks.

---

## Step 6 — Write pages.json

Only reach this step once every page verified clean in Step 5.

Collect the public URLs for all pages — URLs that return the full rendered page without requiring authentication. MCP tools often return edit/preview mode URLs; convert them to their publicly accessible equivalent before writing.

Write `pages.json`:
```json
["http://localhost:8080/cms/render/live/en/sites/<siteKey>/home.html", "..."]
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
