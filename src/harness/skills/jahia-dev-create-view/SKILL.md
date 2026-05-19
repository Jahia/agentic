---
name: jahia-dev-create-view
description: Implements a React view for a Jahia content type. Use when asked to create or update the rendering of a component, add a new view, or add styling.
---

## Overview

A **view** tells Jahia how to render a content type. Views are React components (TypeScript/TSX) registered with the `jahiaComponent` function. They follow the **Single Directory Component (SDC)** pattern alongside the `definition.cnd`.

---

## File naming convention

| Filename | Meaning |
|---|---|
| `default.server.tsx` | Default server-side rendered view |
| `<name>.server.tsx` | Named view (e.g. `small.server.tsx`) |
| `<name>.client.tsx` | Client-side rendered (interactive) view |

A node type can have **multiple views**. When `name` is omitted in `jahiaComponent`, the view is the default.

---

## Step 1 — Create the view file

In the component folder (`src/components/<Category>/<Name>/`), create `default.server.tsx`:

```tsx
import { jahiaComponent, buildNodeUrl, RenderChildren, RenderChild } from "@jahia/javascript-modules-library";
import type { Props } from "./types.js";
import classes from "./component.module.css";

jahiaComponent(
  {
    componentType: "view",       // always "view" for a component (use "template" for page templates)
    nodeType: "namespace:typeName",
    displayName: "Human Readable Name",
    // name: "small",            // omit for default view; set for named views
  },
  ({ title, subtitle, background }: Props) => (
    <section className={classes.root}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </section>
  ),
);
```

---

## Step 2 — Import Props from types.ts

Always import `Props` from `./types.js` (not `./types.ts` — use `.js` extension at import time):

```ts
import type { Props } from "./types.js";
```

If `types.ts` doesn't exist yet, create it first (see `jahia-dev-define-content-type` skill).

---

## CMS rule — never hardcode links or URLs

> ⚠️ **This is a CMS. All links must come from contributed content — never from hardcoded strings in code.**

> 🚫 **NEVER use an external link (`j:linkType: "external"`) to point to an internal Jahia page.** Use `"internal"` with `j:linknode` instead. An external URL hardcoded to an internal path breaks on environment changes, language switches, workspace toggling (live/preview), and vanity URL rewrites.

```tsx
// ❌ Wrong — hardcoded URL
<a href="https://www.jahia.com">Jahia</a>
<a href="/en/documentation">Documentation</a>

// ❌ Wrong — external link used for an internal page
// j:linkType: "external", j:url: "/sites/mySite/documentation.html"

// ✅ Correct — internal link to a JCR node
switch (props["j:linkType"]) {
  case "internal": return <a href={buildNodeUrl(props["j:linknode"])}>{props.label}</a>;
  case "external": return <a href={props["j:url"]}>{props.label}</a>;  // only for truly external URLs
}

// ✅ Correct — URL resolved from a JCR node at render time
<a href={buildNodeUrl(currentNode)}>{title}</a>
```

This applies everywhere: `href`, `src`, `action`, `data-url`. If a link needs to appear on screen, it must have a corresponding contributed field (`j:linkType`, `weakreference`, or similar). The only exception is links within the CMS UI itself (edit mode chrome).

---

## Step 3 — Use library helpers as needed

### `buildNodeUrl(node)` — convert a JCR node to a URL

```tsx
import { buildNodeUrl } from "@jahia/javascript-modules-library";

<img src={buildNodeUrl(coverNode)} alt="Descriptive alt text" />
<header style={{ backgroundImage: `url(${buildNodeUrl(background)})` }}>
```

> ⚠️ **Always guard optional nodes**: `buildNodeUrl(undefined)` throws `"Expected a node in buildNodeUrl, received undefined"`. If the prop is optional in the CND, guard it:
> ```tsx
> // ❌ Crashes when background is not set
> style={{ backgroundImage: `url(${buildNodeUrl(background)})` }}
>
> // ✅ Safe
> style={background ? { backgroundImage: `url(${buildNodeUrl(background)})` } : undefined}
> ```

