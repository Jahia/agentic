# What cannot move to a JavaScript module

Establish this list for the module **before** porting a single view. Each item below blocks a whole
class of views, not one file, and a set that is heavy in them may not be worth migrating.

**A missing taglib is not on this list.** Most JSP taglibs wrap something JavaScript already does
better — dates, numbers, string handling, escaping. Those are translations, not gaps; use the
platform idiom (see `tag-mapping.md`). Something belongs here only when the JSM runtime genuinely
cannot express it.

That does not make every taglib a one-liner. `functions:abbreviate(text, 150, 250, '...')` is
`WordUtils.abbreviate` — lower bound, upper bound, appendix, snapping to a word boundary — and
`String.prototype.slice` reproduces none of that. It ports, but as a small function you have to write; the
code is in `tag-mapping.md`. Budget for it: "the platform has it" and "one call" are different claims, and
only the second one is free.

The escape hatch for all of it is the same and is officially supported: keep a **companion Java
bundle** and call it from JS with `server.osgi.getService("fqcn")`. A JavaScript module and a Java
module coexist on the same site — Jahia documents this as the normal path for upgrading projects.

## Skins — no equivalent at all

A JSP skin (`type = skin` in the `.properties` sidecar) renders `${wrappedContent}`: the output of
the content it decorates, injected by the core render-filter chain before the skin script runs.

- `jahiaComponent`'s `componentType` is a **closed union** `"template" | "view"`.
- `ServerContext` exposes nothing resembling a pre-rendered inner output.
- `Render` / `RenderChild` / `RenderChildren` all need an explicit target; none can express "the
  rendering about to wrap me".
- `properties: { type: "skin" }` can be declared and reaches the view, but with no `${wrappedContent}` it
  selects a behaviour that cannot happen — see the next section.

The DOM shell ports; the content slot cannot. Affects `jmix:skinnable` and `jmix:animate` views.
**Leave skins as JSP** in a companion Java module.

## The `.properties` sidecar does not port uniformly

`properties: { … }` on `jahiaComponent` is the same key space as the JSP sidecar for the `cache.*` family —
`cache.perUser`, `cache.mainResource`, `cache.requestParameters`, `cache.latch` all carry over verbatim. Two keys
do not, and both appear in the reference module's `jmix_animate/html/animate.animate.properties`:

| Key | What happens in JSM |
|---|---|
| `type = skin` | declarable, and it reaches the view's `Properties` intact, but no skin ever renders from JS — the `${wrappedContent}` slot is the missing half. Carrying the key over does not make a skin; it makes a broken one |
| `addMixin = jmix:animate` | **do not carry it.** `addMixin` is not a rendering hint — the edit engine reads it off the selected value and *adds that mixin to the content node*. A view registration is the wrong place for a key with content side effects |

The engine copies `properties` straight into the `View`'s `java.util.Properties`, which is the same object core's
render filters read, so the `cache.*` family, `skip.aggregation` and `requirePermissions` behave identically. The
two keys above are the exception because what consumes them is not the render chain.

`properties` is typed `Record<string, string>`, so every value is a string regardless of what it means.

## `moduleMap` — breaks list and pagination views

`jmix:list`, `jnt:query` and pagination views read `moduleMap.currentList` / `begin` / `end` /
`editable`. `moduleMap` is an empty map pushed by core's `BaseAttributesFilter`, populated by a
**separate `hidden.header` view** pulled in with `<template:include>`. It is an external,
per-node-type contract the view cannot derive on its own, and JSM exposes neither `moduleMap` nor
any way to receive values from an included view.

This is the widest gap. Anything built on Jahia's list/pagination convention is not mechanically
portable — rewrite it against `useJCRQuery` with explicit props, or leave it in Java.

## `var="x"` — capturing a fragment's output

Both `<template:include>` and `<template:area>` take a `var`, which renders the fragment into a **string
variable** the page then branches on:

```jsp
<main class="${empty sidenav ? 'container' : 'container-fluid'}">
  <c:if test="${! empty sidenav}"><aside>${sidenav}</aside></c:if>
```

`kbEntry.detail.jsp` does the same with an area — `<template:area path="relatedlinks" … var="relatedlinks"/>`,
then emits `${relatedlinks}` a dozen lines later inside markup that only appears if there was output.

`<Render>` and `<Area>` return React elements, and there is **no prop** that captures instead of emitting. The
underlying helpers do return strings — `server.render.render(…)` and `server.render.renderArea(…)` are both
`String`-valued — so the *condition* is computable. What has no supported form is putting the captured string back
into the tree: the library wraps raw HTML in an internal `<jsm-raw-html>` element that the engine strips, and the
engine's own source states it is not for userland code. Re-emitting through your own
`<div dangerouslySetInnerHTML>` adds an element the JSP never emitted, which is a layout change in exactly the
views that use this pattern.

