---
name: jahia-content
description: Entry point for managing content on a running Jahia website via the GraphQL API. Detects the current site state and routes to the right sub-skill. Use for any task involving creating, querying, moving, updating, or publishing JCR content.
---

# Jahia Content — Content Management GPS

You are the entry point for managing content on a live Jahia instance. Your job is to understand what the user needs, assess the current site state, and route to the right sub-skill.

---

## Step 1 — Verify Jahia is reachable

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/cms/login
```

- `200` → Jahia is running ✅
- Anything else → Jahia is not running. Tell the user: **"Please start Jahia first (use `/jahia-dev-start-local` if needed)."**

---

## Step 2 — Detect site state

Run both checks in parallel to understand what's currently in the CMS:

### A. List available sites
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites\") { children { nodes { name } } } } }"}'
```

### B. List top-level content folders
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites/mySite/contents\") { children { nodes { name primaryNodeType { name } } } } } }"}'
```

> Replace `mySite` with the actual site key if different.

---

## Step 3 — Report site state

```
🌐 Jahia:          ✅ running at http://localhost:8080
📁 Sites:          <list site keys>
📂 Content root:   <list folder names under /contents>
```

---

## Step 4 — Route to the right sub-skill

Use the task description to pick the right skill(s):

| What the user wants to do | Skill |
|---------------------------|-------|
| Explore an unknown site's content types, property names, enum values, mixins | **`/jahia-content-explore-structure`** |
| Find out what content exists, audit the tree, run a search | **`/jahia-content-query-content`** |
| Create pages, articles, tutorials, folders, populate a site | **`/jahia-content-create-content`** |
| Move, rename, restructure content into sub-folders | **`/jahia-content-move-content`** |
| Translate existing content to another language | **`/jahia-content-translate-content`** |
| Publish content to the live site | Use `publish` mutation (see below) |
| Delete content | Use `deleteNode` mutation (see below) |
| Do several of the above in sequence | Run the skills in order — start with **explore-structure** if site is unfamiliar, then create or move |

---

## Step 5 — Direct patterns for one-off operations

Use these when the task is simple enough to not need a full sub-skill.

### Publish a node (and all its children)
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles\") { publish(languages: [\"en\"]) } } }"}'
```

### Publish all content at once
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNodesByQuery(query: \"SELECT * FROM [jnt:content] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents\u0027)\", queryLanguage: SQL2) { publish(languages: [\"en\"]) } } }"}'
```

### Delete a node
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/old-article\") { delete } } }"}'
```

### Update a property on an existing node
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/my-article\") { mutateProperty(name: \"jcr:title\") { setValue(language: \"en\", value: \"Updated Title\") } } } }"}'
```

---

## Step 6 — Print the full CMS skill map

Always print this at the end so the user can navigate anywhere:

```
## Jahia Content Skills

/jahia-content-explore-structure    Map content types, properties, enums, mixins on an unknown site ← start here
/jahia-content-query-content        List, inspect, and search content via GraphQL
/jahia-content-create-content       Create nodes, folders, articles, and bulk-populate a site
/jahia-content-move-content         Restructure the content tree: move, rename, reorder nodes
/jahia-content-translate-content    Translate existing nodes to a new language and publish
```

---

## Critical rules (always enforce)

- Always include `-H "Origin: http://localhost:8080"` in every curl — omitting it causes `Permission denied`
- Always use `language: "en"` (or the site's language) for `i18n` properties (`jcr:title` on folders with `mix:title`, richtext body, etc.)
- Always publish after creating or moving content — JCR writes to the **default workspace** only; live visitors see the **live workspace**
- Mandatory fields (e.g. `body`) must be set **before** other properties on the same node in a new locale