> ⚠️ **Caching rule**: Never render properties of a **weakreference** node directly in the same view. Doing so will produce stale output because Jahia's cache is based on the referencing node, not the referenced one. Instead, render the referenced node using `<RenderChild>` (or a dedicated sub-view), or call `addCacheDependency` explicitly. Example:
>
> ```tsx
> // ❌ Don't do this — stale on referenced node change
> <img src={buildNodeUrl(background)} alt={background.getProperty('jcr:title').getString()} />
>
> // ✅ Do this — render the referenced node as its own view
> <RenderChild name="background" />
> ```

### `RenderChildren` — render all child nodes

```tsx
import { RenderChildren } from "@jahia/javascript-modules-library";

<div className={classes.list}>
  <RenderChildren />
</div>
```

### `RenderChild` — render a specific named child node

```tsx
import { RenderChild } from "@jahia/javascript-modules-library";

<RenderChild name="hero" />                    // default view
<RenderChild name="hero" view="small" />       // named view
```

### `Render` — render any arbitrary JCR node or virtual node

```tsx
import { Render } from "@jahia/javascript-modules-library";

// Render a specific node by reference (also solves the weakreference cache issue)
<Render node={cityNode} view="name" />

// Render a virtual node (no content stored in JCR — useful for shared components)
<Render content={{ nodeType: "namespace:navBar" }} />
```

> **Why `<Render node={...} />` solves the cache issue**: When you render a weakreference node via `<Render>`, its fragment is cached separately. If the referenced node changes, its fragment is invalidated and Jahia propagates that invalidation upward to any parent fragment that included it.

### `linkTypeInitializer` — rendering links

When a CND type uses `choicelist[linkTypeInitializer]`, the `j:linkType` property is a discriminator, NOT a URL. Use a `switch` statement:

```tsx
import { buildNodeUrl, jahiaComponent } from "@jahia/javascript-modules-library";
import type { Props } from "./types.js";

jahiaComponent(
  { componentType: "view", nodeType: "namespace:callToAction" },
  (props: Props) => {
    switch (props["j:linkType"]) {
      case "internal":
        return <a href={buildNodeUrl(props["j:linknode"])}>{props.label}</a>;
      case "external":
        return <a href={props["j:url"]} title={props["j:linkTitle"]}>{props.label}</a>;
      default:
        return <span>{props.label}</span>;
    }
  },
);
```

The `Props` type must be a discriminated union (see `jahia-dev-define-content-type` skill).

### Cache properties — controlling fragment caching

Add a `properties` key to `jahiaComponent` to tune caching:

```tsx
jahiaComponent(
  {
    componentType: "view",
    nodeType: "namespace:price",
    properties: {
      "cache.expiration": "60",   // re-render at most once per minute
    },
  },
  ({ price }: Props) => <span>{price}</span>,
);
```

```tsx
jahiaComponent(
  {
    componentType: "view",
    nodeType: "namespace:greeting",
    properties: {
      "cache.perUser": "true",    // different cache per logged-in user
    },
  },
  (_, { renderContext }) => (
    <div>Welcome, {renderContext.getUser().getUsername()}</div>
  ),
);
```

> Cache only applies in **live mode**. Edit and preview modes bypass the cache entirely.

### `getChildNodes` — iterate over child nodes in code

```tsx
import { getChildNodes, buildNodeUrl, jahiaComponent } from "@jahia/javascript-modules-library";
import type { JCRNodeWrapper } from "org.jahia.services.content";

jahiaComponent(
  { componentType: "view", nodeType: "namespace:navBar" },
  (_, { renderContext }) => {
    const pages = getChildNodes(renderContext.getSite(), -1, 0,
      (node: JCRNodeWrapper) => node.isNodeType("jnt:page")
    );
    return (
      <nav>
        <ul>
          {pages.map(page => (
            <li key={page.getPath()}>
              <a href={buildNodeUrl(page)}>{page.getDisplayableName()}</a>
            </li>
          ))}
        </ul>
      </nav>
    );
  },
);
```

