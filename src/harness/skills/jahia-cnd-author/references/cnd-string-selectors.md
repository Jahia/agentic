# CND String & Selector Properties

## String type variants

| Type declaration | Editor widget | When to use |
|---|---|---|
| `(string)` | Single-line text input | Short labels, IDs, slugs |
| `(string, textarea)` | Multi-line text area | Paragraphs, descriptions |
| `(string, richtext)` | Rich text editor (TinyMCE) | Body content, formatted text |
| `(string) multiple` | Tag input / list | Lists of plain strings |

## Fixed-choice dropdowns

Use `(string, choicelist)` + `< 'val1', 'val2'` for a dropdown with a hard-coded list.
**Never use `choicelist[val1,val2]`** — the bracket syntax is for initializer keywords, not values.

```cnd
- difficulty (string, choicelist) i18n < 'beginner', 'intermediate', 'advanced'
- variant (string, choicelist) < 'primary', 'secondary', 'ghost'
```

## `mix:title` instead of a title string property

**NEVER write `- title (string) i18n mandatory`.**
Extend `mix:title` instead — it adds `jcr:title`, which Jahia's UI, breadcrumbs, and search use natively.

```cnd
// ✅ Correct
[ns:heroSection] > jnt:content, nsmix:component, mix:title

// ❌ Wrong — duplicates what mix:title already provides
[ns:heroSection] > jnt:content, nsmix:component
 - title (string) i18n mandatory
```

Access in the view as `props["jcr:title"]`.

## Link picker — `choicelist[linkTypeInitializer]`

**NEVER use `(string)` for a link, URL, href, or path.**
Use `choicelist[linkTypeInitializer]` — it renders an internal/external/none picker in the editor.

**Declare ONLY `j:linkType` in the CND. Do NOT add `j:linknode` or `j:url` — Jahia injects them automatically.**

```cnd
// ✅ Correct — bare minimum
[ns:callToAction] > jnt:content, nsmix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory

// ❌ Wrong — do not declare companion fields
 - j:linknode (weakreference)   // injected by Jahia — remove this
 - j:url (string)               // injected by Jahia — remove this
```

TypeScript discriminated union for the view:

```ts
import type { JCRNodeWrapper } from "org.jahia.services.content";
export type Props =
  | { label?: string; "j:linkType": "none" }
  | { label?: string; "j:linkType": "internal"; "j:linknode"?: JCRNodeWrapper }
  | { label?: string; "j:linkType": "external"; "j:url"?: string; "j:linkTitle"?: string };
```

In the view, switch on `props["j:linkType"]`.

## Other `choicelist[...]` initializers

| Initializer | What it renders |
|---|---|
| `choicelist[country]` | Country selector (ISO codes, localized labels) |
| `choicelist[resourceBundle]` | Labels from `.properties` file keys |
| `choicelist[nodes=/path;type=jnt:content]` | Nodes under a JCR path |
| `choicelist[componentTypes=jnt:page]` | Registered views of a node type |
| `choicelist[menus]` | Site menus |

## Regex constraints on strings

```cnd
- contactEmail (string) < '^$|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
- slug (string) < '^[a-z0-9-]+$'
- externalUrl (string) < '^https?://'
```

## Common attributes

| Attribute | Meaning |
|---|---|
| `i18n` | Translatable per language — **default to always on user-facing fields** |
| `mandatory` | Required |
| `multiple` | List of values |
| `primary` | Highlighted field in editor (one per type) |
| `autocreated` | Auto-created on node creation — always combine with `= 'defaultValue'` |
