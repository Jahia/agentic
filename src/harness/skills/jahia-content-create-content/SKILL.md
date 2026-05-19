---
name: jahia-content-create-content
description: Creates and publishes JCR content nodes in a running Jahia instance via the GraphQL API. Use when asked to populate a site with content, create articles, tutorials, or any JCR node programmatically.
---

# Skill: jahia-content-create-content

Creates content nodes in a running Jahia instance using the GraphQL JCR mutation API, then publishes them.

---

## Prerequisites

- Jahia running at `http://localhost:8080`
- Credentials: `root` / `root1234` (default)
- GraphQL endpoint: `http://localhost:8080/modules/graphql`

**Auth pattern — always use both flags:**
```bash
curl -u root:root1234 \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:8080" \
     ...
```

> ⚠️ The `Origin: http://localhost:8080` header is **required**. Requests without it return `Permission denied` even with correct credentials.

---

## ⚡ Minimum-call workflow

Use these patterns to minimise the number of API round-trips:

### 1. Batch site exploration — one call instead of four

Use GraphQL aliases to retrieve site metadata, page structure, files, and available content types in a **single request**:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { site: nodeByPath(path: \"/sites/SITE_KEY\") { properties(names: [\"j:templatesSet\",\"j:defaultLanguage\"]) { name value } } home: nodeByPath(path: \"/sites/SITE_KEY/home\") { children { nodes { name primaryNodeType { name } children { nodes { name primaryNodeType { name } } } } } } files: nodeByPath(path: \"/sites/SITE_KEY/files\") { children { nodes { name uuid } } } contentTypes: nodeTypes(filter: {siteKey: \"SITE_KEY\", includeMixins: false, includeAbstract: false}) { nodes { name systemId } } } }"}'
```

Then fetch all needed type definitions in one more call using `nodeTypesByNames` (see `/jahia-content-explore-structure`).

### 2. Upload images in parallel

Run all uploads simultaneously using background processes:

```bash
for f in /path/to/img1.jpg /path/to/img2.jpg /path/to/img3.jpg; do
  name=$(basename "$f")
  curl -s -u root:root1234 \
    -H "Origin: http://localhost:8080" \
    -X POST http://localhost:8080/modules/graphql \
    -F "operations={\"query\":\"mutation { jcr { addNode(name: \\\"${name}\\\", parentPathOrId: \\\"/sites/SITE_KEY/files\\\", primaryNodeType: \\\"jnt:file\\\", mixins: [\\\"jmix:image\\\"]) { addChild(name: \\\"jcr:content\\\", primaryNodeType: \\\"jnt:resource\\\") { content: mutateProperty(name: \\\"jcr:data\\\") { setValue(type: BINARY, value: \\\"fc\\\") } contentType: mutateProperty(name: \\\"jcr:mimeType\\\") { setValue(value: \\\"image/jpeg\\\") } } uuid } } }\"}" \
    -F 'map={"fc":["variables.f"]}' \
    -F "fc=@${f};type=image/jpeg" &
done
wait  # all uploads complete in parallel
```

> ⚠️ Always include `mixins: ["jmix:image"]` in the upload. Without it, the file node **cannot be used as a WEAKREFERENCE** in image properties.

To collect UUIDs after parallel uploads, query them in one batch:
```bash
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodesByQuery(query: \"SELECT * FROM [jnt:file] WHERE ISDESCENDANTNODE(\u0027/sites/SITE_KEY/files/FOLDER\u0027)\", queryLanguage: SQL2) { nodes { name uuid } } } }"}'
```

### 3. Create an entire content tree in one mutation

Use nested `addChild` calls inside a single `addNode` mutation to build a complete page hierarchy without sequential round-trips:

```bash
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { addNode(parentPathOrId: \"/sites/SITE_KEY/home\", name: \"my-page\", primaryNodeType: \"jnt:page\", properties: [{name: \"j:templateName\", value: \"TEMPLATE\"}, {name: \"jcr:title\", value: \"Page Title\", language: \"en\"}]) { uuid addChild(name: \"AREA_NAME\", primaryNodeType: \"AREA_TYPE\") { addChild(name: \"section-1\", primaryNodeType: \"NAMESPACE:section\", properties: [{name: \"jcr:title\", value: \"Section 1\", language: \"en\"}]) { uuid addChild(name: \"item-1\", primaryNodeType: \"NAMESPACE:item\", properties: [{name: \"jcr:title\", value: \"Item 1\", language: \"en\"}, {name: \"body\", value: \"<p>Content</p>\", language: \"en\"}]) { uuid } } } } } }"}'
```

> This creates the full `page → area → section → item` hierarchy atomically.

### 4. Publish the entire page in one call

```bash
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/SITE_KEY/home/my-page\") { publish(languages: [\"en\"]) } } }"}'
```

---

## Uploading image files

Use the GraphQL API with a **multipart request** to upload files.

> ⚠️ Do **not** use `Content-Type: application/json` for uploads — use multipart form-data.
> Do **not** use `type: BINARY` inside the `properties: [...]` array of `addNode` or `addChild` — it won't work. Always use the separate `mutateProperty.setValue` step.

### Upload a single file

> ⚠️ Always include `mixins: ["jmix:image"]` when uploading images. Without this mixin, the file node **cannot be used as a WEAKREFERENCE** in image properties — you will get a constraint error.

```bash
curl -s -u root:root1234 \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -F 'operations={"query":"mutation { jcr { addNode(name: \"image.jpg\", parentPathOrId: \"/sites/SITE_KEY/files\", primaryNodeType: \"jnt:file\", mixins: [\"jmix:image\"]) { addChild(name: \"jcr:content\", primaryNodeType: \"jnt:resource\") { content: mutateProperty(name: \"jcr:data\") { setValue(type: BINARY, value: \"fc\") } contentType: mutateProperty(name: \"jcr:mimeType\") { setValue(value: \"image/jpeg\") } } uuid } } }"}' \
  -F 'map={"fc":["variables.f"]}' \
  -F "fc=@/absolute/path/to/image.jpg;type=image/jpeg"
```

The response contains the UUID:
```json
{"data":{"jcr":{"addNode":{"addChild":{"content":{"setValue":true},"contentType":{"setValue":true}},"uuid":"xxxxxxxx-..."}}}}
```

### Use a file UUID as an image property

Image properties in CND have `requiredType: WEAKREFERENCE`. Pass the UUID with `type: WEAKREFERENCE`:

```graphql
properties: [
  {name: "image", value: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", type: WEAKREFERENCE}
]
```

> After uploading, publish the files folder so images are accessible on the live site:
> ```bash
> curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
>   -X POST http://localhost:8080/modules/graphql \
>   -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/SITE_KEY/files\") { publish(languages: [\"en\"]) } } }"}'
> ```

---

## Creating pages (jnt:page) — Area structure is mandatory

> ⚠️ If your task involves creating a **page**, read this section first.

In Jahia, a `jnt:page` uses a template that declares named **Areas**. Content added as **direct children of the page node** is silently ignored by the renderer — it will never appear on the page.

Content must be created as children of the **Area sub-node** (e.g. `/sites/mySite/home/my-page/AREA_NAME/hero`).

### Step A — Discover the correct Area structure from an existing page

Pick any working sibling page and inspect its children:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites/SITE_KEY/home\") { children { nodes { name primaryNodeType { name } children { nodes { name primaryNodeType { name } } } } } } } }"}'
```

Look for a child node that is a content list or area type (e.g. `jnt:contentList`, `jnt:area`, or a custom area type). Note its **name** — that is your Area node name.

### Step B — Check the page template

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites/SITE_KEY/home/EXISTING_PAGE\") { properties(names: [\"j:templateName\"]) { name value } } } }"}'
```

Use this exact template name for your new page.

### Step C — Create the page, then add content inside the Area

```bash
# 1. Create the page
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { addNode(parentPathOrId: \"/sites/SITE_KEY/home\", name: \"my-page\", primaryNodeType: \"jnt:page\", properties: [{name: \"jcr:title\", value: \"My Page\", language: \"en\"}, {name: \"j:templateName\", value: \"TEMPLATE_NAME\"}]) { uuid node { path } } } }"}'

# 2. Create the Area sub-node (same type and name as the sibling page's area)
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { addNode(parentPathOrId: \"/sites/SITE_KEY/home/my-page\", name: \"AREA_NAME\", primaryNodeType: \"AREA_TYPE\") { uuid node { path } } } }"}'

# 3. Add content INSIDE the area (not on the page directly)
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { addNode(parentPathOrId: \"/sites/SITE_KEY/home/my-page/AREA_NAME\", name: \"hero\", primaryNodeType: \"jnt:text\", properties: [{name: \"text\", value: \"<h1>Hello<\\/h1>\", language: \"en\"}]) { uuid node { path } } } }"}'
```

### Step D — Publish the page

```bash
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/SITE_KEY/home/my-page\") { publish(languages: [\"en\"]) } } }"}'
```

---

## Step 1 — Identify target site and content folder

Standard content folder paths:
- `/sites/<siteKey>/contents/articles/` — for article nodes
- `/sites/<siteKey>/contents/tutorials/` — for tutorial nodes
- `/sites/<siteKey>/contents/` — for any other content folder

---

## Step 2 — Look up the content type's properties

> 💡 **If the site is unfamiliar**, use **`/jahia-content-explore-structure`** first.

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodeTypeByName(name: \"NAMESPACE:typeName\") { properties { name requiredType internationalized mandatory constraints } } } }"
  }'
```

---

## Step 3 — Create a node

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { addNode(parentPathOrId: \"/sites/mySite/contents/articles\", name: \"my-article\", primaryNodeType: \"namespace:docArticle\", properties: [{name: \"jcr:title\", value: \"My Article\", language: \"en\"}, {name: \"body\", value: \"<p>Content here</p>\", language: \"en\"}]) { uuid node { path } } } }"
  }'
```

### Property rules

| Situation | GraphQL syntax |
|-----------|---------------|
| i18n property (declared `i18n` in CND) | `{name: "body", value: "...", language: "en"}` |
| Non-i18n property | `{name: "product", value: "jahia"}` |
| Title (from `mix:title`) | `{name: "jcr:title", value: "...", language: "en"}` |
| Date property | `{name: "updatedAt", value: "2024-01-15T00:00:00.000Z", type: DATE}` |
| Multiple values | `{name: "tags", values: ["a", "b"]}` |

### Node name rules
- Use lowercase kebab-case: `my-article`, `getting-started`
- No spaces, no special characters
- Must be unique within the parent folder
- Use `useAvailableNodeName: true` to auto-suffix if name is taken

---

## Step 4 — Publish the node

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/my-article\") { publish(languages: [\"en\"]) } } }"
  }'
```

Expected response: `{"data": {"jcr": {"mutateNode": {"publish": true}}}}`

---

## Step 5 — Batch creation

To create multiple nodes efficiently, use `addNodesBatch`:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { addNodesBatch(nodes: [{parentPathOrId: \"/sites/mySite/contents/articles\", name: \"article-1\", primaryNodeType: \"namespace:docArticle\", properties: [{name: \"jcr:title\", value: \"Article One\", language: \"en\"}, {name: \"body\", value: \"<p>Body 1</p>\", language: \"en\"}]}, {parentPathOrId: \"/sites/mySite/contents/articles\", name: \"article-2\", primaryNodeType: \"namespace:docArticle\", properties: [{name: \"jcr:title\", value: \"Article Two\", language: \"en\"}, {name: \"body\", value: \"<p>Body 2</p>\", language: \"en\"}]}]) { uuid node { path } } } }"
  }'
```

Then publish all at once using `mutateNodesByQuery`:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNodesByQuery(query: \"SELECT * FROM [namespace:docArticle] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents/articles\u0027)\", queryLanguage: SQL2) { publish(languages: [\"en\"]) } } }"
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
    "query": "{ jcr { nodesByQuery(query: \"SELECT * FROM [namespace:docArticle] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents/articles\u0027)\", queryLanguage: SQL2) { nodes { name path properties(names: [\"jcr:title\"], language: \"en\") { name value } } } } }"
  }'
```

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied` | Missing `Origin` header | Add `-H "Origin: http://localhost:8080"` |
| `Couldn't find definition for property X` | Wrong property name or non-i18n prop given with `language:` | Check CND definition; remove `language:` for non-i18n props |
| `ConstraintViolationException: mandatory property` | A mandatory CND property was not provided | Provide all mandatory properties |
| `ItemExistsException` | Node name already taken | Use `useAvailableNodeName: true` or choose a different name |
| WEAKREFERENCE image constraint error | Uploaded file missing `jmix:image` mixin | Always include `mixins: ["jmix:image"]` in the `addNode` upload mutation |
| `deletePropertiesBatch fails with missing required fields` | `language` is NON_NULL in `InputJCRDeletedProperty` — required even for non-i18n properties | Always provide `language: "en"` in every `deletePropertiesBatch` entry |

---

## Setting `j:linkType` links via GraphQL

> 🚫 **NEVER use `j:linkType: "external"` to link to an internal Jahia page.** Always use `"internal"` with `j:linknode`. Hardcoding an internal URL as an external link will break on environment changes, language switching, vanity URLs, and live/preview workspace toggling.

### Internal link (`j:linkType: "internal"`)

`j:linknode` is an **internationalized** weakreference. Add the mixin first, then set the property with `language:`.

```graphql
# Step 1 — add mixin + set j:linkType
mutation {
  jcr {
    mutateNode(pathOrId: "/sites/mySite/home/features/my-card") {
      addMixins(mixins: ["jmix:internalLink"])
      setPropertiesBatch(properties: [
        {name: "j:linkType", value: "internal"}
      ]) { path }
    }
  }
}

# Step 2 — set j:linknode (i18n weakreference — must include language)
mutation {
  jcr {
    mutateNode(pathOrId: "/sites/mySite/home/features/my-card") {
      mutateProperty(name: "j:linknode") {
        setValue(value: "<target-node-uuid>", language: "en", type: WEAKREFERENCE)
      }
    }
  }
}
```

### External link (`j:linkType: "external"`)

```graphql
mutation {
  jcr {
    mutateNode(pathOrId: "/sites/mySite/home/features/my-card") {
      addMixins(mixins: ["jmix:externalLink"])
      setPropertiesBatch(properties: [
        {name: "j:linkType", value: "external"}
        {name: "j:url", value: "https://example.com", language: "en"}
        {name: "j:linkTitle", value: "Visit Example", language: "en"}
      ]) { path }
    }
  }
}
```

---

## References

- Jahia GraphQL API playground: `http://localhost:8080/modules/graphql` (GET in browser, POST for queries)
- JCR mutation docs: https://academy.jahia.com/documentation/developer/jahia/8/api-documentation/graphql-api
- Native Jahia node types (CND source): https://github.com/Jahia/jahia/tree/master/war/src/main/webapp/WEB-INF/etc/repository/nodetypes
