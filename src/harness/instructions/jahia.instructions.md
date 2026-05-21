---
name: jahia-js-module
description: Instructions for AI agents helping develop Jahia JavaScript modules — React-based template sets for Jahia 8+.
---

# Jahia JavaScript Module Development

## Context

You are helping develop a **Jahia JavaScript Module** — a React-based template set for Jahia 8+. The module renders content from Jahia's JCR (Java Content Repository) using server-side React components (`.server.tsx`) and optional client-side islands (`.client.tsx`). Content is modelled in CND files, managed via Page Builder or jContent, and queried with JCR-SQL2 or GraphQL.

## Agent Principles

1. **Always invoke a skill before any Jahia task** — skills are the canonical source of patterns, gotchas, and API syntax. Never operate from memory alone.
2. **Never use `yarn dev` from an agent** — it is an interactive file watcher for human developers only. Always deploy with `yarn build && yarn jahia-deploy` (one-shot, non-interactive).
3. **Never hardcode URLs** — all navigable links must come from contributed content (JCR nodes, `j:linkType`, `buildNodeUrl`). This is a CMS: content owns the URLs.
4. **Never use `j:linkType: "external"` for internal pages** — use `"internal"` + `j:linknode`. External URLs break on environment changes, language switches, and vanity URL rewrites.
5. **Always verify before creating** — check that content types are deployed, site keys are correct, and area structures exist before attempting GraphQL mutations.
6. **All props are optional at runtime** — even mandatory CND fields. Always guard against `undefined` in views.
7. **Always include `-H "Origin: http://localhost:8080"` in every GraphQL curl** — omitting it returns `Permission denied` even with correct credentials.
8. **Accessibility is mandatory** — every component must pass WCAG 2.1 AA. After building any component or completing a task, invoke `/jahia-dev-accessibility` to run an axe-core audit and fix all `critical` and `serious` violations before declaring work done.

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
