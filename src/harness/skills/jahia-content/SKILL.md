---
name: jahia-content
description: Entry point for creating sites, authoring pages, querying content, reorganizing nodes, uploading media, translating, and publishing a Jahia website via MCP tools.
---

# Jahia Content — Content Management GPS

You are the entry point for content work on a live Jahia instance. Understand the request, assess the site state, and route to the right content skill.

> **Never call Jahia's GraphQL API directly for content operations.** Use only MCP tools via the `jahia` MCP server. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Step 1 — Verify the MCP connection

Confirm the `jahia` MCP server is available:

```
tool: site.list
```

If this fails, Jahia or the MCP connection is not ready.

---

## Step 2 — Detect the site state

Run these checks to understand what exists already:

### A. List available sites

```
tool: site.list
```

### B. Discover installed template sets for new site creation

```
tool: site.templateSets
args: {}
```

### C. If a site exists, list its pages

```
tool: page.list
args: { "siteKey": "SITE_KEY" }
```

---

## Step 3 — Report the CMS state

Summarize what you found:

```
🌐 Jahia MCP:       ✅ connected
📁 Sites:           <site keys>
🧱 Template sets:   <installed template sets>
📄 Pages:           <page titles and templates for the chosen site>
```

---

## Step 4 — Route to the right sub-skill

| User intent | Skill |
|-------------|-------|
| Explore an unknown site, map areas, inspect types and properties | `/jahia-content-explore-structure` |
| Create a brand-new site before authoring content | `/jahia-content-create-content` using `site.templateSets` and `site.create` |
| Create pages, content, or structured trees on an existing site | `/jahia-content-create-content` |
| Upload files and images to `/sites/<siteKey>/files` | `/jahia-content-media-upload` |
| Find, inspect, or audit existing content | `/jahia-content-query-content` |
| Move, copy, rename, reorder, or delete content | `/jahia-content-organize` |
| Translate content to another locale | `/jahia-content-translate-content` |
| Publish, unpublish, or check readiness | `/jahia-content-publish` |
| Do several of the above in sequence | Start with `/jahia-content-explore-structure` if the site is unfamiliar |

---

## Direct MCP patterns

### Create a site before authoring pages

```
tool: site.templateSets
args: {}

tool: site.create
args: {
  "siteKey": "brandSite",
  "title": "Brand Site",
  "templateSet": "digitall",
  "defaultLanguage": "en",
  "languages": ["en", "fr"],
  "serverName": "brand.local"
}
```

### Publish a page or subtree

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/about",
  "languages": ["en"]
}
```

### Unpublish a page or subtree

```
tool: publication.unpublish
args: {
  "path": "/sites/SITE_KEY/home/about",
  "languages": ["en"]
}
```

### Delete a published node correctly

```
tool: content.markForDeletion
args: { "path": "/sites/SITE_KEY/home/old-page" }

tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/old-page",
  "languages": ["en"]
}
```

---

## Full skill map

```
/jahia-content-explore-structure   Map sites, template sets, pages, areas, and content definitions
/jahia-content-create-content      Create sites, pages, content nodes, and structured trees
/jahia-content-media-upload        Upload media and reference it from content
/jahia-content-query-content       List, inspect, and search content via MCP tools
/jahia-content-organize            Move, copy, rename, reorder, mark for deletion, and delete content
/jahia-content-move-content        Focused move/reorder/delete workflow for an existing content tree
/jahia-content-translate-content   Translate i18n content and page titles
/jahia-content-publish             Check publication status, publish, unpublish, and handle workflow
```

---

## Critical rules

- Always use MCP tools — never GraphQL directly
- Use `site.templateSets` and `site.create` when the requested site does not exist yet
- Always pass `locale` to content creation and update calls
- Always publish after creating, moving, deleting, or translating content
- Always explore with `/jahia-content-explore-structure` before authoring on an unfamiliar site

