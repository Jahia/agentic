---
name: jahia-content-create-content
description: Creates Jahia sites, pages, and content nodes via MCP tools. Use when asked to stand up a new site, create pages, populate areas, or build structured content trees.
---

# Skill: jahia-content-create-content

Creates sites, pages, and content in a running Jahia instance using MCP tools via the `jahia` MCP server.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `jahia` connected with a valid API token
- Know the target `siteKey` if the site already exists (call `site.list` if unsure)
- Know the content `locale` (for example `en` or `fr`)

---

## Minimum-call workflows

### 1 — Create a brand-new site, then its first page

Use this flow when the site does not exist yet:

```
# 1. Discover which template sets are installed for site creation
tool: site.templateSets
args: {}

# 2. Create the site
tool: site.create
args: {
  "siteKey": "brandSite",
  "title": "Brand Site",
  "templateSet": "digitall",
  "defaultLanguage": "en",
  "languages": ["en", "fr"],
  "serverName": "brand.local"
}

# 3. Discover page templates available on the new site
tool: page.templates
args: { "siteKey": "brandSite" }

# 4. Create the first page
tool: page.create
args: {
  "parentPath": "/sites/brandSite/home",
  "name": "about",
  "title": "About",
  "templateName": "simple",
  "locale": "en"
}

# 5. Discover allowed content types in an area
tool: content.list_definitions
args: {
  "siteKey": "brandSite",
  "nodePath": "/sites/brandSite/home/about/main"
}

# 6. Create the first content item
tool: content.create
args: {
  "parentPath": "/sites/brandSite/home/about/main",
  "nodeType": "jnt:bigText",
  "locale": "en",
  "properties": {
    "text": "<h2>Welcome</h2><p>Hello world.</p>"
  }
}
```

### 2 — Create a page with content on an existing site

```
# 1. Discover templates
tool: page.templates
args: { "siteKey": "SITE_KEY" }

# 2. Create the page
tool: page.create
args: {
  "parentPath": "/sites/SITE_KEY/home",
  "name": "my-page",
  "title": "My Page",
  "templateName": "simple",
  "locale": "en"
}

# 3. Check which content types and properties are allowed in the area
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

### 3 — Create a content tree atomically

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

---

## Step-by-step workflow

### Step 1 — Check whether the site already exists

```
tool: site.list
```

- If the site already exists, continue with `page.templates`.
- If it does not exist yet, do **site creation first**.

### Step 2 — If needed, create the site first

Discover what template sets are installed for site creation:

```
tool: site.templateSets
args: {}
```

Then create the site:

```
tool: site.create
args: {
  "siteKey": "SITE_KEY",
  "title": "My Site",
  "templateSet": "digitall",
  "defaultLanguage": "en",
  "languages": ["en", "fr"],
  "serverName": "mysite.local"
}
```

Only after the site exists should you continue to page-template discovery and page creation.

### Step 3 — Discover available page templates

```
tool: page.templates
args: { "siteKey": "SITE_KEY" }
```

Pick the template that matches the page's purpose.

### Step 4 — Create the page

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

`page.create` returns the page structure: areas, paths, allowed types, and constraints. If you need to re-check the structure later, call `page.structure`.

### Step 5 — Understand what content goes where

The page structure shows each area:

- area path, for example `/sites/SITE_KEY/home/my-page/main`
- allowed node types
- existing children

For a full type definition:

```
tool: content.type
args: { "name": "jnt:bigText" }
```

To discover all types available on the site:

```
tool: site.types
args: { "siteKey": "SITE_KEY" }
```

### Step 6 — Check what properties a type requires

```
tool: content.list_definitions
args: {
  "siteKey": "SITE_KEY",
  "nodePath": "/sites/SITE_KEY/home/my-page/main"
}
```

This returns allowed content types, mandatory and optional properties, property types, choicelist values, and i18n flags.

### Step 7 — Create content in an area

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

### Step 8 — Update existing content

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

Also supports `addMixins`, `removeMixins`, and `removeProperties`.

### Step 9 — Preview and verify

```
tool: page.preview
args: { "path": "/sites/SITE_KEY/home/my-page" }
```

Use this to verify the rendered HTML before publishing.

### Step 10 — Publish the result

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/my-page",
  "languages": ["en"]
}
```

---

## Property rules

| Situation | How to handle |
|-----------|---------------|
| i18n property | Pass `locale` and set the translated value in `properties` |
| Rich text | Use HTML such as `"text": "<h2>Title</h2><p>Body</p>"` |
| Date property | Use ISO-8601 such as `"2026-01-15T00:00:00.000Z"` |
| Reference property | Pass a UUID or absolute JCR path |
| Multi-valued property | Pass an array such as `"tags": ["a", "b"]` |
| Node name | Optional — auto-derived from `jcr:title` or `title` if omitted |

---

## Common patterns

### Create a page under a sub-page

```
tool: page.create
args: {
  "parentPath": "/sites/SITE_KEY/home/about",
  "name": "team",
  "title": "Our Team",
  "templateName": "simple",
  "locale": "en"
}
```

### Multiple content items in the same area

Call `content.create` multiple times with the same `parentPath`. Items appear in creation order. Use `content.reorder` if you need to rearrange them later.

### Reference another node

```
tool: content.create
args: {
  "parentPath": "/sites/SITE_KEY/home/my-page/aside",
  "nodeType": "jnt:contentReference",
  "properties": {
    "j:node": "UUID-OF-REFERENCED-NODE"
  }
}
```

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `NODE_TYPE_NOT_ALLOWED` | Type is not droppable in that area | Call `content.list_definitions` |
| `MANDATORY_PROPERTY_MISSING` | A required property was omitted | Check `content.list_definitions` |
| `NODE_EXISTS` | Node name already exists | Use a different `nodeName` or omit it |
| `PATH_NOT_FOUND` | Parent path does not exist | Create the site or page first, then add content |

---

## Related skills

- `/jahia-content-explore-structure` — map sites, pages, areas, and properties first
- `/jahia-content-media-upload` — upload images and files before referencing them
- `/jahia-content-publish` — publish pages, content, and translations
- `/jahia-content-organize` — move, rename, reorder, copy, or delete content later

