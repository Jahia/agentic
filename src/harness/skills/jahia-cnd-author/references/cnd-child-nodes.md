# CND Child Nodes

## Syntax

```cnd
+ childName (ns:type)            // named child — exactly one
+ childName (ns:type) multiple   // named child — list
+ * (ns:type)                    // any-name child of a specific type
+ * (jmix:droppableContent)      // open container — any droppable component
```

## When to use child nodes vs `weakreference multiple`

| Use child nodes when… | Use `weakreference multiple` when… |
|---|---|
| Each item has multiple properties (label + link) | Each item is just a reference (a page, an image) |
| Items have no life outside the parent | Items are managed elsewhere and reused |
| You always create them together | Editors need to pick from existing content |

## Repeatable CTA pattern

**NEVER put `ctaText + ctaLink/ctaUrl` on the parent type as flat properties.**
Model CTAs as child nodes — editors can then add multiple CTAs.

```cnd
// ✅ Correct — supports multiple CTAs
[ns:heroSection] > jnt:content, nsmix:component, mix:title
 - subtitle (string, richtext) i18n
 - backgroundImage (weakreference, picker[type='image']) < jmix:image
 + * (ns:heroCallToAction)

[ns:heroCallToAction] > jnt:content, nsmix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory

// ❌ Wrong — forces exactly one CTA, editors can't add more
[ns:heroSection] > jnt:content, nsmix:component
 - ctaText (string) i18n
 - ctaLink (string) i18n       // also wrong type for links
```

## Ordering

Add `orderable` to the parent type when editors need to reorder children:

```cnd
[ns:featureList] > jnt:content, nsmix:component orderable
 + * (ns:featureItem)
```

## Hidden structural nodes

Child nodes that editors should never add manually (structural containers, auto-created nodes):

```cnd
[ns:heroSection] > jnt:content, nsmix:component, mix:title
 + ctaContainer (ns:ctaContainer) autocreated

[ns:ctaContainer] > jnt:content, jmix:hiddenType orderable
 + * (ns:callToAction)
```

`jmix:hiddenType` hides a type from the Page Builder component picker.
**Never use `jmix:studioOnly`** — it causes silent rendering issues.

## Sectioning component: children editors add inside it

A section, a grid, a row: a component whose items the editor drops **inside the component**, and
nowhere else. Two rules decide the shape:

- Editors drop content into an **Area**, so the items live in a list child that the view renders
  with `<AbsoluteArea>`. `<RenderChildren>` on the section itself renders nodes but offers no drop
  zone in Page Builder, and a child type created there by hand is a node no editor can add.
- The list child is a **type of its own**, hidden from the picker, that names the item types it
  accepts. That restriction is what keeps the items "contributable on the sectioning component
  only".

```cnd
// The list: hidden, orderable, and the only place these items may live
[ns:sectionItems] > jnt:content, jmix:list, jmix:hiddenType orderable
 + * (ns:textCard)
 + * (ns:imageCard)

// The section: a page component with a title, a layout and the list child
[ns:section] > jnt:content, nsmix:pageComponent, mix:title
 - subtitle (string) i18n
 - layout (string, choicelist) = '1col' < '1col', '2col', '3col'
 + items (ns:sectionItems)

// The items: plain components, NOT page components, so they cannot be dropped in page areas
[ns:textCard] > jnt:content, nsmix:component, mix:title
 - body (string, textarea) i18n
```

The view renders the list as an area whose parent is the section node:

```tsx
const { currentNode } = useServerContext();
<AbsoluteArea name="items" parent={currentNode} nodeType="ns:sectionItems" />
```

Jahia creates the `items` node the first time the area renders, so the CND needs no `autocreated`
on it. When content is created through the MCP tools rather than by an editor, create the
section, its list and its items in **one** `content.create` call, with `children` nested two
levels deep:

```json
{"parentPath": "/sites/<site>/home/main", "nodeType": "ns:section", "name": "products",
 "properties": {"jcr:title": "Our products", "layout": "3col"},
 "children": [{"name": "items", "nodeType": "ns:sectionItems", "children": [
   {"name": "car", "nodeType": "ns:textCard", "properties": {"jcr:title": "Car", "body": "…"}},
   {"name": "home", "nodeType": "ns:textCard", "properties": {"jcr:title": "Home", "body": "…"}}
 ]}]}
```

**What does not work, and what the refusal means.** `+ * (nsmix:sectionChild)` straight on a
`jnt:content` section, with `<RenderChildren>` in the view, gives Page Builder nothing to drop
into. And a `content.create` refused with `Constraint violation: No child node definition` after
you changed the CND means the instance still holds the previous definition of the parent: verify
with `content.type` before you create anything, and see `jahia-dev-debug` for the redeploy that
applies a CND change.

## Open container (accept any droppable)

```cnd
[ns:gridRow] > jnt:content, nsmix:component
 - columns (long) = '3' autocreated mandatory < '1', '2', '3', '4'
 + * (jmix:droppableContent)
```

`+ * (jmix:droppableContent)` accepts any component the editor can drop.
