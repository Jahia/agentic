# Jahia Native Mixins & Types

Source: https://github.com/Jahia/jahia/tree/master/war/src/main/webapp/WEB-INF/etc/repository/nodetypes
Fetch this URL to verify before using any mixin not listed here.

## Base types — always extend these

| Type | Purpose |
|---|---|
| `jnt:content` | Base for all user content nodes — **always include** |
| `jnt:page` | Page node — only for `jmix:mainResource` full-page types |
| `jnt:file` | File node — for file references |

## Mixins by use case

### `mix:title` — preferred over a raw title property

Adds `jcr:title` (string). Jahia's UI, breadcrumbs, SEO, and sitemap generation all read `jcr:title`.
**Extend this instead of declaring `- title (string) i18n mandatory`.**

```cnd
[ns:article] > jnt:content, nsmix:component, mix:title
```

Access in view: `props["jcr:title"]`

### `jmix:mainResource` — full-page content types only

Makes a node accessible at its own URL. Use **only** for content that needs both a listing card AND a detail page (e.g. blog posts, team members, events). Do not add to navigation or visual composition types.

```cnd
[ns:blogPost] > jnt:content, mix:title, jmix:mainResource, nsmix:component
```

### `jmix:image` — image constraint for weakreference

Use as the type constraint on image weakreference properties:

```cnd
- backgroundImage (weakreference, picker[type='image']) < jmix:image
```

**Never use `< 'jnt:file'`** (quoted string form) — it does not enforce image type correctly.

**Never declare `imageAlt (string) i18n`** alongside an image weakreference. The referenced image node already has `jcr:title` (from `mix:title`). Use that as the alt text in the view:

```tsx
const imageNode = props["image"] as JCRNode | undefined;
const imageAlt = imageNode?.["jcr:title"] ?? "";
```

Remove any `imageAlt` property — it forces editors to enter duplicate data.

### `jmix:droppableContent` — never extend directly

Always define a module-level component mixin and extend that:

```cnd
// In settings/definitions.cnd
[nsmix:component] > jmix:droppableContent, jmix:accessControllableContent mixin
```

Then all component types extend `nsmix:component`.

### `jmix:hiddenType` — hide from Page Builder picker

Structural/container types editors should not add manually:

```cnd
[ns:ctaContainer] > jnt:content, jmix:hiddenType orderable
```

**Never use `jmix:studioOnly`** — it causes silent rendering issues in some contexts.

### `jmix:accessControllableContent` — per-component access control

Add to your base module mixin so all components support it:

```cnd
[nsmix:component] > jmix:droppableContent, jmix:accessControllableContent mixin
```

### `jmix:link` — built-in link type

Provides `j:linkType`, `j:linknode`, `j:url`, `j:linkTitle`. Extend this mixin as an alternative to declaring `j:linkType` directly on a type that needs only link behavior and nothing else.

## picker[] selector

| Selector | Use |
|---|---|
| `picker[type='image']` | Image assets only |
| `picker[type='file']` | Any file asset |

```cnd
- backgroundImage (weakreference, picker[type='image']) < jmix:image
- attachment (weakreference, picker[type='file']) < jnt:file
```

## Two-tier component mixin system

If the module uses custom area types (see `jahia-dev-create-page-template`):

```cnd
[nsmix:component]     > jmix:droppableContent, jmix:accessControllableContent mixin
[nsmix:pageComponent] > nsmix:component mixin
```

| Component will be… | Extend |
|---|---|
| Dropped in page areas | `nsmix:pageComponent` |
| Child of another component | `nsmix:component` |
| Listed programmatically | `nsmix:component` |

A component extending only `nsmix:component` **cannot** be dropped in areas that use `nsmix:pageComponent`.
