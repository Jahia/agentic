---
name: jahia-content-query-content
description: Queries JCR content from a running Jahia instance via MCP tools. Use when asked to list, inspect, or retrieve content nodes, check what content exists, or audit a site's content.
---

# Skill: jahia-content-query-content

Retrieves JCR content from a running Jahia instance using MCP tools (via the `my-jahia` MCP server).

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `my-jahia` connected with a valid API token
- Know the target **siteKey** (call `site.list` if unsure)

---

## Query patterns

### 1 — Get a node by path

```
tool: content.get
args: { "path": "/sites/mySite/home/about/main/intro-text" }
```

Returns all readable properties, mixins, and metadata. Also accepts `uuid`.

### 2 — List children of a node

```
tool: content.list
args: {
  "parentPath": "/sites/mySite/home/about/main",
  "limit": 50
}
```

Optional: `childNodeType` to filter, `projectProperties` to include specific properties.

### 3 — Search by node type

```
tool: content.search
args: {
  "siteKey": "mySite",
  "nodeType": "mymodule:article",
  "locale": "en",
  "sortBy": "jcr:created",
  "order": "desc",
  "limit": 10
}
```

### 4 — Full-text search

```
tool: content.search
args: {
  "siteKey": "mySite",
  "nodeType": "jmix:droppableContent",
  "locale": "en",
  "fullText": "insurance",
  "sortBy": "_score",
  "order": "desc"
}
```

### 5 — Filter by property value

```
tool: content.search
args: {
  "siteKey": "mySite",
  "nodeType": "mymodule:article",
  "locale": "en",
  "properties": [
    { "name": "jcr:createdBy", "op": "eq", "value": "root" }
  ]
}
```

Operators: `eq`, `like`, `gt`, `gte`, `lt`, `lte`, `isNull`, `isNotNull`

### 6 — List all sites

```
tool: site.list
```

### 7 — List all pages

```
tool: page.list
args: { "siteKey": "mySite" }
```

Supports: `templateName`, `titleContains`, `createdAfter`, `modifiedAfter`, `sortBy`, `order`.

### 8 — Check publication status

```
tool: publication.status
args: {
  "path": "/sites/mySite/home/about",
  "language": "en",
  "subNodes": true
}
```

Returns publication status, lock/WIP flags, and permission info.

---

## content.search parameter reference

**Required:**
- `siteKey` — scopes search under `/sites/<siteKey>`
- `nodeType` — JCR type (e.g. `jnt:page`, `jnt:file`, `jmix:droppableContent`)

**Optional:**
- `locale` — locale for i18n property resolution (e.g. `"en"`)
- `fullText` — full-text expression (phrase `"..."`, OR, exclusion `-term`)
- `fullTextField` — scope full-text to one property
- `basePath` — restrict to a subtree
- `properties` — array of property filters (AND-combined)
- `projectProperties` — properties to include in results
- `sortBy` — property name (default: `"jcr:lastModified"`) or `"_score"` with fullText
- `order` — `"asc"` or `"desc"` (default: `"desc"`)
- `offset` — skip N results (default: 0)
- `limit` — max results 1–100 (default: 20)

---

## Common search patterns

Last 5 created contents:
```
tool: content.search
args: {
  "siteKey": "mySite",
  "nodeType": "jmix:droppableContent",
  "locale": "en",
  "sortBy": "jcr:created",
  "order": "desc",
  "limit": 5
}
```

Recently modified pages:
```
tool: content.search
args: {
  "siteKey": "mySite",
  "nodeType": "jnt:page",
  "locale": "en",
  "sortBy": "jcr:lastModified",
  "order": "desc",
  "limit": 10
}
```

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `PATH_NOT_FOUND` | Node doesn't exist at given path | Verify path with `content.list` on parent |
| No results returned | Wrong `nodeType` or `siteKey` | Check available types with `site.types` |
| Missing i18n properties | `locale` not passed | Always include `locale` for i18n content |
