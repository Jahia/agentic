---
name: jahia-content-create-content
description: Creates pages and content nodes in a running Jahia instance via MCP tools. Use when asked to populate a site with content, create pages, articles, or any content programmatically.
---

# Skill: jahia-content-create-content

Creates pages and content in a running Jahia instance using MCP tools (via the `my-jahia` MCP server).

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `my-jahia` connected with a valid API token
- Know the target **siteKey** (call `site.list` if unsure)
- Know the **locale** for the content (e.g. `en`, `fr`)

---

## ⚡ Minimum-call workflow

### 1. Create a page with content in 4 calls

```
# 1. Discover templates
tool: page.templates
args: { "siteKey": "SITE_KEY" }

# 2. Create the page (returns structure with areas + allowed types)
tool: page.create
args: {
  "parentPath": "/sites/SITE_KEY/home",
  "name": "my-page",
  "title": "My Page",
  "templateName": "TEMPLATE_NAME",
  "locale": "en"
}

# 3. Check what properties a content type needs
tool: content.list_definitions
args: {
  "siteKey": "SITE_KEY",
  "nodePath": "/sites/SITE_KEY/home/my-page/main"
}

# 4. Create content inside the area
tool: content.create
args: {
  "parentPath": "/sites/SITE_KEY/home/my-page/main",
  "nodeType": "jnt:bigText",
  "locale": "en",
  "properties": {
    "text": "<h2>Welcome</h2><p>Hello world.</p>"
  }
}
```

### 2. Create a content tree atomically

Use `children` to build nested content in one call:

```
tool: content.create
args: {
  "parentPath": "/sites/SITE_KEY/home/my-page/main",
  "nodeType": "mymodule:section",
  "locale": "en",
  "properties": {
    "jcr:title": "Features Section"
  },
  "children": [
    {
      "name": "card-1",
      "nodeType": "mymodule:card",
      "properties": {
        "jcr:title": "Feature One",
        "body": "<p>Description here.</p>"
      }
    },
    {
      "name": "card-2",
      "nodeType": "mymodule:card",
      "properties": {
        "jcr:title": "Feature Two",
        "body": "<p>Another description.</p>"
      }
    }
  ]
}
```

The entire tree is created atomically — all or nothing.

### 3. Upload images and reference them

```
# Upload from URL
tool: media.upload.url
args: {
  "siteKey": "SITE_KEY",
  "sourceUrl": "https://example.com/hero.jpg",
  "fileName": "hero.jpg",
  "folder": "images"
}
# → returns uuid: "abc-123..."

# Reference in content
tool: content.create
args: {
  "parentPath": "/sites/SITE_KEY/home/my-page/main",
  "nodeType": "jdnt:imageBlock",
  "locale": "en",
  "properties": {
    "j:node": "abc-123...",
    "jcr:title": "Hero Image"
  }
}
```

---

## Step-by-step workflow

### Step 1 — Discover available templates

```
tool: page.templates
args: { "siteKey": "SITE_KEY" }
```

Pick the template that matches your page's purpose (e.g. `home`, `landing`, `simple`).

### Step 2 — Create the page

```
tool: page.create
args: {
  "parentPath": "/sites/SITE_KEY/home",
  "name": "my-page",
  "title": "My Page",
  "templateName": "simple",
  "locale": "en"
}
```

**`page.create` returns the page structure** — content areas with their paths, allowed node types, and constraints. This is the same information you get from `page.structure` on an existing page. If you need to re-check the structure later, call `page.structure` with the page path.

### Step 3 — Understand what content goes where

The structure from step 2 shows **areas** (containers). Each area has:
- A **path** (e.g. `/sites/SITE_KEY/home/my-page/main`)
- **Allowed node types** — what content types can be dropped there
- **Current children** (empty for a new page)

### Step 4 — Check what properties a type requires

```
tool: content.list_definitions
args: {
  "siteKey": "SITE_KEY",
  "nodePath": "/sites/SITE_KEY/home/my-page/main"
}
```

Returns: allowed content types, mandatory/optional properties, property types, choicelist values, i18n flags.

For a specific type's full definition:

```
tool: content.type
args: { "name": "jnt:bigText" }
```

### Step 5 — Create content in the area

```
tool: content.create
args: {
  "parentPath": "/sites/SITE_KEY/home/my-page/main",
  "nodeType": "jnt:bigText",
  "locale": "en",
  "properties": {
    "text": "<h2>Welcome</h2><p>This is the intro paragraph.</p>"
  }
}
```

Call `content.create` multiple times for multiple items in the same area. Items appear in creation order.

### Step 6 — Update existing content

```
tool: content.update
args: {
  "path": "/sites/SITE_KEY/home/my-page/main/intro-text",
  "locale": "en",
  "properties": {
    "text": "<h2>Updated Title</h2><p>New content.</p>"
  }
}
```

Also supports: `addMixins`, `removeMixins`, `removeProperties`.

### Step 7 — Preview and verify

```
tool: page.preview
args: { "path": "/sites/SITE_KEY/home/my-page" }
```

Returns rendered HTML. Use to verify the page looks correct before publishing.

---

## Property rules

| Situation | How to handle |
|-----------|---------------|
| i18n property | Pass `locale` parameter + set in `properties` map |
| Rich text | Use HTML: `"text": "<h2>Title</h2><p>Body</p>"` |
| Date property | ISO-8601: `"2026-01-15T00:00:00.000Z"` |
| Reference property | Pass UUID or absolute JCR path as string |
| Multi-valued | Pass array: `"tags": ["a", "b"]` |
| Node name | Optional — auto-derived from `jcr:title` if not provided |

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `NODE_TYPE_NOT_ALLOWED` | Type not droppable in that area | Call `content.list_definitions` to check allowed types |
| `MANDATORY_PROPERTY_MISSING` | Required property not set | Check `content.list_definitions` for mandatory properties |
| `NODE_EXISTS` | Node name already taken | Use a different `nodeName` or omit it for auto-naming |
| `PATH_NOT_FOUND` | Parent path doesn't exist | Create the page first, then add content to areas |

---

## References

- For structure discovery → **`/jahia-content-explore-structure`**
- For media uploads → **`/jahia-content-create-content`** (upload section above)
- For publishing → use `publication.publish` tool after creating content
