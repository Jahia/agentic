---
name: jahia-content-translate-content
description: Adds language support to a Jahia site and translates existing content nodes using MCP tools. Use when asked to add a new language, fill in missing translations, or audit which content lacks i18n values.
---

# Skill: jahia-content-translate-content

Translates existing content and manages multi-language support using MCP tools (via the `my-jahia` MCP server).

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `my-jahia` connected with a valid API token
- Know the target **siteKey** (call `site.list` if unsure)

---

## Step 1 — Check site languages

```
tool: site.get
args: { "siteKey": "SITE_KEY" }
```

Check the `languages` array and `defaultLanguage`. If the target language is not in `languages`, it must be added via the Jahia admin before translations can be created.

---

## Step 2 — Read existing content in the source locale

Get the content you want to translate:

```
tool: content.get
args: { "path": "/sites/SITE_KEY/home/about/main/intro-text" }
```

This returns all properties in the default locale. Note the i18n properties that need translation (typically `jcr:title`, `text`, `body`, etc.).

To find all content of a type:

```
tool: content.search
args: {
  "siteKey": "SITE_KEY",
  "nodeType": "jmix:droppableContent",
  "locale": "en",
  "limit": 50
}
```

---

## Step 3 — Set translated properties

Use `content.update` with the target `locale` to set translated values:

```
tool: content.update
args: {
  "path": "/sites/SITE_KEY/home/about/main/intro-text",
  "locale": "fr",
  "properties": {
    "jcr:title": "À propos",
    "text": "<p>Bienvenue sur notre site.</p>"
  }
}
```

### Key rules for translations:

- **Always set all mandatory i18n properties in one call.** Partial updates may trigger constraint violations.
- **Only i18n properties need translation.** Non-i18n properties (like `image` references, `j:view`) are locale-independent.
- **Use `content.type` to check which properties are i18n:**
  ```
  tool: content.type
  args: { "name": "jnt:bigText" }
  ```
  Look for `internationalized: true` in the property definitions.

---

## Step 4 — Translate page titles

Pages also have i18n titles:

```
tool: content.update
args: {
  "path": "/sites/SITE_KEY/home/about",
  "locale": "fr",
  "properties": {
    "jcr:title": "À propos"
  }
}
```

---

## Step 5 — Verify translations

Check that translated content is set correctly:

```
tool: content.search
args: {
  "siteKey": "SITE_KEY",
  "nodeType": "jmix:droppableContent",
  "locale": "fr",
  "limit": 20,
  "projectProperties": ["jcr:title"]
}
```

Or preview the page in the target locale (if page.preview supports locale):

```
tool: page.preview
args: { "path": "/sites/SITE_KEY/home/about" }
```

---

## Step 6 — Publish translations

After translating, publish the affected pages with the new language:

```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"mutation { jcr { mutateNode(pathOrId: \"/sites/SITE_KEY/home/about\") { publish(languages: [\"en\", \"fr\"]) } } }"}'
```

> Include **both** the original and new language in the `languages` array to ensure all translations are published.

---

## Common patterns

### Translate all content under a page

1. List all content in the page:
   ```
   tool: page.structure
   args: { "path": "/sites/SITE_KEY/home/about" }
   ```

2. For each content node, read its source locale properties:
   ```
   tool: content.get
   args: { "path": "<node-path>" }
   ```

3. Translate and update each node:
   ```
   tool: content.update
   args: {
     "path": "<node-path>",
     "locale": "fr",
     "properties": { "jcr:title": "...", "text": "..." }
   }
   ```

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `MANDATORY_PROPERTY_MISSING` | Not all mandatory i18n props set | Set all mandatory i18n properties in one `content.update` call |
| Language not available | Language not enabled on the site | Enable it via Jahia admin first |
| Properties appear empty | Wrong `locale` passed | Verify with `site.get` which locales are configured |
