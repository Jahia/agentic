---
name: jahia-content-organize
description: Moves, copies, renames, reorders, and deletes Jahia content via MCP tools. Use when asked to reorganize a site structure, duplicate content, or manage the deletion lifecycle.
---

# Skill: jahia-content-organize

Covers structural content-tree operations using MCP tools via the `jahia` MCP server.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Move content

```
tool: content.move
args: {
  "path": "/sites/SITE_KEY/home/blog/main/old-article",
  "destParentPath": "/sites/SITE_KEY/home/archive/main",
  "newName": "archived-article"
}
```

- `newName` is optional
- the entire subtree moves with the node
- the move happens in EDIT; publish afterward

## Copy content

```
tool: content.copy
args: {
  "path": "/sites/SITE_KEY/home/templates/main/hero-banner",
  "destParentPath": "/sites/SITE_KEY/home/landing/main"
}
```

- deep copy, including children and properties
- the copy gets a new UUID
- use `excludeChildTypes` when you need to skip specific child node types

## Rename content

```
tool: content.rename
args: {
  "path": "/sites/SITE_KEY/home/about/main/old-name",
  "newName": "new-name"
}
```

Use `content.update` on `jcr:title` when you need to change the display title rather than the node name.

## Reorder siblings

```
tool: content.reorder
args: {
  "parentPath": "/sites/SITE_KEY/home/blog/main",
  "nodeName": "featured-post",
  "position": "FIRST"
}
```

Place a node before a specific sibling:

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

## Delete content

### Draft-only content

Hard delete immediately:

```
tool: content.delete
args: { "path": "/sites/SITE_KEY/home/draft-page/main/temp-node" }
```

### Published content

Mark the node for deletion first:

```
tool: content.markForDeletion
args: { "path": "/sites/SITE_KEY/home/blog/main/old-post" }
```

Publish the deletion to propagate it to LIVE:

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/blog/main/old-post",
  "languages": ["en"]
}
```

Undo the mark if needed:

```
tool: content.unmarkForDeletion
args: { "path": "/sites/SITE_KEY/home/blog/main/old-post" }
```

You cannot hard-delete already published content without first going through the deletion lifecycle.

---

## Reorganization patterns

### Move several items into a new section

```
# 1. Audit the current branch
tool: content.list
args: { "parentPath": "/sites/SITE_KEY/home/news/main" }

# 2. Move items
tool: content.move
args: {
  "path": "/sites/SITE_KEY/home/news/main/item-1",
  "destParentPath": "/sites/SITE_KEY/home/archive/main"
}

tool: content.move
args: {
  "path": "/sites/SITE_KEY/home/news/main/item-2",
  "destParentPath": "/sites/SITE_KEY/home/archive/main"
}

# 3. Publish the affected branch
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/archive",
  "languages": ["en"]
}
```

### Duplicate a page structure

```
# 1. Copy the page
tool: content.copy
args: {
  "path": "/sites/SITE_KEY/home/template-page",
  "destParentPath": "/sites/SITE_KEY/home"
}

# 2. Rename the copy
tool: content.rename
args: {
  "path": "/sites/SITE_KEY/home/template-page1",
  "newName": "new-section"
}

# 3. Update the page title
tool: content.update
args: {
  "path": "/sites/SITE_KEY/home/new-section",
  "locale": "en",
  "properties": {
    "jcr:title": "New Section"
  }
}
```

---

## Key rules

| Rule | Detail |
|------|--------|
| Publish after reorganization | Moves, copies, renames, and reorders affect EDIT first |
| No hard-delete of published nodes | Use `content.markForDeletion` plus `publication.publish` |
| Move includes the subtree | Children move with the selected node |
| Name conflicts fail | Moves and renames validate uniqueness |
| Reorder stays within one parent | Use `content.move` to change parents, `content.reorder` to change sibling order |

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `NODE_NOT_FOUND` | Source path does not exist | Verify with `content.get` or `content.list` |
| `NODE_EXISTS` | Target name already exists | Choose a different `newName` |
| `CANNOT_DELETE_PUBLISHED` | Attempted hard delete on published content | Use `content.markForDeletion` |
| `DEST_NOT_FOUND` | Destination parent does not exist | Verify with `content.get` |

---

## Related skills

- `/jahia-content-explore-structure` — inspect the tree before reorganizing it
- `/jahia-content-publish` — publish after moves, copies, reorders, or deletions
- `/jahia-content-move-content` — focused move and deletion workflow for an existing branch

