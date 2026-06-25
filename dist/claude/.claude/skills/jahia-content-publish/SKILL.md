---
name: jahia-content-publish
description: Publishes and unpublishes Jahia content via MCP tools. Use when asked to make edits live, remove content from live, or check whether a page or subtree is ready for publication.
---

# Skill: jahia-content-publish

Handles publication workflows using MCP tools via the `jahia` MCP server.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Core concepts

- **EDIT workspace** — where authors create and modify draft content
- **LIVE workspace** — what public visitors see
- **Publication is language-scoped** — you publish specific language versions
- **Publishing a parent can include its subtree**
- **Workflow may apply** — `publication.publish` may start approval instead of publishing directly

---

## Step 1 — Check publication status

```
tool: publication.status
args: {
  "path": "/sites/SITE_KEY/home/about",
  "language": "en",
  "subNodes": true,
  "references": true
}
```

This tells you:
- whether the node or subtree is already published
- whether descendants are modified or unpublished
- whether references may block publication
- whether the current user can publish

---

## Step 2 — Publish

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/about",
  "languages": ["en", "fr"]
}
```

Possible outcomes:
- direct publish to LIVE
- workflow started for approval

---

## Step 3 — If approval workflow starts, complete it

List pending tasks:

```
tool: workflow.tasks
args: {}
```

Approve:

```
tool: workflow.complete
args: {
  "taskId": "TASK_ID",
  "outcome": "accept",
  "comment": "Approved — reviewed and ready"
}
```

Reject:

```
tool: workflow.complete
args: {
  "taskId": "TASK_ID",
  "outcome": "reject",
  "comment": "Needs revision"
}
```

---

## Step 4 — Unpublish

Remove content from LIVE while keeping EDIT:

```
tool: publication.unpublish
args: {
  "path": "/sites/SITE_KEY/home/about/main/outdated-section",
  "languages": ["en"]
}
```

---

## Common publication patterns

### Publish a newly created page and its content

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/new-page",
  "languages": ["en"]
}
```

### Publish translated content

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/about",
  "languages": ["fr"]
}
```

### Publish a deletion after `content.markForDeletion`

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/old-page",
  "languages": ["en"]
}
```

### Check whether a subtree is ready

```
tool: publication.status
args: {
  "path": "/sites/SITE_KEY/home",
  "language": "en",
  "subNodes": true,
  "references": true
}
```

---

## Key rules

| Rule | Detail |
|------|--------|
| Always specify languages | Publication is language-scoped |
| Publish is subtree-aware | Publishing a page includes its content areas and descendants |
| Workflow is automatic | `publication.publish` decides whether it can publish directly |
| References matter | Use `references: true` in status checks when media or linked content is involved |
| Mark-for-deletion needs publish | The deletion becomes live only after publication |

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `NODE_NOT_FOUND` | The path does not exist in EDIT | Verify with `content.get` |
| `NO_PUBLISH_PERMISSION` | User lacks publishing rights | Check the user's roles |
| Workflow started but content is still not live | Approval is still pending | Complete the task via `workflow.tasks` and `workflow.complete` |
| `MANDATORY_LANGUAGE_UNPUBLISHABLE` | Required language content is missing | Add the missing translation first |

---

## Related skills

- `/jahia-content-create-content` — create pages and content before publishing them
- `/jahia-content-translate-content` — translate content before publishing new locales
- `/jahia-content-organize` — publish after moves, copies, reorders, or deletions

