---
name: jahia-content-move-content
description: Moves and reorganizes JCR content nodes in Jahia. Use when asked to restructure content folders, nest flat content into sections, rename or move nodes, or tidy up a content tree.
---

# Skill: jahia-content-move-content

Reorganizes the JCR content tree — moving nodes into sub-folders, renaming them, and reordering them — using the Jahia GraphQL API.

---

## Prerequisites

- Jahia running at `http://localhost:8080`
- Credentials: `root` / `root1234` (default)
- GraphQL endpoint: `http://localhost:8080/modules/graphql`

**Always include both auth flags:**
```bash
curl -s -u root:root1234 \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:8080" \
     -X POST http://localhost:8080/modules/graphql \
     -d '{"query": "..."}'
```

> ⚠️ The `Origin` header is **required** — omitting it returns `Permission denied`.

---

## Step 1 — Audit the current content tree

Before moving anything, map out what exists and where:

```bash
# List all content folders and their direct children
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodeByPath(path: \"/sites/mySite/contents\") { descendants(fieldFilter: {filters: [{fieldName: \"primaryNodeType.name\", evaluation: EQUAL, value: \"jnt:contentFolder\"}]}) { nodes { path name } } } } }"
  }'
```

Or use a JCR-SQL2 query for a flat list of all content items:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodesByQuery(query: \"SELECT * FROM [jnt:content] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents\u0027) ORDER BY [jcr:path] ASC\", queryLanguage: SQL2) { nodes { path primaryNodeType { name } } } } }"
  }'
```

---

## Step 2 — Create target sub-folders

If destination folders don't exist yet, create them with `mix:title` for a proper display label:

```bash
# Create a sub-folder
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { addNode(parentPathOrId: \"/sites/mySite/contents/articles\", name: \"getting-started\", primaryNodeType: \"jnt:contentFolder\") { node { path } } } }"
  }'

# Set a human-readable title on the folder
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/getting-started\") { addMixins(mixins: [\"mix:title\"]) mutateProperty(name: \"jcr:title\") { setValue(language: \"en\", value: \"Getting Started\") } } } }"
  }'
```

---

## Step 3 — Move a node

Use `move` on a `mutateNode` to relocate a node to a new parent. The node keeps its name:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/my-article\") { move(parentPathOrId: \"/sites/mySite/contents/articles/getting-started\") } } }"
  }'
```

> ⚠️ `move` does **not** support a `name` argument — use `rename` separately if needed.

### Rename a node in place

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles\") { rename(name: \"reference-pages\") } } }"
  }'
```

To move **and** rename, call `move` then `rename` in sequence, or combine in one mutation:

```graphql
mutation {
  jcr {
    mutateNode(pathOrId: "/sites/mySite/contents/articles/old-name") {
      move(parentPathOrId: "/sites/mySite/contents/articles/getting-started")
    }
    rename: mutateNode(pathOrId: "/sites/mySite/contents/articles/getting-started/old-name") {
      rename(name: "new-name")
    }
  }
}
```

### Batch move with Python

```python
import subprocess, json

def gql(q):
    r = subprocess.run(["curl","-s","-u","root:root1234",
        "-H","Origin: http://localhost:8080",
        "-H","Content-Type: application/json",
        "-X","POST","http://localhost:8080/modules/graphql",
        "-d", json.dumps({"query": q})], capture_output=True, text=True)
    d = json.loads(r.stdout)
    if "errors" in d: print("ERR:", d["errors"][0]["message"][:80])
    return d

moves = [
    ("/sites/mySite/contents/articles/getting-started",
     "/sites/mySite/contents/articles/core-concepts"),
    ("/sites/mySite/contents/articles/graphql-api",
     "/sites/mySite/contents/articles/api-reference"),
]

for src, dest in moves:
    r = gql(f'mutation {{ jcr {{ mutateNode(pathOrId: "{src}") {{ move(parentPathOrId: "{dest}") }} }} }}')
    ok = "errors" not in r
    print(f"  {'✓' if ok else '✗'} {src.split('/')[-1]} → {dest.split('/')[-1]}")
```

---

## Step 4 — Reorder siblings

To control the display order within a folder, use `reorder` after moving:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/intro\") { reorder(reorderNodes: {moveBeforeOrAfter: BEFORE, target: \"advanced\"}) } } }"
  }'
```

---

## Step 5 — Publish after moving

Moving a node unpublishes it in the live workspace. Always republish after reorganizing:

```bash
# Publish a single node
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/getting-started/my-article\") { publish(languages: [\"en\"]) } } }"
  }'

# Publish everything under a folder at once
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNodesByQuery(query: \"SELECT * FROM [jnt:content] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents\u0027)\", queryLanguage: SQL2) { publish(languages: [\"en\"]) } } }"
  }'
```

---

## Step 6 — Verify

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodesByQuery(query: \"SELECT * FROM [jnt:content] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents\u0027)\", queryLanguage: SQL2) { nodes { path } } } }"
  }'
```

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied` | Missing `Origin` header | Add `-H "Origin: http://localhost:8080"` |
| `ItemExistsException` | A node with that name already exists at the destination | Choose a different name or use `rename` after moving |
| `PathNotFoundException` | Source or destination path doesn't exist | Verify paths with `nodeByPath` first |
| `move` returns `null` | Node was already at that location | Verify the current path first |
| Content disappears from live after move | Move unpublishes — normal JCR behaviour | Run `publish` after every move |

---

## Workflow summary

```
1. Audit      → list current paths and types
2. Plan       → map old paths to new paths/folders
3. Create     → addNode for any new folders needed
4. Move       → mutateNode { move(...) } for each item
5. Publish    → mutateNodesByQuery { publish(...) } for all affected content
6. Verify     → query back and confirm structure
```
