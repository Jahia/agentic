---
name: jahia-content-translate-content
description: Adds site languages and translates existing Jahia content using MCP tools. Use when asked to enable a locale, fill in missing translations, or publish translated pages and content.
---

# Skill: jahia-content-translate-content

Translates existing content and manages multi-language support using MCP tools via the `jahia` MCP server.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Prerequisites

- MCP server `jahia` connected with a valid API token
- Know the target `siteKey` (call `site.list` if unsure)
- Content already exists in a source locale

---

## Step 1 — Check site languages

```
tool: site.get
args: { "siteKey": "SITE_KEY" }
```

Check `languages` and `defaultLanguage`.

- If the target locale is already present, continue.
- If the target locale is missing, add it to the site first before writing translations.

---

## Step 2 — Read the source content

```
tool: content.get
args: {
  "path": "/sites/SITE_KEY/home/about/main/intro-text",
  "locale": "en"
}
```

Note the properties that actually contain human-readable text.

To find a batch of nodes to translate:

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

## Step 3 — Identify which properties are i18n

```
tool: content.type
args: { "name": "jnt:bigText" }
```

Translate only properties marked as internationalized.

Common i18n properties:
- `jcr:title`
- `text`
- `body`
- `description`
- `subtitle`

Common non-i18n properties:
- `j:view`
- `j:templateName`
- `jcr:primaryType`
- references such as `j:node`
- numeric or technical settings

---

## Step 4 — Write translated properties

Use `content.update` with the target locale:

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

Key rules:
- Set all mandatory i18n properties in the same call.
- Translate only i18n properties.
- Preserve the HTML structure for rich text.
- Do not translate technical choicelist values.

---

## Step 5 — Translate page titles

Page titles are also i18n:

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

## Step 6 — Verify translations

Check the translated locale directly:

```
tool: content.get
args: {
  "path": "/sites/SITE_KEY/home/about/main/intro-text",
  "locale": "fr"
}
```

Or search in the target locale:

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

---

## Step 7 — Publish the translated locale

Publish the page or subtree in the target language:

```
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/about",
  "languages": ["fr"]
}
```

If the translation touches both a page and child content, publish the page path so the subtree is included.

---

## Common patterns

### Translate all content under a page

1. Discover the page structure:
   ```
   tool: page.structure
   args: { "path": "/sites/SITE_KEY/home/about" }
   ```
2. Read each child node in the source locale:
   ```
   tool: content.get
   args: { "path": "CHILD_PATH", "locale": "en" }
   ```
3. Write translated values to the target locale:
   ```
   tool: content.update
   args: {
     "path": "CHILD_PATH",
     "locale": "fr",
     "properties": { "jcr:title": "...", "text": "..." }
   }
   ```
4. Publish the page in the new language.

### Audit whether a page is publish-ready in the new locale

```
tool: publication.status
args: {
  "path": "/sites/SITE_KEY/home/about",
  "language": "fr",
  "subNodes": true,
  "references": true
}
```

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `MANDATORY_PROPERTY_MISSING` | Not all required i18n properties were set | Set all mandatory translated properties in one `content.update` call |
| Language not available | Locale not enabled on the site | Add the locale to the site first |
| Properties appear empty | Wrong locale was used | Verify configured locales with `site.get` |
| Translation not visible on the public site | It is still only in EDIT | Publish with `publication.publish` |

---

## Related skills

- `/jahia-content-explore-structure` — find the right pages, nodes, and types first
- `/jahia-content-publish` — publish translated content and inspect language-scoped status
- `/jahia-content-create-content` — create new pages or content that will later need translation

