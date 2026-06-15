---
name: jahia-content-explore-structure
description: Efficiently maps an unknown Jahia website's sites, template sets, pages, areas, content trees, and type definitions using MCP tools before authoring or restructuring content.
---

# Skill: jahia-content-explore-structure

Use this skill before creating or editing content on an unfamiliar Jahia instance. It produces a reliable map of the CMS so that `/jahia-content-create-content` and `/jahia-content-organize` can work without guesswork.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `my-jahia` connected with a valid API token
- Know the target `siteKey`, or start with `site.list`

---

## Discovery workflow

### Level 1 — What sites exist?

```
tool: site.list
```

Returns all sites with `siteKey`, `title`, `languages`, and `defaultLanguage`.

### Level 2 — What template sets are installed for site creation?

```
tool: site.templateSets
args: {}
```

Use this between `site.list` and `site.get` when you need to understand what template sets are available for creating a new site. This is especially useful on fresh instances where a user may ask for a site that does not exist yet.

### Level 3 — Site details

```
tool: site.get
args: { "siteKey": "SITE_KEY" }
```

Returns detailed metadata such as languages, server names, homepage path, template set, and raw JCR properties.

### Level 4 — What pages exist?

```
tool: page.list
args: { "siteKey": "SITE_KEY" }
```

Returns paginated pages with path, title, template, and last modified date.

Useful filters:
- `templateName`
- `titleContains`
- `createdAfter`
- `modifiedAfter`
- `sortBy`: `lastModified`, `created`, `title`, `path`

### Level 5 — Page structure and content areas

```
tool: page.structure
args: { "path": "/sites/SITE_KEY/home/about" }
```

Returns:
- area paths
- allowed node types per area
- current children with type, title, and kind classification

This is the authoring contract for a page.

### Level 6 — Content tree navigation

```
tool: content.list
args: {
  "parentPath": "/sites/SITE_KEY/home/about/main",
  "limit": 50
}
```

Returns direct children with path, type, kind, title, and child count.

Optional filters:
- `childNodeType`
- `projectProperties`

### Level 7 — Read a specific node

```
tool: content.get
args: { "path": "/sites/SITE_KEY/home/about/main/intro-text" }
```

Returns all readable properties, mixins, and metadata. You can also pass `uuid` instead of `path`.

### Level 8 — Search across content

```
tool: content.search
args: {
  "siteKey": "SITE_KEY",
  "nodeType": "jnt:bigText",
  "locale": "en",
  "fullText": "welcome",
  "limit": 10
}
```

Required parameters:
- `siteKey`
- `nodeType`

Optional parameters:
- `locale`
- `fullText`
- `fullTextField`
- `basePath`
- `properties`
- `projectProperties`
- `sortBy`
- `order`
- `offset`
- `limit`

Property filters combine with AND:

```json
"properties": [
  { "name": "jcr:createdBy", "op": "eq", "value": "editor1" },
  { "name": "jcr:created", "op": "gt", "value": "2026-06-01T00:00:00.000Z" }
]
```

Operators: `eq`, `like`, `gt`, `gte`, `lt`, `lte`, `isNull`, `isNotNull`

### Level 9 — Type discovery

All types available on the site:

```
tool: site.types
args: { "siteKey": "SITE_KEY" }
```

Full definition of one type:

```
tool: content.type
args: { "name": "mymodule:heroSection" }
```

Allowed types in one specific area:

```
tool: content.list_definitions
args: {
  "siteKey": "SITE_KEY",
  "nodePath": "/sites/SITE_KEY/home/my-page/main"
}
```

---

## Exploration patterns

### Show me everything about this instance

1. `site.list`
2. `site.templateSets`
3. `site.get` for the relevant site
4. `page.list`
5. `page.structure` on a representative page
6. `site.types`

### What content is on this page?

1. `page.structure`
2. `content.get` for any interesting child nodes
3. `page.preview` if you need rendered output

### Find all articles mentioning a phrase

```
tool: content.search
args: {
  "siteKey": "SITE_KEY",
  "nodeType": "jnt:page",
  "locale": "en",
  "fullText": ""annual report"",
  "sortBy": "_score",
  "order": "desc"
}
```

### What custom types does this site use?

```
tool: site.types
args: { "siteKey": "SITE_KEY", "includeSubTypes": true }
```

Then inspect any interesting type:

```
tool: content.type
args: { "name": "luxe:blogPost", "includeSubTypes": false }
```

---

## Build a property map before creating content

Summarize each target type before authoring:

```
Content type: mymodule:heroSection
Properties:
  jcr:title        STRING    i18n    mandatory
  subtitle         STRING    i18n    optional
  image            WEAKREF   -       optional   → UUID of a file node
  backgroundColor  STRING    -       optional   → choicelist: light|dark

Allowed in area: pagecontent
```

That property map is what `/jahia-content-create-content` needs to avoid validation errors.

---

## Key principles

| Principle | Detail |
|-----------|--------|
| Explore before acting | Discover structure before creating, moving, or deleting content |
| Use `page.structure` for pages | It reveals areas, allowed types, and constraints |
| Use `content.list_definitions` for areas | It shows exactly what is droppable there and what properties are required |
| Use `site.templateSets` when the site may not exist yet | It tells you what template sets can be used with `site.create` |
| Navigate top-down | `site.list` → `site.get` / `site.templateSets` → `page.list` → `page.structure` → `content.list` → `content.get` |

---

## Related skills

- `/jahia-content-create-content` — create sites, pages, and content after exploring
- `/jahia-content-organize` — move, copy, rename, reorder, or delete after understanding structure
- `/jahia-content-query-content` — inspect and search content once you know where to look

