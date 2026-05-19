---
name: jahia-content-explore-structure
user-invocable: false
description: Efficiently maps an unknown Jahia website's content structure before creating or editing content. Discovers available content types, their properties (i18n vs non-i18n), valid enum values, mixin requirements, and image assets — in the minimum number of API calls. Works on any Jahia instance including fresh installs with no reference site.
---

# Skill: jahia-content-explore-structure

Use this skill **before** creating content on an unfamiliar Jahia site. It produces a reusable property map so that `/jahia-content-create-content` can work without trial-and-error mutations.

**No reference site required.** All content type definitions, property names, i18n flags, and enum constraints are retrieved directly from the GraphQL API via the `nodeTypeByName` and `nodeTypes` queries.

---

## Prerequisites

- Jahia running at `http://localhost:8080`
- Credentials: `root` / `root1234`
- Always include `-H "Origin: http://localhost:8080"` — omitting it causes `Permission denied`

---

## Step 1 — Batch site exploration (ONE call)

Use GraphQL aliases to retrieve everything you need in a **single HTTP request**: site metadata, page structure, file assets, and available content types.

First, find the site key:
```bash
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites\") { children { nodes { name } } } } }"}'
```

Then run the full batch query (replace `SITE_KEY` and `TEMPLATE_MODULE`):
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { site: nodeByPath(path: \"/sites/SITE_KEY\") { properties(names: [\"j:templatesSet\",\"j:defaultLanguage\"]) { name value } } home: nodeByPath(path: \"/sites/SITE_KEY/home\") { children { nodes { name primaryNodeType { name } children { nodes { name primaryNodeType { name } } } } } } files: nodeByPath(path: \"/sites/SITE_KEY/files\") { children { nodes { name uuid } } } contentTypes: nodeTypes(filter: {siteKey: \"SITE_KEY\", includeMixins: false, includeAbstract: false}) { nodes { name systemId } } } }"}'
```

From the response:
- `site.properties` → `j:templatesSet` (the template module name) and `j:defaultLanguage`
- `home.children` → page area structure; look for area nodes and check their children to see which content types are in use
- `files.children` → existing file folders and UUIDs
- `contentTypes.nodes` → all deployed types; filter by `systemId` matching `j:templatesSet` to find the site's own types

---

## Step 2 — Get ALL type definitions for the template module (ONE call)

Once you know `j:templatesSet` (e.g. `mymodule`) from Step 1, fetch **every type with all its properties** in a single call:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodeTypes(filter: {modules: [\"TEMPLATE_MODULE\"], includeMixins: false, includeAbstract: false}) { nodes { name mixin supertypes { name } properties { name requiredType internationalized mandatory multiple constraints } nodes { name mandatory requiredPrimaryType { name } } } } } }"
  }'
```

> ✅ **This is the only type-definition call you need.** The `properties` array already includes **all inherited properties from supertypes and mixins** — the Jahia GraphQL API resolves inheritance automatically. Do **NOT** query supertypes separately, do **NOT** call `nodeTypeByName` for individual types, do **NOT** query mixin definitions.

If you also need properties from standard Jahia types (e.g. `jnt:bigText`, `jnt:text`), add them with `nodeTypesByNames`:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeTypesByNames(names: [\"jnt:bigText\", \"jnt:text\"]) { name properties { name requiredType internationalized mandatory constraints } } } }"}'
```

---

## Step 3 — Identify image assets

File assets are already returned by the Step 1 batch query under `files.children`. No additional call needed unless you need UUIDs of files inside sub-folders:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites/SITE_KEY/files/SUBFOLDER\") { children { nodes { name uuid } } } } }"}'
```

> `image` properties have `requiredType: WEAKREFERENCE`. Set them with `type: WEAKREFERENCE` and the file node UUID. The file must have `jmix:image` mixin — always include `mixins: [\"jmix:image\"]` when uploading (see `/jahia-content-create-content`).

---

## Step 4 — Build the property map

After Step 2, summarise the data before creating content:

```
Content type: NAMESPACE:typeName
Supertypes: [from API response — no need to query separately]
Required mixins (must be in addNode mixins[]): jmix:renderable, jmix:internalLink, etc.

Mandatory non-i18n properties (set in addNode, no language needed):
  image          WEAKREF   UUID of jmix:image file

i18n properties (set with language: "en" in mutation):
  jcr:title      STRING    from mix:title
  body           STRING    rich HTML text

Optional non-i18n:
  [name]         STRING    value1 | value2  (from constraints array)

Mixin properties (set AFTER addNode in a separate mutation):
  j:view         STRING    (from jmix:renderable)
  j:linknode     WEAKREF   i18n  (from jmix:internalLink)
  j:url          STRING    i18n  (from jmix:externalLink — set with language: "en")
```

---

## Critical gotchas

### 1. `j:view` cannot be set in `addNode` — set it after

```graphql
# Step 1: create node with mixin declared
addNode(... mixins: ["jmix:renderable"] ...)

# Step 2: set j:view in a separate mutation
mutateNode(...) { mutateProperty(name: "j:view") { setValue(value: "cover") } }
```

### 2. `j:url` (from `jmix:externalLink`) requires `language: "en"` — it is an i18n property

```graphql
addNode(
  mixins: ["jmix:externalLink"]
  properties: [
    {name: "j:url", type: STRING, value: "https://example.com", language: "en"}
  ]
)
```

### 3. GraphQL `properties()` without `language:` hides i18n property values at query time

When **reading** existing nodes: use `properties(language: "en")`. When **writing** i18n properties: add `language: "en"` to the `setValue` call.

---

## Next step — Create content with the property map

Once you have the property map from Step 4, hand it off to **`/jahia-content-create-content`**:

- Use the mandatory properties list to populate `addNode` / `addChild` mutations correctly the first time
- Use the i18n flags to know which properties need `language: "en"`
- Use the enum constraints to pass only valid values
- Use nested `addChild` calls to create an entire content tree in one mutation (see the `⚡ Minimum-call workflow` section in `/jahia-content-create-content`)

> Skipping this skill and guessing property names leads to `ConstraintViolationException` and `Couldn't find definition for property` errors. Always explore first.

---

## References

- GraphQL API playground: `http://localhost:8080/modules/graphql`
- GraphQL schema introspection for node type fields: `{ __type(name: "JCRNodeType") { fields { name } } }`
- GraphQL schema introspection for property definition fields: `{ __type(name: "JCRPropertyDefinition") { fields { name } } }`
