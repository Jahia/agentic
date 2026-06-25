# CND Modeling Decisions

## Semantic vs generic types

| Use **semantic types** for… | Use **generic types** for… |
|---|---|
| Business entities: articles, team members, events | Visual composition: banners, feature rows |
| Items that appear in listings | One-off sections, layout containers |
| Anything reused across pages | Unique per-page UI blocks |

## Children vs weakreference

| Use **child nodes** when… | Use **weakreference** when… |
|---|---|
| Parent is the visual container (e.g. CTA buttons inside a hero) | Linking to content managed elsewhere |
| Children have no life outside the parent | Many-to-many relationships |
| You always create the children together | Content editors need to reuse the referenced item |
| Each item has multiple properties (label + link) | Each item is just a reference (a page, an image) |

## Mixins are the primary reuse mechanism

Whenever a set of properties appears on more than one type, extract them into a mixin in `settings/definitions.cnd`.

Common reusable mixin patterns:

| Mixin | Properties it adds | When to use |
|---|---|---|
| `nsmix:cta` | `ctaLabel`, `j:linkType` | Any type with a button or link |
| `nsmix:badge` | `badgeText`, `badgeColor` | Cards, teasers, labelled content |
| `nsmix:seo` | `metaTitle`, `metaDescription` | Any `jmix:mainResource` type |
| `nsmix:media` | `image` (weakreference) | Any type with a visual asset — alt text comes from the image node's `jcr:title`, never add a separate imageAlt property |

Example reusable CTA mixin:

```cnd
[nsmix:cta] mixin
 - ctaLabel (string) i18n
 - j:linkType (string, choicelist[linkTypeInitializer]) = 'none' autocreated mandatory
 // j:linknode and j:url are injected automatically
```

Any component that needs a CTA extends `nsmix:cta` — no property duplication.

## `jmix:mainResource` — when NOT to use it

Only for content that needs **both** a listing card AND a full detail page (e.g. blog posts, events).
Do NOT add to: navigation-only types, visual composition components, containers.

## Component location

- **Component-level** (preferred): `src/components/<Category>/<Name>/definition.cnd`
- **Module-level**: `settings/definitions.cnd` (for mixins and shared base types only)
