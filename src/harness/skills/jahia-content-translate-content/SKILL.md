---
name: jahia-content-translate-content
description: Adds language support to a Jahia site and translates existing content nodes. Use when asked to add a new language, fill in missing translations, or audit which content lacks i18n values.
---

# Skill: jahia-content-translate-content

Adds languages to a Jahia site and populates i18n properties on existing content nodes via the GraphQL API.

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

## Step 1 — Enable the new language on the site

Before creating or querying translations, the language must be declared on the site node.

```bash
# Check currently enabled languages
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodeByPath(path: \"/sites/mySite\") { properties(names: [\"j:languages\",\"j:defaultLanguage\"]) { name values } } } }"
  }'

# Add a language (e.g. "fr") — use setPropertiesBatch with the full new list
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite\") { setPropertiesBatch(properties: [{name: \"j:languages\", values: [\"en\", \"fr\"]}]) { path } } } }"
  }'
```

> ⚠️ `j:languages` is a multi-valued property — always pass the **complete** list of languages, not just the new one. Passing only `["fr"]` would remove `"en"`.

---

## Step 2 — Audit content missing translations

Query all i18n-bearing nodes and inspect which ones have empty values for the target language:

```bash
# Find all content nodes under /sites/mySite/contents
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodesByQuery(query: \"SELECT * FROM [jmix:i18n] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents\u0027) ORDER BY [jcr:path] ASC\", queryLanguage: SQL2) { nodes { path primaryNodeType { name } properties(language: \"fr\") { name value } } } } }"
  }'
```

Or query a specific content type:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodesByQuery(query: \"SELECT * FROM [namespace:article] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents\u0027)\", queryLanguage: SQL2) { nodes { path properties(language: \"fr\") { name value } } } } }"
  }'
```

Look for nodes where i18n fields (`jcr:title`, `body`, etc.) have empty or null `value`.

---

## Step 3 — Set i18n properties

### Single node

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/my-article\") { setPropertiesBatch(properties: [{name: \"jcr:title\", value: \"Mon article\", language: \"fr\"}, {name: \"body\", value: \"<p>Contenu ici</p>\", language: \"fr\"}]) { path } } } }"
  }'
```

> ⚠️ Use `setPropertiesBatch` (plural), not `setProperty` (singular — does not exist in the Jahia GraphQL API).

### Critical ordering rule

When a content type has **mandatory** i18n fields (other than `jcr:title`), set those **before** `jcr:title`. Setting `jcr:title` first can trigger a constraint check before all mandatory fields are present.

The safe pattern — set all mandatory i18n fields in a single `setPropertiesBatch` call:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/my-article\") { setPropertiesBatch(properties: [{name: \"body\", value: \"<p>Contenu ici</p>\", language: \"fr\"}, {name: \"jcr:title\", value: \"Mon article\", language: \"fr\"}]) { path } } } }"
  }'
```

---

## Step 4 — Bulk translation with Python

For translating many nodes at once:

```python
import json
from urllib.request import Request, urlopen

JAHIA = "http://localhost:8080"
AUTH = ("root", "root1234")

import base64
token = base64.b64encode(f"{AUTH[0]}:{AUTH[1]}".encode()).decode()
HEADERS = {
    "Content-Type": "application/json",
    "Origin": JAHIA,
    "Authorization": f"Basic {token}",
}

def gql(query):
    body = json.dumps({"query": query}).encode()
    req = Request(f"{JAHIA}/modules/graphql", data=body, headers=HEADERS, method="POST")
    with urlopen(req) as r:
        d = json.loads(r.read())
    if "errors" in d:
        print("ERR:", d["errors"][0]["message"][:120])
    return d

# 1. List all articles missing French title
result = gql(
    '{ jcr { nodesByQuery(query: "SELECT * FROM [namespace:article] '
    "WHERE ISDESCENDANTNODE('/sites/mySite/contents') "
    'ORDER BY [jcr:path] ASC", queryLanguage: SQL2) '
    '{ nodes { path properties(language: "fr") { name value } } } } }'
)

nodes = result["data"]["jcr"]["nodesByQuery"]["nodes"]
missing_fr = [
    n["path"]
    for n in nodes
    if not any(p["name"] == "jcr:title" and p["value"] for p in n["properties"])
]

