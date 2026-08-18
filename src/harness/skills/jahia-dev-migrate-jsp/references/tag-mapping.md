# JSP → JavaScript Modules translation table

Everything here is exported from `@jahia/javascript-modules-library` unless stated.

The Jahia render tags are not reimplemented in JS: the engine's `RenderHelper` instantiates and
drives the **real JSP tag classes** (`ModuleTag`, `IncludeTag`, `AreaTag`, `AddResourcesTag`,
`AddCacheDependencyTag`) against a mock page context. So `<Area>`, `<Render>` and `<AddResources>`
inherit exact JSP semantics — trust the old behaviour when reasoning about the new code.

## Rendering and composition

| JSP | JSM |
|---|---|
| `<template:module node="${n}"/>` | `<Render node={n} />` |
| `<template:module path="/a/b"/>` | `<Render path="/a/b" />` |
| `<template:module path="*"/>`, **outside** an edit-mode guard | `<RenderChildren />` |
| `<template:module path="*" nodeTypes="a b"/>`, **inside** an edit-mode guard | `<AddContentButtons nodeTypes={["a", "b"]} />` |
| a single named child | `<RenderChild name="foo" />` |
| `<template:include view="x"/>` | `<Render advanceRenderingConfig="INCLUDE" view="x" />` |
| `<template:option .../>` | `<Render advanceRenderingConfig="OPTION" … />` |
| `<template:param name="k" value="v"/>` in a tag body | `parameters={{ k: "v" }}` on the enclosing `<Render>` / `<Area>` |
| `<template:area name="x"/>` **and** `<template:area path="x"/>` | `<Area name="x" />` |
| `areaView` / `nodeTypes` / `listLimit` / `areaType` | `view` / `allowedNodeTypes` / `numberOfItems` / `nodeType` |
| `areaAsSubNode="true"` | **no equivalent** — see below |
| `areaAsSubNode="true"` **with** `moduleType="absoluteArea"` | `<AbsoluteArea>` — the content-location risk does not apply here; see below |
| `<template:area … var="x"/>` | no prop — see `not-portable.md`, "capturing a fragment's output" |
| `<template:areaAbsolute .../>` or `moduleType="absoluteArea" level="0"` | `<AbsoluteArea name="x" parent={site} />` where `site = renderContext.getSite()` |
| `editable="false"` | `readOnly` |

`Area` accepts a path in `name`, so `name="basicArea/subLevel"` works.

**Read `path` on an area, not `name`.** `RenderHelper.renderArea` does `attr.put("path", <the name prop>)` before
driving `AreaTag`, so `<Area name="x"/>` *is* `<template:area path="x"/>`. Template sets routinely use `path=`
exclusively — every one of the 12 areas in the reference set does — and a table that only maps `name=` reads as
if none of them port. They all do, one for one.

**`areaAsSubNode="true"` has no verified equivalent — treat it as a gap.** The engine allows exactly
`name`, `view`, `allowedNodeTypes`, `numberOfItems`, `nodeType`, `editable`, `parameters` on an area and throws
`IllegalArgumentException: Attribute areaAsSubNode is not allowed` on anything else; nothing in the library or the
engine mentions the concept.

**Combined with `moduleType="absoluteArea"`, the dangerous half does not fire.** `AreaTag` dispatches on
`moduleType` first: an absolute area goes to `findNodeForAbsoluteAreaType` and never reaches the relative-path
branch, which is the only place `areaAsSubNode` rewrites the area's storage path. So content location is safe, and
`<AbsoluteArea>` is a faithful port. The flag is not entirely inert even then — it also pushes the current resource
onto the view-lookup stack, which can change which view is selected — but it cannot scatter authored content. Port
the combined form and note it; port the bare form only after reading the paragraph above. The behaviour it selects is not cosmetic: with the flag, `AreaTag` stores the area at
`<currentResource path>/<name>` and looks it up there first; without it, the area is stored on the **main resource**
(the page). So the port compiles and renders, but the authored content lands on a different node — one shared
area per page instead of one per component instance. Six areas in the reference set carry the flag. List each in
the Step 7 report.

