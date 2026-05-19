---
name: jahia-dev-define-content-type
description: Creates a Jahia CND content type definition from a natural language description. Use when asked to model content, create a new content type, or define node types.
---

## Overview

All Jahia development starts with content modeling. Content types are defined in **CND files** (Compact Node Definition). Each component follows the **Single Directory Component (SDC)** pattern: one folder per component, containing a `definition.cnd`, a view, and optional CSS.

---

## Step 0 — Write a spec before coding

Before writing any CND, capture the content type spec. Ask the user to confirm:

| Field | Answer |
|---|---|
| **Name** | e.g. `BlogPost` |
| **Description** | What is this type for? |
| **Fields** | name / type / i18n? / mandatory? |
| **Views** | default only, or also: small / card / fullPage |
| **Used where** | Inside an Area? Nested in another type? |

Only proceed to the CND once this spec is agreed.

---

## Step 0b — Modeling decisions

### Semantic vs generic types

| Use **semantic types** for… | Use **generic types** for… |
|---|---|
| Business entities: articles, team members, events | Visual composition: banners, feature rows |
| Items that appear in listings | One-off sections, layout containers |
| Anything reused across pages | Unique per-page UI blocks |

### Children vs weakreference

| Use **child nodes** when… | Use **weakreference** when… |
|---|---|
| Parent is the visual container (e.g. CTA buttons inside a hero) | Linking to content managed elsewhere |
| Children have no life outside the parent | Many-to-many relationships |
| You always create the children together | Content editors need to reuse the referenced item |

### Never use `jmix:droppableContent` directly

Always define a custom component mixin for your module and extend it:

```cnd
// In settings/definitions.cnd
[namespacemix:component] > jmix:droppableContent mixin
```

Then all component types extend `namespacemix:component` — **never** `jmix:droppableContent` directly. This is what controls which types appear in the content picker.

### Two-tier mixin system: `component` vs `pageComponent`

If the module uses a custom area type with `pageComponent` (see `jahia-dev-create-page-template`), there are two tiers:

```cnd
[namespacemix:component]     > jmix:droppableContent mixin   // general droppable
[namespacemix:pageComponent] > namespacemix:component mixin  // for page areas only
```

**When creating a new content type, choose the right mixin:**

| Component will be… | Extend |
|---|---|
| Dropped in page areas (hero, sections, cards on a page) | `namespacemix:pageComponent` |
| Used only as a child of another component (e.g. CTA inside a hero) | `namespacemix:component` |
| A `jmix:mainResource` type stored in a content folder and listed programmatically | `namespacemix:component` |

> ⚠️ A component that extends only `namespacemix:component` **cannot be dropped in page areas** that use a `namespacemix:pageComponent` area type. This is the most common cause of editors not being able to contribute content to a new page.

---

## Step 1 — Identify the component location

CND files can live in two places:

- **Component-level** (preferred): `src/components/<Category>/<Name>/definition.cnd`
- **Module-level**: `settings/definitions.cnd` (for mixins and shared base types)

For a new standalone component, always create a component-level `definition.cnd`.

---

## Step 2 — Determine the namespace

Check `settings/definitions.cnd` for the module's namespace declaration. It looks like:

```
<ns = 'http://www.mymodule.com/...'>
```

The short prefix (e.g. `mymodule`) is the namespace to use for all node types in this module.

---

## Step 3 — Write the CND definition

### Basic template

```cnd
[namespace:typeName] > jnt:content, namespacemix:component
 - propertyName (type) [hints] [attributes] [< constraint]
 + childName (namespace:childType)
```

### Property types

| Type | Usage |
|---|---|
| `string` | Single-line text |
| `string, textarea` | Multi-line text |
| `string, richtext` | Rich text editor |
| `weakreference, picker[type='image']` | Image picker |
| `weakreference multiple` | List of references (e.g. links to multiple pages) |
| `string, choicelist[linkTypeInitializer]` | Link type discriminator (internal page / external URL / none) — **special initializer, not a value list** |
| `string, choicelist` with `< 'val1', 'val2'` constraints | Dropdown with fixed choices (see below) |
| `date` | Date picker |
| `boolean` | Checkbox |
| `double` | Decimal number (e.g. latitude/longitude) |
| `long` | Integer number |
| `string multiple` | List of strings |

### Fixed-choice dropdowns (constrained string)

Use `(string, choicelist)` combined with value constraints (`< 'val1', 'val2'`) to render a dropdown in the editor. **Do NOT use `choicelist[val1,val2]`** — that syntax is invalid:

```cnd
[namespace:article] > jnt:content
 - difficulty (string, choicelist) i18n < 'beginner', 'intermediate', 'advanced'
 - product (string, choicelist) i18n < 'jahia', 'jexperience', 'cloud'
```