# 2. Set French translations (replace with actual translated values)
translations = {
    "/sites/mySite/contents/articles/article-1": ("Titre FR 1", "<p>Corps FR 1</p>"),
    "/sites/mySite/contents/articles/article-2": ("Titre FR 2", "<p>Corps FR 2</p>"),
}

for path, (title, body) in translations.items():
    r = gql(
        f'mutation {{ jcr {{ mutateNode(pathOrId: "{path}") {{'
        f' setPropertiesBatch(properties: ['
        f'  {{name: "body", value: {json.dumps(body)}, language: "fr"}},'
        f'  {{name: "jcr:title", value: {json.dumps(title)}, language: "fr"}}'
        f' ]) {{ path }} }} }} }}'
    )
    ok = "errors" not in r
    print(f"  {'✓' if ok else '✗'} {path.split('/')[-1]}")
```

---

## Step 5 — Choicelist fields and view-level translations

### Choicelist fields should NOT be i18n

If a CND property uses a choicelist (e.g. `category`, `status`), its stored values are language-agnostic keys like `"featured"` or `"draft"`. The display label is translated **in the view**, not in the JCR.

```tsx
// In the view component — translate the stored key to a display label
const STATUS_LABELS: Record<string, Record<string, string>> = {
  en: { featured: "Featured", draft: "Draft" },
  fr: { featured: "En vedette", draft: "Brouillon" },
};

const lang = renderContext.getMainResourceLocale().getLanguage();
const statusKey = properties.status as string;
const statusLabel = STATUS_LABELS[lang]?.[statusKey] ?? statusKey;
```

Do **not** add `i18n` to the CND property for choicelists — the key should be the same in all languages.

### Hardcoded UI strings

View-level strings that are not stored in JCR (button labels, headings, placeholder text) need locale-keyed label maps in the component:

```tsx
const LABELS = {
  en: { readMore: "Read more", by: "By" },
  fr: { readMore: "Lire la suite", by: "Par" },
};

const t = LABELS[renderContext.getMainResourceLocale().getLanguage()] ?? LABELS.en;
// Usage: <a>{t.readMore}</a>
```

---

## Step 6 — Clean up orphaned translation nodes

When you remove the `i18n` flag from a CND property (or delete a language from the site), orphaned `j:translation_XX` child nodes may remain. Inspect and remove them if needed:

```bash
# Find translation sub-nodes for a content node
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "{ jcr { nodeByPath(path: \"/sites/mySite/contents/articles/my-article\") { children { nodes { name primaryNodeType { name } } } } } }"
  }'

# Delete an orphaned translation node
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { deleteNode(pathOrId: \"/sites/mySite/contents/articles/my-article/j:translation_fr\") }"
  }'
```

---

## Step 7 — Publish translations

After setting i18n properties, republish to make them live:

```bash
# Publish a single node for a specific language
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNode(pathOrId: \"/sites/mySite/contents/articles/my-article\") { publish(languages: [\"fr\"]) } } }"
  }'

# Publish all articles in both languages
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{
    "query": "mutation { jcr { mutateNodesByQuery(query: \"SELECT * FROM [namespace:article] WHERE ISDESCENDANTNODE(\u0027/sites/mySite/contents\u0027)\", queryLanguage: SQL2) { publish(languages: [\"en\", \"fr\"]) } } }"
  }'
```

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied` | Missing `Origin` header | Add `-H "Origin: http://localhost:8080"` |
| i18n property returned empty after set | Missing `language:` in `properties()` query | Add `language: "fr"` to read call |
| `ConstraintViolationException` on title set | Mandatory i18n field not set first | Use `setPropertiesBatch` with all mandatory fields in one call |
| Language not appearing in site | `j:languages` mutation only had the new language | Pass the full list: `["en", "fr"]` |
| Choicelist key changed per language | Property incorrectly declared `i18n` in CND | Remove `i18n` from the CND property; translate keys in the view |

---

## Workflow summary

```
1. Enable language   → mutateNode j:languages with full list
2. Audit             → nodesByQuery with properties(language: "XX") to find gaps
3. Translate         → setPropertiesBatch with language: "XX" for each i18n field
4. View strings      → add locale-keyed label maps in .server.tsx
5. Choicelists       → translate keys in the view, not the JCR
6. Publish           → publish(languages: ["XX"]) for all affected nodes
7. Verify            → query back with language: "XX" to confirm values
```