`getChildNodes(node, limit, offset, filterFn)` — `limit: -1` means no limit.

### `renderContext` — access rendering context (second argument)

```tsx
jahiaComponent(
  { componentType: "view", nodeType: "ns:type" },
  ({ title }: Props, { renderContext, currentNode, currentResource }) => {
    const isEdit = renderContext.isEditMode();
    return <div data-edit={isEdit}>{title}</div>;
  },
);
```

> **Edit mode pattern for interactive components**: Carousels, accordions, tabs, and sliders are hard for editors to work with in their interactive state. In edit mode, render them **flat** (all slides/tabs visible) and optionally show an editor hint:
>
> ```tsx
> ({ slides }: Props, { renderContext }) => {
>   const isEdit = renderContext.isEditMode();
>   return isEdit ? (
>     <div className={classes.editStack}>
>       <RenderChildren />
>       <p className={classes.hint}>🖊 Carousel — add or reorder slides here</p>
>     </div>
>   ) : (
>     <div className={classes.carousel}>
>       <RenderChildren />
>     </div>
>   );
> }
> ```

### `readOnly` prop for shared/structural nodes

Use `readOnly` when rendering a node that editors should not edit in-place (e.g. a shared footer, a system-level navigation area):

```tsx
<RenderChild name="footer" readOnly={true} />
```

---

## Step 4 — Add CSS with CSS Modules

Create a `component.module.css` file in the same folder:

```css
.root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
}
```

Import and use in the view:

```tsx
import classes from "./component.module.css";

<section className={classes.root}>
```

Combine multiple classes:

```tsx
<section className={[classes.root, classes.small].join(" ")}>
```

### ⚠️ CSS grid: `auto-fit` vs `auto-fill`

When using `repeat(auto-fill, ...)`, CSS creates **phantom empty tracks** for remaining grid columns, leaving gaps when there are fewer items than columns. Use **`auto-fit`** instead — it collapses empty tracks so items stretch to fill the row:

```css
/* ❌ auto-fill — leaves gaps when items don't fill the row */
grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));

/* ✅ auto-fit — items stretch to fill the full row */
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
```

### ⚠️ Full-card clickability

When only the title of a card is a link, make the entire card clickable using the CSS stretched-link technique:

```tsx
<article className={classes.card}>
  <h3 className={classes.cardTitle}>
    <a href={buildNodeUrl(currentNode)} className={classes.cardLink}>
      {title}
    </a>
  </h3>
  <p>{description}</p>
</article>
```

```css
.card {
  position: relative;
}

.cardLink::after {
  content: "";
  position: absolute;
  inset: 0;
}
```

---

## Step 5 — Creating a named (non-default) view

To create a second view (e.g. a compact version), create a new file `small.server.tsx` and add `name: "small"` to the `jahiaComponent` call:

```tsx
jahiaComponent(
  {
    componentType: "view",
    nodeType: "namespace:typeName",
    displayName: "Small View",
    name: "small",
  },
  ({ title }: Props) => <span className={classes.small}>{title}</span>,
);
```

Request a named view from a parent component with `<RenderChild name="child" view="small" />`.

---

## Step 5b — Creating a client-side interactive component (Island Architecture)

Jahia uses the **Island Architecture**: server components render static HTML; interactive islands are hydrated in the browser. Use this when you need React state, browser events, or browser-only APIs.

### When to use client vs server rendering

| Use `.server.tsx` for… | Use `.client.tsx` for… |
|---|---|
| Static HTML, CMS content, navigation | Buttons, toggles, counters, forms |
| Reading JCR/GQL data | `useState`, `useEffect`, browser events |
| SEO-important content | Animations, browser-only libraries |

### Step 1 — Create the client component