Prefer rewriting over capturing: derive the same condition from the **data** the fragment would have used — "does
this page have child pages", "does this node have a `relatedlinks` child with content" — and render the fragment
normally in the branch that needs it. Say so explicitly when you do, because the two are not equivalent: the JSP
branched on the render, the port branches on a proxy for it. Calling the helper to test for output and then
rendering the component as well renders the fragment **twice**.

## Queries that are not JCR-SQL2

`useJCRQuery` and `getNodesByJCRQuery` are hard-wired to JCR-SQL2.

- **JQOM** (`<jcr:jqom>`, the `query:` taglib) has no equivalent. Jahia tracks this as an open
  epic. Any view that builds a query object programmatically — faceted search especially — must be
  rewritten against SQL2 or GraphQL, or stay in Java.
- **`jnt:query` stores a raw `jcr:statement` + `jcr:language`** and core executes whichever language
  was authored. A stored **XPath** query cannot be run from JS at all.

### Faceted search: the `facet:` and `search:` taglibs

The facet taglibs are the same gap wearing a different hat, and they are easy to miss because they are EL
functions rather than tags. `facet:getFacetDrillDownUrl`, `getDeleteFacetUrl`, `isFacetApplied`,
`isFacetValueApplied`, `getAppliedFacetFilters`, `getIndexPrefixedPath`, `getDrillDownPrefix`,
`getPropertyDefinitions` and the `<facet:facetLabel>` / `<facet:facetValueLabel>` tags all read the faceting layer
that `<jcr:jqom>` feeds; `<search:searchUrl>` sits on the same search stack. None has a JSM equivalent, and none
can be rebuilt on `useJCRQuery`, which returns nodes and no facet counts.

A `jnt:facets` view is therefore tier 3 in one piece — nineteen `facet:` uses across three files in the reference
set — not a view with a few awkward lines. Keep it in the companion Java bundle, or rewrite the search against
GraphQL, which is a project of its own and not part of a parity port.

## Java extension points

None of these can be provided by a JS module. They keep working if the companion Java bundle keeps
providing them — and note the CND keeps referring to them by name, so removing the Java bundle
breaks the content model, not just the rendering.

| Hook | Note |
|---|---|
| `ModuleChoiceListInitializer` / `ModuleChoiceListRenderer` | named from the CND (`choicelist[myInitializer]`); the CND ports verbatim only if these survive |
| render filters (`AbstractFilter`) | only reachable through the untyped, undocumented `server.registry.add("render-filter", …)` |
| Drools rules calling module services | see `gotchas.md` — carrying the `.drl` without the service stops the bundle |
| actions, servlets, listeners, workflow handlers | no JS equivalent |
| custom JSP taglibs (`.tld`) | no analogue — but an EL function usually becomes a plain JS function, which is simpler |

## Groovy views

A `.groovy` view is not a JSP and any JSP-oriented conversion skips it silently. They typically call
`JCRContentUtils` / `JCRTagUtils` directly and register cache dependencies by hand. Count them in
the audit so they are not mistaken for "already done".

## Hidden templates

Every registered `template` appears in the page-template picker; there is no `hidden.` convention
and no `visible=false`. A JSP `template.hidden.x.jsp` used purely as an include target should become
a **view** (or a plain component — but read the cache note in `tag-mapping.md` first). A genuinely
hidden *page template* cannot be hidden.

The same applies to `j:hiddenTemplate="true"` on a `jnt:contentTemplate` in `src/main/import/repository.xml`.
Everything else about a `jnt:contentTemplate` **does** port, into a single `jahiaComponent` registration — that
mapping is in `tag-mapping.md`, "Content templates". Only the hidden flag is lost.

## Servlet-level authentication UI

`<ui:loginArea>` / `<ui:isLoginError>` bind to Jahia's form-post authentication. No JSM equivalent;
rewrite against the login endpoint directly, or keep the fragment in Java.

## Other small ones

- `<template:tokenizedCacheDependency>` is not bridged.
- `areaAsSubNode="true"` on an area has no equivalent, and the engine rejects the attribute outright. It changes
  where authored content is stored, not how it looks — see `tag-mapping.md`.
- `${param.x}` has no documented helper — `renderContext.getRequest().getParameter("x")` works but
  is outside the high-level API.
- Render `parameters` are **String-only**; non-string values are dropped.
- `URLSearchParams` is unsupported by the GraalJS runtime.
- Child-node CND syntax (`+ * (type)`) does not support `i18n`.