**`path="*"` is ambiguous in JSP and must not be ported by shape.** `<template:module path="*" nodeTypes="…"/>`
is both "render the children" and "draw the add-content buttons", decided at runtime. The deterministic rule:
inside an edit-mode guard (`<c:if test="${renderContext.editMode}">`) it is `<AddContentButtons />`; anywhere else
it is `<RenderChildren />`. `AddContentButtons` also takes `childName` (default `"*"`) and `editCheck`.

**Render parameters are String-only.** `renderTag` copies a parameter into the tag only
`if (tagParam.getValue() instanceof String)` — a number or boolean is dropped silently. Write
`parameters={{ expanded: "true" }}`, never `{{ expanded: true }}`.

## Content templates (`jnt:contentTemplate`)

`src/main/import/repository.xml` binds views to pages with `jnt:contentTemplate` nodes, and they are easy to miss
because they are content, not code. A `jnt:contentTemplate` sits under a `jnt:template`, carries `j:applyOn="<type>"`,
and holds a `jnt:mainResourceDisplay` with `j:mainResourceView="<view>"`. It means: *when a node of `<type>` is the
main resource, wrap it in this page template and render it with `<view>`.*

That whole construct becomes **one `jahiaComponent` registration**, in `src/templates/`:

| `jnt:contentTemplate` attribute | JSM |
|---|---|
| `j:applyOn="jacademy:kbEntry"` | `nodeType: "jacademy:kbEntry"`, `componentType: "template"` |
| `j:mainResourceView="detail"` | `<Render node={currentNode} view="detail" />` in the body |
| the parent `jnt:template`'s `j:view` | the page chrome — port that JSP into this component's body |
| `j:defaultTemplate="true"` | the default `name` (omit `name`) |
| `j:priority="1"` | `priority: 1` |
| `j:hiddenTemplate="true"` | **no equivalent** — see `not-portable.md`, "Hidden templates" |

The reference module has three: `j:applyOn` of `jacademy:kbEntry` (view `detail`), `jnt:fixApplier` (view `detail`)
and `jnt:content` (view `default`, `j:priority="1"`, `j:hiddenTemplate="true"`). Skip them and those types render
with no page around them. The scaffold's own catch-all is registered on `jmix:mainResource` with a negative
`priority`, so a per-type registration overrides it without any further wiring.

## Resources and caching

| JSP | JSM |
|---|---|
| `<template:addResources type="css" resources="a.css"/>` | `<AddResources type="css" resources="a.css" />` |
| `type="inline"` with a script body | `<AddResources type="inline" inlineResource={"…"} />` |
| `targetTag="${renderContext.editMode?'head':'body'}"` | `targetTag={renderContext.isEditMode() ? "head" : "body"}` |
| the view's `.properties` sidecar | `properties: { … }` on `jahiaComponent`, same key space — **except two keys**, see `not-portable.md` |
| `<template:addCacheDependency node="${n}"/>` | `server.render.addCacheDependency({ node: n }, renderContext)` |
| `<template:tokenizedCacheDependency/>` | **no equivalent** |

`addCacheDependency` accepts `node`, `uuid`, `path` or `flushOnPathMatchingRegexp`. It has no React
wrapper — `server` is a global in the SSR context.

**A cache boundary is a rendering boundary.** A `<template:include>`d view with its own
`cache.mainResource` gets its own cache fragment. Collapsing it into a plain imported React
component inlines it into the parent fragment and silently changes the caching contract. Keep it a
registered view rendered through `<Render>` when the sidecar carries cache keys.

