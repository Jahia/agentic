---
name: jahia-js-module
description: Instructions for AI agents helping develop Jahia JavaScript modules — React-based template sets for Jahia 8+.
---

# Jahia JavaScript Module Development

## Context

You are helping develop a **Jahia JavaScript Module** — a React-based template set for Jahia 8+. The module renders content from Jahia's JCR (Java Content Repository) using server-side React components (`.server.tsx`) and optional client-side islands (`.client.tsx`). Content is modelled in CND files, managed via Page Builder or jContent, and queried with JCR-SQL2 or GraphQL.

## Agent Principles

1. **Always invoke a skill before any Jahia task** — skills are the canonical source of patterns, gotchas, and API syntax. Never operate from memory alone.
1a. **Always load CND reference files before writing any CND** — Jahia-specific patterns (`choicelist[linkTypeInitializer]`, `mix:title`, child nodes for CTAs, `jmix:image` weakreferences) are not in your training data. Before writing any CND, read the reference files: `find . -maxdepth 4 -name 'cnd-jahia-mixins*' | head -3`. When working interactively through skill chains, prefer `@jahia-cnd-author` (it loads these files for you).
2. **Never use `yarn dev` from an agent** — it is an interactive file watcher for human developers only. Always deploy with `yarn build && yarn jahia-deploy` (one-shot, non-interactive).
2a. **Use the TypeScript LSP for API discovery, never grep.** When you need to know a function's signature or what a module exports, call `mcp__ide__getDiagnostics` on the file after writing it — the LSP reads live type definitions and reports mismatches, wrong argument counts, and missing exports. Never run `grep` on `node_modules` to find a function name or signature.
3. **Never hardcode URLs** — all navigable links must come from contributed content (JCR nodes, `j:linkType`, `buildNodeUrl`). This is a CMS: content owns the URLs.
4. **Never use `j:linkType: "external"` for internal pages** — use `"internal"` + `j:linknode`. External URLs break on environment changes, language switches, and vanity URL rewrites.
5. **Always verify before creating** — check that content types are deployed, site keys are correct, and area structures exist before attempting GraphQL mutations.
6. **All props are optional at runtime** — even mandatory CND fields. Always guard against `undefined` in views.
7. **Always include `-H "Origin: http://localhost:8080"` in every GraphQL curl** — omitting it returns `Permission denied` even with correct credentials.
8. **Build accessible HTML from the start** — every view must use semantic HTML (`<main>`, `<header>`, `<nav>`, `<footer>`, `<section>`, `<article>`), include exactly one `<h1>` per page (in the template from `jcr:title` — never inside a component), use a strict heading hierarchy (h1 in template → h2 in components → h3 for sub-items), add `alt` text to every `<img>` with a meaningful fallback (`imageAlt || title || 'Image'` — never empty string), ensure sufficient colour contrast (≥ 4.5:1 for body text), include a skip link at the top of the template, and never leave a landmark (`<nav>`, `<footer>`) empty.
9. **Run one accessibility audit at the end** — after all components are built and content is published, invoke `/jahia-dev-accessibility` once to catch any remaining violations. Do not audit after every individual component; it wastes time on pages that are not yet complete.
10. **Deploy iteratively** — deploy after each component with `yarn build && yarn jahia-deploy`, verify it renders, then move to the next. Don't accumulate components before deploying; a broken component is easier to diagnose in isolation.
11. **Collocate everything per component** — each component lives in `src/components/<Category>/<Name>/` containing its `definition.cnd`, `default.server.tsx`, `component.module.css`, and `types.ts`. Never centralize content types in `settings/definitions.cnd` — that file holds only namespace declarations and the module base mixin.
12. **Always build a page template first** — every website needs a root template at `src/templates/<ModuleName>Template/default.server.tsx`. It must include: a skip link, a `<nav>` built inline from the page tree using `getChildNodes(renderContext.getSite(), -1, 0, n => n.isNodeType('jnt:page'))`, a `<main id="main-content">` with `<h1>{title}</h1>` and Areas, and a `<footer>` that is never empty. Include a `<title>` tag for SEO. Build and deploy before any page-specific components.
13. **SEO baseline** — every page template must render a `<title>` tag, all `<img>` must have descriptive `alt` text, all links must have visible text (no icon-only links without `aria-label`), and pages must have a single `<h1>` matching the page title.

