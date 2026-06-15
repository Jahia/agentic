---
name: jahia-content
description: Entry point for managing content on a running Jahia website via MCP tools. Detects the current site state and routes to the right sub-skill. Use for any task involving creating, querying, moving, updating, or publishing JCR content.
---

# Jahia Content — Content Management GPS

You are the entry point for managing content on a live Jahia instance. Your job is to understand what the user needs, assess the current site state, and route to the right sub-skill.

> **Never call Jahia's GraphQL API directly for content operations.** Use only MCP tools via the `my-jahia` MCP server. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Step 1 — Verify MCP connection

Confirm the `my-jahia` MCP server is available by listing sites:

```
tool: site.list
```

If this fails, the MCP server is not configured or Jahia is not running.

---

## Step 2 — Detect site state

Run both checks to understand what's in the CMS:

### A. List available sites

```
tool: site.list
```

### B. List pages on the site

```
tool: page.list
args: { "siteKey": "SITE_KEY" }
```

---

## Step 3 — Report site state

```
🌐 Jahia MCP:       ✅ connected
📁 Sites:           <list site keys>
📄 Pages:           <list page titles and templates>
```

---

## Step 4 — Route to the right sub-skill

| What the user wants to do | Skill |
|---------------------------|-------|
| Explore an unknown site's content types, structure, properties | **`/jahia-content-explore-structure`** |
| Find out what content exists, audit the tree, search | **`/jahia-content-query-content`** |
| Create pages, content, populate a site | **`/jahia-content-create-content`** |
| Update, reorganize, delete content | **`/jahia-content-move-content`** |
| Translate existing content to another language | **`/jahia-content-translate-content`** |
| Check publication status | Use `publication.status` tool |
| Do several of the above in sequence | Start with **explore-structure** if site is unfamiliar, then create or move |

---

## Step 5 — Direct patterns for one-off operations

### Publish a node (GraphQL — no MCP publish tool yet)

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/home/about\") { publish(languages: [\"en\"]) } } }"}'
```

### Delete a node (GraphQL — no MCP delete tool yet)

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/home/old-page\") { delete } } }"}'
```

---

## Step 6 — Print the full CMS skill map

```
## Jahia Content Skills (MCP-powered)

/jahia-content-explore-structure    Map content types, properties, areas on an unknown site ← start here
/jahia-content-query-content        List, inspect, and search content via MCP tools
/jahia-content-create-content       Create pages, content nodes, upload media, populate a site
/jahia-content-move-content         Update, restructure, and delete content
/jahia-content-translate-content    Translate existing nodes to a new language
```

---

## Critical rules (always enforce)

- Always use MCP tools for content operations — never GraphQL directly (except publish/delete which lack MCP tools)
- Always pass `locale` to content creation and update calls
- Always publish after creating or moving content — JCR writes to the **default workspace** only; live visitors see the **live workspace**
- Always explore with `/jahia-content-explore-structure` before creating content on an unfamiliar site