> ⚠️ `choicelist[linkTypeInitializer]` is a **special initializer keyword** (not a value list) — it is the only valid use of `choicelist[...]`. For fixed lists, always use `(string, choicelist)` + `< 'val1', 'val2'`.

Use `< "[-90,90]"` to restrict a numeric property to a range:

```cnd
- latitude (double) mandatory < "[-90,90]"
- longitude (double) mandatory < "[-180,180]"
```

### `weakreference multiple` vs child nodes

| Use `weakreference multiple` when… | Use child nodes when… |
|---|---|
| Each item is just a reference (a page link, an image) | Each item has multiple properties (label + URL) |
| The list is simpler to author and implement | Items need a rich editing interface |

```cnd
// Simpler: list of page links (weakreference multiple)
[namespace:footer] > jnt:content, namespacemix:component
 - links (weakreference) multiple < jnt:page

// More flexible: each CTA has label + link (child nodes)
[namespace:heroSection] > jnt:content, namespacemix:component
 + * (namespace:heroCallToAction)
```

Render a `weakreference multiple` list in the view:

```tsx
// links is JCRNodeWrapper[] | undefined
{links?.filter(link => link !== null).map(link => (
  <a key={link.getPath()} href={buildNodeUrl(link)}>
    {link.getDisplayableName()}
  </a>
))}
```

### Common attributes

| Attribute | Meaning |
|---|---|
| `i18n` | Translatable per language |
| `mandatory` | Required field |
| `multiple` | Allows a list of values |
| `autocreated` | Auto-creates the node/property (combine with a default: `= 'value'`) |
| `orderable` | Allows reordering child nodes |

### `linkTypeInitializer` — the full link pattern

`choicelist[linkTypeInitializer]` creates a link picker where the editor selects *internal page*, *external URL*, or *none*. Declare **only the `j:linkType` field** in the CND — the companion fields `j:linknode` and `j:url` are **added automatically by Jahia's mixins** at runtime. Do NOT add them to your CND.

```cnd
[namespace:callToAction] > jnt:content, namespacemix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory
 // ✅ Stop here — j:linknode and j:url are injected by Jahia, not declared by you
```

In `types.ts`, use a **discriminated union** — the mixin fields ARE available at runtime as props:

```ts
import type { JCRNodeWrapper } from "org.jahia.services.content";

export type Props =
  | { label?: string; "j:linkType": "none" }
  | { label?: string; "j:linkType": "internal"; "j:linknode"?: JCRNodeWrapper }
  | { label?: string; "j:linkType": "external"; "j:url"?: string; "j:linkTitle"?: string };
```

In the view, use a `switch` on `props["j:linkType"]` (see `jahia-dev-create-view` skill).

### i18n rule

**Default to `i18n` on every user-facing field** — titles, subtitles, body text, button labels, alt text, captions, people names. Even on monolingual sites, adding `i18n` from the start avoids costly CND migrations later.

### Common mixins to extend

| Mixin | Adds |
|---|---|
| `jnt:content` | Base type for all user content (always include) |
| `namespacemix:component` | Makes this type available as a droppable component in Page Builder |
| `mix:title` | Adds a `jcr:title` field |
| `jmix:mainResource` | Makes the node accessible at its own URL — use only for content that needs **both a listing card AND a full detail page** (e.g. blog posts). Do not add to navigation-only or visual composition types. |
| `jmix:hiddenType` | Hides a type from the Page Builder component picker (use for structural/container nodes editors should not add manually). Prefer over `jmix:studioOnly` which can cause silent rendering issues. |
| `jmix:image` | Constraint: only image nodes |
| `jmix:link` | Built-in link type |

### Constraints

- `< jmix:image` — restricts a weakreference to image nodes only
- `< namespace:typeName` — restricts child nodes to a specific type

### Example — Hero Section with CTA (link pattern)

```cnd
[mymodule:heroSection] > jnt:content, mymodulemix:component
 - title (string) i18n mandatory
 - subtitle (string, textarea) i18n mandatory
 - background (weakreference, picker[type='image']) mandatory < jmix:image
 + * (mymodule:heroCallToAction)

[mymodule:heroCallToAction] > jnt:content, mymodulemix:component
 - title (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory
 // j:linknode and j:url are injected by Jahia — do not declare them
```

### Example — Blog Post

```cnd
[mymodule:blogPost] > jnt:content, mix:title, jmix:mainResource, mymodulemix:component
 - subtitle (string) i18n mandatory
 - authors (string) multiple
 - cover (weakreference, picker[type='image']) mandatory < jmix:image
 - body (string, richtext) i18n mandatory
 - publicationDate (date)
```

---