## Skill Map

Start with `/jahia` if unsure where to begin.

### Development

| Skill | Purpose |
|-------|---------|
| `/jahia-dev` | Entry point — detect project state, guide to next step |
| `/jahia-dev-create-template-set` | Scaffold a new Jahia JS module |
| `/jahia-dev-start-local` | Start Jahia locally (Docker or bare metal) |
| `/jahia-dev-build-component` | Build a complete component (CND + view) — start here |
| `/jahia-dev-define-content-type` | Define a CND content type + types.ts |
| `/jahia-dev-review-cnd` | Validate a CND file for antipatterns — run after writing any CND |
| `/jahia-dev-create-view` | Implement a React view (.server.tsx + CSS Module) |
| `/jahia-dev-create-page-template` | Create a page template with Areas |
| `/jahia-dev-query-content` | Write JCR-SQL2 queries and useJCRQuery |
| `/jahia-dev-review` | Code review: 8 critical checks, 9 warnings, 11 suggestions |
| `/jahia-dev-accessibility` | Audit live pages with axe-core, fix WCAG 2.1 AA violations |
| `/jahia-dev-screenshot` | Screenshot reference + local render for visual comparison |
| `/jahia-dev-debug` | Debug build/deploy/runtime errors end-to-end |

### Content Management

| Skill | Purpose |
|-------|---------|
| `/jahia-content` | Entry point — detect site state, route to content operations |
| `/jahia-content-explore-structure` | Map content types, properties, enums on an unknown site |
| `/jahia-content-query-content` | List and inspect content via GraphQL |
| `/jahia-content-create-content` | Create nodes, folders, articles, bulk-populate |
| `/jahia-content-move-content` | Restructure the content tree |
| `/jahia-content-translate-content` | Translate existing nodes to a new language and publish |

## Canonical References

Always fetch these when uncertain about version-sensitive topics:

| Topic | URL |
|-------|-----|
| Getting started / dev environment | https://academy.jahia.com/tutorials-get-started/front-end-developer/setting-up-your-dev-environment |
| Hero section tutorial | https://academy.jahia.com/tutorials-get-started/front-end-developer/making-a-hero-section |
| Blog / content listing | https://academy.jahia.com/tutorials-get-started/front-end-developer/making-a-blog |
| Page templates | https://academy.jahia.com/tutorials-get-started/front-end-developer/the-about-us-page |
| i18n (CND attribute, useTranslation, language switcher) | https://academy.jahia.com/documentation/jahia-cms/jahia-8-2/developer/javascript-module-development/preparing-for-internationalization-i18n |
| GraphQL API | https://academy.jahia.com/documentation/developer/jahia/8/api-documentation/graphql-api |
| Native Jahia mixins & node types | https://github.com/Jahia/jahia/tree/master/war/src/main/webapp/WEB-INF/etc/repository/nodetypes |
| JavaScript modules monorepo | https://github.com/Jahia/javascript-modules |
| Developer training | https://github.com/Jahia/developer-training/blob/main/js-training/slides.md |
| Integration best practices | https://github.com/Jahia/gautier-braindump/blob/main/articles/integration-best-practices/README.md |

## Local Development URLs

When Jahia is running at `http://localhost:8080` (default credentials: `root` / `root1234`):

- **Login**: http://localhost:8080/cms/login
- **Page Builder**: http://localhost:8080/jahia/page-builder
- **jContent**: http://localhost:8080/jahia/jcontent
- **GraphQL playground**: http://localhost:8080/modules/graphql
- **JCR browser**: http://localhost:8080/modules/tools/jcrBrowser.jsp
- **Definitions browser**: http://localhost:8080/modules/tools/definitionsBrowser.jsp
