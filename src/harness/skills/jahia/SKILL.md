---
name: jahia
description: Top-level entry point for ALL Jahia tasks. Detects whether the request is about building a module (dev) or managing content (CMS), and delegates to the right skill or combination. Start here if unsure which Jahia skill to use.
allowed-tools: Bash, Read
---

# Jahia — Universal Entry Point

You are the top-level GPS for all Jahia work. Your job is to understand what the user wants to accomplish, then delegate to the right skill(s) — `/jahia-dev`, `/jahia-content`, or both in sequence.

---

## Step 1 — Classify the request

Read the user's request and classify it using the table below. A task can span multiple categories.

| Category | Keywords / intent | Skill |
|----------|-------------------|-------|
| **Module development** | create module, scaffold, content type, CND, view, React, TSX, page template, CSS, build, deploy, compile | `/jahia-dev` |
| **Personalization / analytics** | jExperience, jCustomer, window.wem, visitor events, Kibana dashboard, personalization, DXP | `/jahia-dev-jexperience` |
| **Content management** | create content, add article, populate, move, reorganize, publish, query what's in the CMS | `/jahia-content` |
| **OSGi / back-office** | Java bundle, OSGi service, jcontent action, admin panel, toolbar button, Webpack, Module Federation | `/jahia-dev-osgi-module` or `/jahia-dev-ui-extension` |
| **E2E testing** | Cypress, test spec, edit mode, component interaction, publish workflow | `/jahia-dev-cypress` |
| **Java module reference** | OSGi DS, CND definitions, JSP rendering, Drools rules, JCR SQL2, Content Editor JSON, component registry | `/jahia-dev-java` |
| **API reference** | GraphQL schema, JCR Java/REST API, OAuth/SAML auth, personal tokens, HTML filtering, CSP, security scopes | `/jahia-dev-apis` |
| **Operations / DevOps** | Docker Compose, Kubernetes, health endpoints, logs, Karaf, provisioning YAML scripts | `/jahia-dev-ops` |
| **Configuration reference** | jahia.properties keys, cluster setup, operating mode, auth settings, JCR/search tuning | `/jahia-dev-properties` |
| **Both** | build a component AND fill it with content, design a section AND add pages to it, set up a site end-to-end | Run `/jahia-dev` first, then `/jahia-content` |

If the request is ambiguous, ask one clarifying question:
> "Are you building or changing **code** (module, views, templates) — or managing **content** (articles, pages, folders) inside a running Jahia site?"

---

## Step 2 — Run the right GPS(es)

### Dev only → invoke `/jahia-dev`
`/jahia-dev` will detect the project state and route to the correct dev sub-skill.

### CMS only → invoke `/jahia-content`
`/jahia-content` will check the live site and route to the right content management sub-skill.

### Both → run in order

When a task requires code changes **and** content changes, always execute in this order:

```
1. /jahia-dev                        ← build/update the module code
2. yarn build && yarn jahia-deploy   ← push the updated module to Jahia (never use yarn dev)
3. /jahia-content                    ← populate or reorganize content
```

Rationale: content types must exist in the CMS before you can create nodes of those types.

---

## Step 3 — Common compound workflows

Use these recipes as starting points when the task maps to a known pattern.

### "Build a new section on the site"
```
1. /jahia-dev-build-component       → define the content type + create the view
2. /jahia-dev-create-page-template  → (if a new page layout is needed)
3. /jahia-content-create-content    → populate the section with real or dummy content
4. /jahia-content-move-content      → (if existing content needs to be reorganized)
```

### "Add an article to the site"
```
1. Check the CND — does the article content type exist?
   → Yes: jump to step 2
   → No: /jahia-dev-define-content-type + /jahia-dev-create-view first
2. /jahia-content-create-content    → create the article node + set properties + publish
```

### "Redesign the layout of a page"
```
1. /jahia-dev-screenshot       → capture current state for before/after comparison
2. /jahia-dev-create-view      → update the view / CSS
3. yarn build && yarn jahia-deploy  → push changes (never use yarn dev)
4. /jahia-dev-screenshot       → validate the result
```

### "Set up a new site from scratch"
```
1. /jahia-dev-create-template-set   → scaffold the module
2. /jahia-dev-start-local           → start Jahia locally
3. /jahia-dev-build-component       → build content types + views (repeat per component)
4. /jahia-dev-create-page-template  → create page templates
5. /jahia-content-create-content    → populate with articles, pages, folders
6. /jahia-dev-review                → catch issues before shipping
```

---

## Step 4 — Print the full skill map

Always print this at the end so the user can jump anywhere:

```
## All Jahia Skills

### 🏗 Development  (/jahia-dev and sub-skills)
/jahia-dev                       Detect project state, guide to next step ← start here
/jahia-dev-create-template-set   Scaffold a new JS/React Jahia module
/jahia-dev-start-local           Start Jahia locally (Docker or bare metal)
/jahia-dev-build-component       Build a complete component (CND + view) ← shortcut
/jahia-dev-define-content-type   Define a CND content type + types.ts
/jahia-dev-create-view           Implement a React view (.server.tsx + CSS Module)
/jahia-dev-create-page-template  Create a page template with Areas
/jahia-dev-query-content         Write JCR-SQL2 / useJCRQuery for content listings
/jahia-dev-review                Code review: 8 critical checks, 9 warnings, 10 suggestions
/jahia-dev-screenshot            Screenshot reference + local render for visual comparison
/jahia-dev-debug                 Debug build/deploy/runtime errors end-to-end
/jahia-dev-cypress               Write Cypress E2E tests for Jahia components
/jahia-dev-import-from           Implement a component inspired by one on an external URL
/jahia-dev-jexperience           jExperience + jCustomer: push events, Kibana dashboards, local DXP stack

### ⚙️ OSGi / Back-office extensions
/jahia-dev-osgi-module           Build or configure an OSGi Java bundle module
/jahia-dev-ui-extension     Extend jcontent back-office with React 18/Webpack actions or panels

### 📝 Content Management  (/jahia-content and sub-skills)
/jahia-content                       Detect site state, route to content operations ← start here
/jahia-content-explore-structure     Map content types, properties, enums & mixins on an unknown site
/jahia-content-query-content         Query and audit content via GraphQL
/jahia-content-create-content        Create nodes, folders, articles, bulk-populate
/jahia-content-move-content          Restructure the content tree: move, rename, reorder
### 📚 Knowledge Reference
/jahia-dev-java              OSGi DS, CND definitions, JSP rendering, Drools rules, Content Editor/jContent UI
/jahia-dev-apis              GraphQL, JCR Java/REST API, OAuth/SAML, personal tokens, HTML filtering, CSP
/jahia-dev-ops               Docker Compose, Kubernetes, health monitoring, Karaf, provisioning YAML API
/jahia-dev-properties        jahia.properties and OSGi .cfg configuration keys reference
```