**This bites hardest on a mixin view that includes `view="default"`.** `whatsNew.expanded.jsp` is the only file
under `jacademix_whatsNew/` and its whole body is `<template:include view="default"><template:param
name="expanded" value="true"/></template:include>` — it re-renders *the current node's* default view, which is
defined by whichever concrete type carries the mixin (`jacademy:whatsNewDX`, `jacademy:whatsNewModule`), in another
component directory. The port is:

```tsx
<Render advanceRenderingConfig="INCLUDE" view="default" parameters={{ expanded: "true" }} />
```

Importing the other component's React function directly is the tempting shortcut and it is wrong here: both target
views carry a `.properties` sidecar (`cache.requestParameters=v,expanded`), so a direct import merges two cache
fragments into one and the `expanded` request parameter stops keying the cache. Whenever the include target has a
sidecar, it stays a `<Render>`.

## Control flow and EL

| JSP | JSM |
|---|---|
| `<c:if test="${x}">A</c:if>` | `{x && <>A</>}` |
| `<c:choose>/<c:when>/<c:otherwise>` | ternary, or early `return` |
| `<c:forEach items="${xs}" var="x">` | `{xs.map((x) => …)}` |
| `<c:set var="a" value="${b}"/>` | `const a = b` |
| `<c:url value="${n.url}" context="/"/>` | `buildNodeUrl(n)` |
| `<c:out value="${x}"/>` / `fn:escapeXml` | just `{x}` — React escapes |
| `${currentNode.properties.foo.string}` | the `foo` prop (first callback argument) |
| `${jcr:isNodeType(n,'jnt:page')}` | `n.isNodeType("jnt:page")` |
| `${jcr:getChildrenOfType(n,'t')}` | `getChildNodes(n, -1, (c) => c.isNodeType("t"))` |
| `<jcr:node var="n" path="/a/b"/>` | `jcrSession.getNode("/a/b")` — **but it throws**, see below |
| `<jcr:node var="n" path="rel/path"/>` | `currentNode.hasNode("rel/path") ? currentNode.getNode("rel/path") : undefined` |
| `${param.foo}` | `renderContext.getRequest().getParameter("foo")` — no high-level helper |
| `${fn:length(x)}` etc. | plain JS |
| `functions:abbreviate`, `removeHtmlTags` | a JS idiom, but neither is a one-liner — see "Prefer the platform idiom" below |

**`<jcr:node>` swallows a missing node; `getNode` does not.** `JCRNodeTag` catches `PathNotFoundException` and
`ItemNotFoundException`, logs at debug and leaves the variable **unset**, which is why the JSP that follows reads
`${! empty relatedLinksNode}` and works. `jcrSession.getNode(path)` throws instead, so the port has to guard:

```tsx
const searchPage = jcrSession.nodeExists(path) ? jcrSession.getNode(path) : undefined;
```

**An absolute path in a `<jcr:node>` is a portability hazard in its own right.** The reference module looks up
`/sites/academy/home/search`. That path does not survive an import into a site with another key, and nothing fails
loudly — the JSP silently rendered nothing, and a guarded port silently renders nothing. Resolve the site root from
the render context (`renderContext.getSite().getPath()`) and keep only the relative tail. Report every hardcoded
`/sites/<key>/` you replace.

## Props and their TypeScript types

The first callback argument is a `Proxy` over `currentNode`, so a prop is read at access time. `getNodeProps` maps
JCR types as follows — declare the callback's parameter type to match, because nothing infers it for you.

| CND | Prop type | Note |
|---|---|---|
| `(string)`, `(name)`, `(path)`, `(uri)`, `(decimal)` | `string` | |
| `(long)` | `number` | `getLong()` |
| `(double)` | `number` | `getDouble()` |
| `(boolean)` | `boolean` | a real JCR boolean, which is rare |
| `(date)` | `string` | ISO-ish string, never a `Date` — the unwrapper avoids the JVM time zone |
| `(reference)`, `(weakreference)` | `JCRNodeWrapper` | already resolved to the node |
| `multiple` | `T[]` | the same unwrapper, applied per value |
| absent property | `undefined` | |

