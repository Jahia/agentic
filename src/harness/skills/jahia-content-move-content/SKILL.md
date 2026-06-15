---
name: jahia-content-move-content
description: Moves and reorganizes JCR content nodes in Jahia using MCP tools. Use when asked to restructure content, rename or move nodes, or tidy up a content tree.
---

# Skill: jahia-content-move-content

Reorganizes the JCR content tree — moving, renaming, reordering, and deleting nodes — using MCP tools (via the `my-jahia` MCP server).

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `my-jahia` connected with a valid API token
- Know the target **siteKey** (call `site.list` if unsure)

---

## Step 1 — Audit the current content tree

Before moving anything, map out what exists:

```
tool: content.list
args: {
  "parentPath": "/sites/mySite/home/about/main",
  "limit": 50
}
```

For a broader view, search by type:

```
tool: content.search
args: {
  "siteKey": "mySite",
  "nodeType": "jmix:droppableContent",
  "locale": "en",
  "sortBy": "jcr:created",
  "order": "asc",
  "limit": 50
}
```

---

## Step 2 — Update content properties

To update properties on an existing node:

```
tool: content.update
args: {
  "path": "/sites/mySite/home/about/main/intro-text",
  "locale": "en",
  "properties": {
    "jcr:title": "Updated Title",
    "text": "<p>New content here.</p>"
  }
}
```

Also supports:
- `addMixins` — add mixin node types
- `removeMixins` — remove mixin node types
- `removeProperties` — remove specific properties

---

## Step 3 — Delete a node

> ⚠️ Deletion is permanent. Always verify the path before deleting.

Currently, deletion requires the GraphQL API as a fallback since the MCP surface does not yet include a delete tool:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/home/old-page\") { delete } } }"}'
```

---

## Step 4 — Publish after changes

Moving or updating content may unpublish it. Always republish affected nodes:

```
tool: publication.status
args: {
  "path": "/sites/mySite/home/about",
  "language": "en",
  "subNodes": true
}
```

Check the status, then publish if needed. Publishing is done via the GraphQL API:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/home/about\") { publish(languages: [\"en\"]) } } }"}'
```

---

## Step 5 — Verify

After making changes, verify the new structure:

```
tool: content.list
args: {
  "parentPath": "/sites/mySite/home/about/main",
  "limit": 50
}
```

Or preview the page:

```
tool: page.preview
args: { "path": "/sites/mySite/home/about" }
```

---

## Workflow summary

```
1. Audit      → content.list / content.search to map current state
2. Update     → content.update for property changes
3. Create     → content.create for new content
4. Delete     → GraphQL delete mutation (MCP delete tool pending)
5. Publish    → GraphQL publish mutation
6. Verify     → content.list / page.preview to confirm
```