Create `MyComponent.client.tsx` **in the same folder** as the server view. This is a plain React component — no `jahiaComponent` call needed:

```tsx
// src/components/Counter/Counter.client.tsx
import { useState } from "react";
import classes from "./component.module.css";

interface Props {
  label: string;         // only serializable types allowed as Island props
  initialCount?: number;
}

export default function Counter({ label, initialCount = 0 }: Props) {
  const [count, setCount] = useState(initialCount);
  return (
    <div className={classes.counter}>
      <button type="button" onClick={() => setCount(c => c - 1)}>−</button>
      <span>{label}: {count}</span>
      <button type="button" onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
```

> ⚠️ **Props must be serializable**: only strings, numbers, booleans, plain objects, and arrays. You cannot pass `JCRNodeWrapper`, `renderContext`, or Java objects to a client component.

### Step 2 — Wrap it with `<Island>` in the server view

```tsx
// src/components/Counter/default.server.tsx
import { jahiaComponent, Island } from "@jahia/javascript-modules-library";
import Counter from "./Counter.client.jsx";     // .jsx at import time
import type { Props } from "./types.js";

jahiaComponent(
  { componentType: "view", nodeType: "namespace:counter" },
  ({ label, initialCount }: Props) => (
    <div>
      <Island component={Counter} props={{ label, initialCount }} />
    </div>
  ),
);
```

### Step 3 — Browser-only rendering (skip SSR)

If the component cannot run on the server (e.g. uses `window`, `document`, or a browser-only library), use `clientOnly`:

```tsx
<Island component={MapWidget} props={{ lat, lng }} clientOnly>
  <p>Loading map…</p>
</Island>
```

### Step 4 — Dynamic import for heavy/browser-only libraries

```tsx
import { useEffect, useState } from "react";

export default function Confetti() {
  const [fire, setFire] = useState<(() => void) | null>(null);

  useEffect(() => {
    import("canvas-confetti").then(({ default: confetti }) => {
      setFire(() => () => confetti({ origin: { y: 1 } }));
    });
  }, []);

  return <button type="button" onClick={() => fire?.()} disabled={!fire}>🎉</button>;
}
```

### Edit mode caveat

Client components are hydrated even in Page Builder edit mode. If the interactive behaviour is disruptive in edit mode (e.g. a slider that auto-advances), guard it:

```tsx
<Island component={Slider} props={{ slides, isEditMode: renderContext.isEditMode() }} />
```

---

## Step 6 — Push to Jahia

```bash
# Always use this — never use yarn dev from an agent (it's interactive-only)
yarn build && yarn jahia-deploy
```

---

## Validation checklist
- [ ] `jahiaComponent` registered with correct `nodeType` (matches CND)
- [ ] `Props` imported from `./types.js`
- [ ] `buildNodeUrl` used for any image or node URL
- [ ] Weakreference-backed content rendered via sub-view (`RenderChild`), not inline property access
- [ ] Interactive UI (carousels, tabs) flattened in edit mode with editor hints
- [ ] Structural/shared nodes rendered with `readOnly` prop
- [ ] Semantic HTML used (`<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`)
- [ ] Images have meaningful `alt` text
- [ ] CSS Module created and imported
- [ ] **If client-side**: component is in `.client.tsx`, wrapped with `<Island>` in the server view
- [ ] **If client-side**: all props passed to Island are serializable (no JCR objects)
- [ ] **If client-side**: browser-only libraries use dynamic `import()` inside `useEffect`
- [ ] `yarn build && yarn jahia-deploy` run after all changes
- [ ] Component renders without errors in Page Builder

## Troubleshooting
> https://academy.jahia.com/tutorials-get-started/front-end-developer/making-a-hero-section

## References

- Preparing for i18n: https://academy.jahia.com/documentation/jahia-cms/jahia-8-2/developer/javascript-module-development/preparing-for-internationalization-i18n
- JavaScript modules monorepo: https://github.com/Jahia/javascript-modules