**Absent means `undefined`, never `[]`.** The proxy returns `undefined` from `!node.hasProperty(key)` *before* it
ever looks at cardinality, so an unset multi-valued property is `undefined`, not an empty array. `${empty xs}` and
`${fn:length(xs) > 0}` both covered this in EL; `xs.map(…)` does not. Type it `T[] | undefined` and default it at
the destructuring site.

**A boolean stored as a string stays a string.** CNDs written for a choicelist editor declare
`expanded (string, choicelist[…]) < 'false', 'true'`, and the JSP read `${… .string eq 'true'}`. The prop is the
string `"false"`, and `Boolean("false")` is `true`. Compare verbatim — `expanded === "true"` — and never coerce.

**Do not destructure a property called `id`.** `jacademix:embedVideo` has a mandatory `id`; `({ id }) => <iframe
id={id}/>` type-checks and puts a video identifier in the DOM `id` attribute. Rename at the destructuring site:
`({ id: videoId })`.

## URLs

`URLGenerator` (`${url.*}`) is reachable in full through `renderContext.getURLGenerator()`, but the common uses
have first-class helpers and should go through them.

| JSP | JSM |
|---|---|
| `${url.currentModule}/images/logo.svg` | `buildModuleFileUrl("static/images/logo.svg")` |
| `${url.base}${n.path}.html` / `${n.url}` | `buildNodeUrl(n)` |
| `${url.baseLive}${n.path}.html` | `buildNodeUrl(n, { mode: "live" })` |
| `/graphql`, `/cms/…` and other endpoints | `buildEndpointUrl("/graphql")` |
| `${url.mainResource}` | `renderContext.getURLGenerator().getMainResource()` |
| `${url.edit}` / `.preview` / `.live` / `.login` / `.logout` | `renderContext.getURLGenerator().getEdit()` etc. |

`buildModuleFileUrl` calls `getURLGenerator().getCurrentModule()` itself, so the JSP concatenation ports as a path
argument — with the `static/` prefix the packaging rule in `gotchas.md` imposes. `${url.mainResource}` is
`base + mainResource.path + "." + resolvedTemplate + ".html"`; `buildNodeUrl(mainNode)` is close but drops the
resolved-template segment, so use the generator when the exact URL matters (facet drill-down links do).

## Context objects

| JSP | JSM (`useServerContext()` or the 2nd callback argument) |
|---|---|
| `currentNode` | `currentNode` |
| `currentResource` | `currentResource` |
| `renderContext` | `renderContext` |
| `renderContext.mainResource.node` | `mainNode` |
| `renderContext.site` | `renderContext.getSite()` |
| `renderContext.editMode` / `previewMode` | `renderContext.isEditMode()` / `isPreviewMode()` |
| `currentUser` | `renderContext.getUser()` |
| — | `jcrSession`, `bundleKey` |

## Queries

| JSP | JSM |
|---|---|
| `<jcr:sql var="r" sql="…"/>` | `useJCRQuery({ query })` or `getNodesByJCRQuery(session, query, limit)` |
| GraphQL | `useGQLQuery({ query, variables })` |
| `<jcr:jqom>` / the `query:` taglib | **no equivalent — JCR-SQL2 only** |
| the `facet:` taglib (`facetLib`) | **no equivalent** — see `not-portable.md` |
| the `search:` / `s:` taglib (`http://www.jahia.org/tags/search`) | **no equivalent** — see `not-portable.md` |

`getNodesByJCRQuery` requires a `limit`; a falsy one returns `[]` with a warning.

Count the *uses*, not the imports, when sizing this. The reference set imports the search taglib nine times
(`s:` ×8, `search:` ×1) but uses a single tag from it, `<search:searchUrl>`; the `facet:` taglib is imported three
times and genuinely used nineteen times, all inside `jnt_facets/`. Sized by imports the two look comparable;
sized by use, one is a dead import and the other is a whole component that cannot port.

