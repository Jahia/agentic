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
grep "pageComponent" settings/definitions.cnd || echo "(pageComponent not yet defined)"
ls src/components/ 2>/dev/null || echo "(no components yet)"
```

Note the namespace prefix and whether `namespacemix:pageComponent` exists.

---

## Step 3 — Build page template, then all components

**Build the page template first.** Every website needs a root layout. Create:

`src/templates/<ModuleName>Template/default.server.tsx`

> The template file is always `default.server.tsx` inside a named folder — never `basic.server.tsx` or any other name.

```tsx
import React from 'react';
import { Area, AbsoluteArea, getChildNodes, buildNodeUrl, jahiaComponent } from '@jahia/javascript-modules-library';
import styles from './template.module.css';

jahiaComponent(
  {
    componentType: 'template',
    nodeType: 'jnt:page',
    displayName: 'Default Template',
    name: 'default',
  },
  ({ 'jcr:title': title }, { renderContext, mainNode }) => {
    // Pages live under /sites/<key>/home — not directly under the site node
    const siteHome = renderContext.getSite().getNode('home');
    const navPages = getChildNodes(siteHome, -1, 0, n => n.isNodeType('jnt:page'));
    const siteName = renderContext.getSite().getPropertyAsString('j:siteTitle') ?? renderContext.getSite().getName();
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* title = short page name + site name — never set jcr:title to the full "Page | Site" string */}
          <title>{title}{siteName ? ` | ${siteName}` : ''}</title>
        </head>
        <body>
          <a href="#main-content" className={styles.skipLink}>Skip to main content</a>
          <header className={styles.header}>
            <nav aria-label="Main navigation">
              <ul className={styles.navList}>
                <li key={siteHome.getPath()}>
                  <a
                    href={buildNodeUrl(siteHome)}
                    aria-current={siteHome.getPath() === mainNode.getPath() ? 'page' : undefined}
                  >
                    {siteHome.getPropertyAsString('jcr:title') ?? siteHome.getName()}
                  </a>
                </li>
                {navPages.map(page => (
                  <li key={page.getPath()}>
                    <a
                      href={buildNodeUrl(page)}
                      aria-current={page.getPath() === mainNode.getPath() ? 'page' : undefined}
                    >
                      {page.getPropertyAsString('jcr:title') ?? page.getName()}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
          <main id="main-content">
            <h1 className={styles.pageTitle}>{title}</h1>
            <Area name="pagecontent" />
          </main>
          <footer className={styles.footer}>
            <AbsoluteArea name="footer" parent={renderContext.getSite()} />
            <p className={styles.copyright}>{'© '}{renderContext.getSite().getName()}</p>
          </footer>
        </body>
      </html>
    );
  }
);
```

Also create `src/templates/<ModuleName>Template/template.module.css` with minimal header/footer styles including `.skipLink` (visually hidden until focused), `.navList` (horizontal flex list), `.pageTitle`, and `.copyright`.

**Then, for each component** in the plan:

1. Create `src/components/<Category>/<Name>/definition.cnd`
   - **⚠️ This file only. Never add component types to `settings/definitions.cnd` — that file is for namespace declarations and the module base mixin only.**
   - Namespace declarations at top (e.g. `<ns = 'https://example.com/ns/nt/1.0'>`)
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
   - **Components use `<h2>` for their primary heading, `<h3>` for sub-headings. Never `<h1>` — the page template owns the h1.**
   - Guard all props: `{prop?.value && <span>{prop.value}</span>}`
   - Guard node URLs: `prop["j:linknode"] ? buildNodeUrl(prop["j:linknode"]) : "#"`
   - `alt` on every `<img>`: use `imageAlt || title || 'Image'` — never fall back to empty string

4. Create `src/components/<Category>/<Name>/component.module.css`
   - Scoped CSS for the component
   - Mobile-first responsive
   - Colour contrast ≥ 4.5:1 for text on background

**After each component, deploy and verify it renders before moving to the next.**

**Check TypeScript types before each deploy:**

```bash
tsc --noEmit 2>&1 | head -30
```

Fix every type error before running `yarn build`. Use `mcp__ide__getDiagnostics` on each `.tsx` file for inline feedback — never grep `node_modules` for API signatures.

**Validate CND before each deploy:**

```bash
CND_SCRIPT=$(find .claude .agents -name "check-cnd.mjs" 2>/dev/null | head -1)
[ -n "$CND_SCRIPT" ] && node "$CND_SCRIPT" src/
```

If the checker exits 1 (FAIL), fix every ERROR before proceeding. Warnings are informational only.

---

## Step 4 — Deploy

```bash
yarn build && yarn jahia-deploy
```

If it fails, read the error, fix it, and retry. Record the outcome.

---

## Step 5 — Create content (only if deploy succeeded)

Use MCP tools (the `jahia` MCP server) to:
1. Discover the site key
2. Create all pages as children of the home page (`parentPath: /sites/<key>/home`) — set `jcr:title` to the **short page name only** (e.g. "Car Insurance", not "Car Insurance | Acme Corp"). The template appends the site name to `<title>` automatically.
3. Before creating content nodes, verify the parent area node exists with `content.get`. If it does not exist, create it first with the correct `jcr:primaryType` (e.g. `namespace:pageArea`).
4. Create content nodes and populate them with realistic copy
5. Publish all pages

**Verify every page renders real content and passes a11y + SEO checks:**

```bash
SCRIPT=$(find .claude .agents -name "review-pages.mjs" 2>/dev/null | head -1)
node "$SCRIPT" 2>&1 | tee /tmp/site-review.txt
```

The script checks each URL in `pages.json` for:
1. HTTP 200 and no Jahia error markers
2. A11y: no critical/serious WCAG 2.1 AA violations (axe-core)
3. SEO: `<title>`, `<meta name="description">`, single `<h1>`, all `<img>` have `alt`

If the script exits 1, read the violations, fix them in the source, redeploy (`yarn build && yarn jahia-deploy`), and re-run. Do not write `pages.json` until the script exits 0.

**Tooling check** — if `review-pages.mjs` reports missing modules:
```bash
npm install --no-save @axe-core/playwright playwright && npx playwright install chromium --with-deps
```

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
