---
name: jahia-content-explore-structure
user-invocable: false
description: Efficiently maps an unknown Jahia website's content structure before creating or editing content. Discovers sites, pages, content areas, available content types, and their properties using MCP tools. Works on any Jahia instance including fresh installs with no reference site.
---

# Skill: jahia-content-explore-structure

Use this skill **before** creating content on an unfamiliar Jahia site. It produces a complete picture of the site's structure so that `/jahia-content-create-content` can work without trial-and-error.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `my-jahia` connected with a valid API token
- Know the target **siteKey** (or call `site.list` to discover it)

---

## Step 1 — Discover available sites

```
tool: site.list
```

Returns all sites with `siteKey`, `title`, `languages`, `defaultLanguage`.
The `siteKey` is needed for almost every other tool call.

---

## Step 2 — Get site details

```
tool: site.get
args: { "siteKey": "SITE_KEY" }
```

Returns detailed metadata: languages, server names, homepage path, template set, and raw JCR properties.

---

## Step 3 — List existing pages

```
tool: page.list
args: { "siteKey": "SITE_KEY" }
```

Returns paginated pages with path, title, template, last modified.
Supports filtering:
- `templateName` — filter by template (e.g. `"landing"`)
- `titleContains` — case-insensitive title search
- `createdAfter` / `modifiedAfter` — date filters
- `sortBy` — `lastModified`, `created`, `title`, `path`

---

## Step 4 — Discover page structure (content areas)

For any page, discover its content containers and what's already there:

```
tool: page.structure
args: { "path": "/sites/SITE_KEY/home/about" }
```

Returns:
- **Areas** with their JCR paths (e.g. `/sites/.../about/main`)
- **Allowed node types** per area
- **Current children** with type, title, kind classification

This is the key tool for understanding where content can go and what constraints apply.

---

## Step 5 — Browse the content tree

Navigate level by level:

```
tool: content.list
args: {
  "parentPath": "/sites/SITE_KEY/home/about/main",
  "limit": 50
}
```

Returns direct children with path, type, kind (page/content/area/file), title, and child count.

Optional filters:
- `childNodeType` — filter by type (e.g. `"jnt:bigText"`)
- `projectProperties` — include specific properties in output

---

## Step 6 — Read a specific node

```
tool: content.get
args: { "path": "/sites/SITE_KEY/home/about/main/intro-text" }
```

Returns all readable properties, mixins, metadata for one node.
Also accepts `uuid` instead of `path`.

---

## Step 7 — Search across content

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

**Required parameters:**
- `siteKey` — scopes search under `/sites/<siteKey>`
- `nodeType` — JCR type selector (e.g. `jnt:page`, `jnt:file`, `jmix:droppableContent`)

**Optional parameters:**
- `locale` — locale for i18n property resolution
- `fullText` — full-text expression (phrase `"..."`, OR, exclusion `-term`, wildcards)
- `fullTextField` — scope full-text to one property (e.g. `"jcr:title"`)
- `basePath` — restrict to a subtree
- `properties` — array of property filters (see below)
- `projectProperties` — array of property names to include in results
- `sortBy` — property name for ordering (default: `"jcr:lastModified"`) or `"_score"` when using fullText
- `order` — `"asc"` or `"desc"` (default: `"desc"`)
- `offset` — skip N results (default: 0)
- `limit` — max results 1–100 (default: 20)

**Property filters** combine with AND:
```json
"properties": [
  { "name": "jcr:createdBy", "op": "eq", "value": "john" },
  { "name": "jcr:created", "op": "gt", "value": "2026-01-01T00:00:00.000Z" }
]
```
Operators: `eq`, `like`, `gt`, `gte`, `lt`, `lte`, `isNull`, `isNotNull`

---

## Step 8 — Discover content types

### All types available on the site:

```
tool: site.types
args: { "siteKey": "SITE_KEY" }
```

### Full definition of a specific type:

```
tool: content.type
args: { "name": "mymodule:heroSection" }
```

Returns all properties (inherited + own), their types, i18n flags, mandatory markers, and constraints.

### What types are allowed in a specific area:

```
tool: content.list_definitions
args: {
  "siteKey": "SITE_KEY",
  "nodePath": "/sites/SITE_KEY/home/my-page/main"
}
```

Returns allowed content types grouped by category, with mandatory/optional properties, types, choicelist values, and i18n flags.

---

## Step 9 — Build the property map

After discovering types, summarize before creating content:

```
Content type: mymodule:heroSection
Properties:
  jcr:title        STRING    i18n    mandatory
  subtitle         STRING    i18n    optional
  image            WEAKREF   -       optional   → UUID of a file node
  backgroundColor  STRING    -       optional   → choicelist: light|dark

Area types where droppable: pagecontent (from list_definitions)
```

---

## Next step — Create content with the property map

Once you have the property map, hand it off to **`/jahia-content-create-content`**:

- Use the mandatory properties list to populate `content.create` calls correctly the first time
- Use the i18n flags to set the right `locale`
- Use the enum constraints to pass only valid choicelist values
- Use `children` in `content.create` for atomic tree creation

> Skipping this skill and guessing property names leads to validation errors. Always explore first.