## Step 4 — Create a `types.ts` file

For each new content type, create a `types.ts` alongside the `definition.cnd` to define the TypeScript props interface. This will be imported by views.

> ⚠️ **All props must use `?:` (optional)** — even mandatory CND fields. Jahia does not guarantee a value is present at render time (e.g. content created before a field was added, or incomplete saves). If a view uses a prop without guarding it, it will crash at runtime.

```ts
import type { JCRNodeWrapper } from "org.jahia.services.content";

export interface Props {
  title?: string;
  subtitle?: string;
  background?: JCRNodeWrapper;
}
```

Map CND types to TypeScript:

| CND type | TypeScript type |
|---|---|
| `string` | `string` |
| `string` multiple | `string[]` |
| `weakreference` | `JCRNodeWrapper` |
| `weakreference` multiple | `JCRNodeWrapper[]` |
| `date` | `string` (ISO 8601) |
| `boolean` | `boolean` |
| `double` | `number` |
| `long` | `number` |

All fields use `?:` regardless of whether they are mandatory in the CND.

---

## Step 5 — Add UI translations and icon

Editors see raw technical names without translations. Always add labels for every new content type.

### Translations

Open `settings/resources/<module-name>.properties` (English) and `<module-name>_fr.properties` (French) and add:

```properties
# Node type label (shown in the content picker and editor)
namespace_typeName=Human-readable name

# Field labels
namespace_typeName.fieldName=Field label
namespace_typeName.fieldName.ui.tooltip=Optional tooltip shown next to the field in the editor.

# choicelist[resourceBundle] option labels
namespace_typeName.fieldName.optionKey=Option label
```

All `ui.tooltip` values support basic HTML. Escape `<` and `>` as `&lt;` and `&gt;`.

> For `choicelist[resourceBundle]` fields, the constraint values (e.g. `< 'house', 'apartment'`) must match the property keys (e.g. `namespace_type.field.house=House`).

### Icon

Create a 32×32 PNG icon at:

```
settings/content-types-icons/<cnd-namespace>_<typeName>.png
```

The prefix is the **CND namespace** (e.g. `mymodule`, `mymodulemix`), **not** the module name. For example:
- `mymodule_heroSection.png` ✅
- `my-module_heroSection.png` ❌ (module name with hyphen — wrong)

You can source free icons from [flaticon.com](https://www.flaticon.com/) (download at 32px). If no icon is available, copy an existing one as a placeholder — editors will see a blank space otherwise.

---

## Step 6 — Deploy to Jahia

After creating or modifying a `definition.cnd`, build and deploy the module:

```bash
# Always use this — never use yarn dev from an agent (it's interactive-only)
yarn build && yarn jahia-deploy
```

If Jahia rejects the type definition (e.g. breaking change), use the **Installed definitions browser** to remove the old definition first:
> http://localhost:8080/modules/tools/definitionsBrowser.jsp

---

## Validation checklist
- [ ] Spec confirmed before writing CND (name, fields, views, usage)
- [ ] Namespace matches the module (check `settings/definitions.cnd`)
- [ ] Extends `jnt:content` and appropriate mixins
- [ ] Uses `namespacemix:component` or `namespacemix:pageComponent` — **never** `jmix:droppableContent` directly
- [ ] All required properties have the `mandatory` attribute
- [ ] All user-facing string/text fields have `i18n` (default to always)
- [ ] Structural/container types have `jmix:hiddenType` (not shown in picker) — do NOT use `jmix:studioOnly`
- [ ] `jmix:mainResource` only used for listing + detail content (not visual composition)
- [ ] `types.ts` created with correct TypeScript types
- [ ] Views handle null/missing values gracefully (mandatory does not guarantee a value)
- [ ] Translation keys added to `.properties` files (EN + FR minimum)
- [ ] Icon created at `settings/content-types-icons/<namespace>_<typeName>.png`
- [ ] `yarn build && yarn jahia-deploy` run and type appears in Jahia content editor with correct label and icon

## Troubleshooting
> https://academy.jahia.com/tutorials-get-started/front-end-developer/making-a-hero-section

## References

- Native Jahia mixins & node types: https://github.com/Jahia/jahia/tree/master/war/src/main/webapp/WEB-INF/etc/repository/nodetypes
- Developer training: https://github.com/Jahia/developer-training/blob/main/js-training/slides.md
- JavaScript modules monorepo: https://github.com/Jahia/javascript-modules
- Preparing for i18n: https://academy.jahia.com/documentation/jahia-cms/jahia-8-2/developer/javascript-module-development/preparing-for-internationalization-i18n

> For CND questions about native mixins (e.g. does `jmix:nolive` exist?), fetch the nodetypes directory above to verify before using.
