---
name: jahia-content-move-content
description: Focused workflow for moving, copying, renaming, reordering, and deleting Jahia content via MCP tools. Use when asked to restructure an existing content tree safely.
---

# Skill: jahia-content-move-content

Reorganizes an existing content tree using MCP tools via the `jahia` MCP server.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `jahia` connected with a valid API token
- Know the target `siteKey` (call `site.list` if unsure)
- Prefer `/jahia-content-explore-structure` first if the tree is unfamiliar

---

## Step 1 — Audit the current tree

```
tool: content.list
args: {
  "parentPath": "/sites/SITE_KEY/home/about/main",
  "limit": 50
}
```

For a broader view:

```
tool: content.search
args: {
  "siteKey": "SITE_KEY",
  "nodeType": "jmix:droppableContent",
  "locale": "en",
  "sortBy": "jcr:created",
  "order": "asc",
  "limit": 50
}
```

---

## Step 2 — Move, copy, rename, or reorder

### Move a node

```
tool: content.move
args: {
  "path": "/sites/SITE_KEY/home/blog/main/old-article",
  "destParentPath": "/sites/SITE_KEY/home/archive/main",
  "newName": "archived-article"
}
```

### Copy a node

```
tool: content.copy
args: {
  "path": "/sites/SITE_KEY/home/templates/main/hero-banner",
  "destParentPath": "/sites/SITE_KEY/home/landing/main"
}
```

### Rename a node

```
tool: content.rename
args: {
  "path": "/sites/SITE_KEY/home/about/main/old-name",
  "newName": "new-name"
}
```

### Reorder siblings

```
tool: content.reorder
args: {
  "parentPath": "/sites/SITE_KEY/home/blog/main",
  "nodeName": "featured-post",
  "position": "FIRST"
}
```

Or place one node before another:

```
tool: content.reorder
args: {
  "parentPath": "/sites/SITE_KEY/home/blog/main",
  "nodeName": "featured-post",
  "position": "INPLACE",
  "beforeNodeName": "second-post"
}
```

---

## Step 3 — Update content properties if needed

```
tool: content.update
args: {
  "path": "/sites/SITE_KEY/home/about/main/intro-text",
  "locale": "en",
  "properties": {
    "jcr:title": "Updated Title",
    "text": "<p>New content here.</p>"
  }
}
```

---

## Step 4 — Delete correctly

### Draft-only content: hard delete

```
tool: content.delete
args: { "path": "/sites/SITE_KEY/home/draft-page/main/temp-node" }
```

### Published content: mark for deletion, then publish the deletion

```
tool: content.markForDeletion
args: { "path": "/sites/SITE_KEY/home/old-page" }
```

Publish the deletion to remove it from LIVE:

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/old-page",
  "languages": ["en"]
}
```

Undo the mark if needed:

```
tool: content.unmarkForDeletion
args: { "path": "/sites/SITE_KEY/home/old-page" }
```

---

## Step 5 — Check and publish after changes

Inspect publication status:

```
tool: publication.status
args: {
  "path": "/sites/SITE_KEY/home/about",
  "language": "en",
  "subNodes": true,
  "references": true
}
```

Publish the affected branch:

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/about",
  "languages": ["en"]
}
```

Unpublish if the goal is to remove content from LIVE while keeping EDIT:

```
tool: publication.unpublish
args: {
  "path": "/sites/SITE_KEY/home/about/main/outdated-section",
  "languages": ["en"]
}
```

---

## Step 6 — Verify the result

```
tool: content.list
args: {
  "parentPath": "/sites/SITE_KEY/home/about/main",
  "limit": 50
}
```

Or preview the page:

```
tool: page.preview
args: { "path": "/sites/SITE_KEY/home/about" }
```

---

## Workflow summary

```
1. Audit      → content.list / content.search
2. Move/copy  → content.move / content.copy
3. Rename     → content.rename
4. Reorder    → content.reorder
5. Delete     → content.delete or content.markForDeletion + publication.publish
6. Publish    → publication.status + publication.publish / publication.unpublish
7. Verify     → content.list / page.preview
```

---

## Related skills

- `/jahia-content-organize` — fuller reorganization lifecycle and patterns
- `/jahia-content-explore-structure` — understand the tree before changing it
- `/jahia-content-publish` — publication readiness, publish, and unpublish flows