## i18n

| JSP | JSM |
|---|---|
| `<fmt:message key="k"/>` | `const { t } = useTranslation(); t("k")` |
| the module resource bundle for views | `settings/locales/<lang>.json` (i18next) |
| resource bundles for **content-type and field labels** | unchanged — `settings/resources/<module>[_<lang>].properties` |
| `<fmt:message key="${fn:replace(n.primaryNodeTypeName,':','_')}"/>` | `n.getPrimaryNodeType().getLabel(locale)` |
| `<fmt:message key="<type>_<prop>"/>` computed for a field | `type.getPropertyDefinition(name).getLabel(locale, type)` |
| `<fmt:formatDate>` | `Intl.DateTimeFormat` — see below |
| `<fmt:formatNumber>` | `Intl.NumberFormat` |

### The two bundles are not the same bundle

A JSP template set typically has **one** `resources/<module>.properties` doing two unrelated jobs: view text read
by `<fmt:message>`, and content-type / field labels read by the edition UI. In JSM those jobs split, and the split
is what makes the i18n port non-mechanical.

- `settings/resources/<module>[_<lang>].properties` — **carry it over unchanged**, whole. It still drives Content
  Editor labels, and its keys are addressed by convention (`<ns>_<type>`, `<ns>_<type>.<prop>`), so removing
  entries breaks the edition UI silently. The reference module's single file holds 112 keys, the large majority of
  them of that shape.
- `settings/locales/<lang>.json` — **copy in only the keys this module both defines and references literally**
  from a `<fmt:message key="…">`. Copy, do not move: the properties file stays intact.

The i18next namespace is an **OSGi bundle symbolic name** — the backend does `server.osgi.getBundle(namespace)` and
reads `META-INF/locales/<language>.json` from it — and the default namespace is the bundle currently rendering. The
file name is a **language** code, not a locale (`fr.json`, never `fr_FR.json`), because the engine calls
`currentResource.getLocale().getLanguage()`. Fallback language is `en`.

**Which locale files to create.** One per `<module>_<lang>.properties` that exists, plus one for the un-suffixed
default bundle, filed under the language the site skeleton declares — read the `jcr:language` attributes in
`src/main/import/repository.xml`. The reference module has a single un-suffixed bundle and only `jcr:language="en"`,
so it produces exactly `settings/locales/en.json`.

**A computed key cannot be an i18next key.** The reference set builds keys at render time —
`key="${fn:replace(currentNode.primaryNodeTypeName,':','_')}"` and
`key="${fn:replace(facetNodeTypeName,':','_')}.${fn:replace(facetPropertyName,':','_')}"`. There is nothing to
extract into a JSON file, and `t(someVariable)` would just miss. Both are asking for a *definition label*, which
Jahia already resolves against the content bundle: `ExtendedNodeType#getLabel(Locale)` builds exactly the
`<ns>_<type>` key, and `ExtendedItemDefinition#getLabel(Locale, ExtendedNodeType)` builds the
`<ns>_<type>.<prop>` one. Call those and the lookup keeps working with the properties file untouched.

**A key owned by another module is reported, never copied.** 37 `<fmt:message>` sites in the reference set, and a
solid share of them resolve keys the module does not define — `bootstrap5nt_navbar.label.*`,
`bootstrap5mix_advancedPagination.*`, `label.username`, `label.password`, `facets.facetsSet`,
`angular.ffController.button.*`. In JSP these worked because Jahia's resource-bundle lookup spans modules; in JSM
they do not, because the namespace *is* a bundle and the owning module ships `.properties`, not
`META-INF/locales/*.json`, so even `t("their-bundle:key")` finds nothing. Copying the strings into your own
`en.json` forks them from their owner and they stop tracking upstream. List them in the Step 7 report as
unresolved i18n keys and let the operator decide.

## Prefer the platform idiom

Some JSP taglibs exist only because Java's standard library was awkward to reach from a page. Those
are **not migration gaps** — JavaScript has a better native answer, and porting the Java API shape
instead produces worse code that then has to be maintained.

Reach for the platform first:

| JSP | Use |
|---|---|
| `<fmt:formatDate>` | `new Intl.DateTimeFormat(locale, {…}).format(new Date(value))` |
| `<fmt:formatNumber>` | `Intl.NumberFormat` |
| relative dates hand-rolled in EL | `Intl.RelativeTimeFormat` |
| `functions:abbreviate(s, lower, upper, end)` | **not `slice`** — a small helper, see below |
| locale-aware sorting in a taglib | `Intl.Collator` |
| `fn:startsWith` / `contains` / `replace` / `length` | the matching `String` and `Array` methods |
| `fn:escapeXml` | nothing — React escapes by default |

Take the locale from the render context — `currentResource.getLocale()` — and pass it to the `Intl`
constructor, rather than hardcoding a format string as the JSP did. The result is usually shorter
than the tag it replaces and correct in locales the original never handled.

**`Intl` is available server-side, with full ICU data** — verified on the GraalJS runtime in Jahia
8.2.4: `DateTimeFormat`, `NumberFormat`, `RelativeTimeFormat`, `Collator`, `Segmenter` and
`toLocaleDateString` all resolve correctly, including French month names, German currency
formatting and French collation. Two caveats:

- **The runtime's default time zone is `Etc/UTC`**, not the server's zone. A date formatted without
  an explicit `timeZone` option renders in UTC, which is a behaviour change from `<fmt:formatDate>`
  (which followed the JVM, or `<fmt:setTimeZone>`). Pass `timeZone` explicitly wherever the JSP
  relied on either.
- **The ECMA-402 surface is not complete** — `Intl.supportedValuesOf` throws
  `TypeError: Intl.supportedValuesOf is not a function`. The formatters are there; probe anything
  newer before depending on it.

Two genuine exceptions, where the taglib is not a thin wrapper over something JavaScript already has:

**`removeHtmlTags`** wrapped a real HTML parser (Jericho). A regex approximation is close but not equivalent; if
the exact output matters, strip the markup where the value is produced rather than where it is displayed.

**`functions:abbreviate` is `org.apache.commons.lang.WordUtils.abbreviate`**, and the four-argument form is
*lower bound, upper bound, appendix* with word-boundary snapping — `slice` reproduces none of it. `abbreviate(s,
150, 250, '...')` means: look for the first space at or after index 150; cut there if there is one before 250,
otherwise cut hard at 250; append `'...'` only if anything was actually removed. Write it out:

```ts
export function abbreviate(str: string, lower: number, upper: number, end = ""): string {
  if (!str) return "";
  lower = Math.min(lower, str.length);
  upper = upper === -1 ? str.length : Math.min(upper, str.length);
  upper = Math.max(upper, lower);
  const index = str.indexOf(" ", lower);
  if (index === -1) return str.slice(0, upper) + (upper === str.length ? "" : end);
  return index > upper ? str.slice(0, upper) + end : str.slice(0, index) + end;
}
```

Cutting at `lower` alone truncates mid-word; cutting at `upper` alone over-runs every short text and appends an
ellipsis to text that was never shortened. Both are visible on the page.

Only treat something as a gap when the *platform* cannot express it — see `not-portable.md`. A
missing taglib is not a gap; a missing `moduleMap` is.

## Client-side behaviour

A JSP inline `<script>` has two possible destinations:

- Genuinely static glue → keep it as `<AddResources type="inline" inlineResource={…} />`. It is a
  string, so it gets no type-checking.
- Real interactive behaviour → make it an **island**: a `*.client.tsx` default export rendered via
  `<Island component={X} props={…} />`. Island props must be devalue-serializable, so **a JCR node
  cannot be passed to a client component** — project the fields you need first.

Client bundles may not import `@jahia/javascript-modules-library`; the build fails if they do.
