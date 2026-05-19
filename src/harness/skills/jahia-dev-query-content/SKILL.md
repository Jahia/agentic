---
name: jahia-dev-query-content
description: Writes JCR-SQL2 queries to list and filter Jahia content. Use when asked to list articles, display content from a folder, filter by date, or build a content listing.
allowed-tools: Bash, Read, Write, Edit, WebFetch
---

## Overview

Jahia stores all content in a tree-based **Java Content Repository (JCR)**. Content can be queried using **JCR-SQL2**, a SQL-like language. This is used to build listings (blogs, news, team members, etc.) from content stored in **Content Folders**.

There are **three ways** to query content in Jahia JS modules:
1. **No-code**: built-in `Jahia - Queries` component in Page Builder
2. **Server-side hook**: `useJCRQuery` in a `.server.tsx` view
3. **Client-side hook**: `useJCRQuery` in a `.client.tsx` island (for dynamic, browser-triggered queries)

---

## Step 1 — Understand Content Folders

Instead of placing content directly on a page, reusable content (blog posts, team members, etc.) is stored in **Content Folders** under the `contents/` tree of the site.

To create a content folder in Jahia UI:
1. Open **jContent** (the content manager)
2. Navigate to **Content Folders** in the left sidebar
3. Right-click → **New Folder**, name it (e.g. `blog`)
4. Create content items inside this folder

---

## Step 2 — Use the built-in query component (no code)

For simple listings, use the built-in **Jahia - Queries > Content items using JCR Query** component in Page Builder. Enter your JCR-SQL2 query in the query field.

---

## Step 2b — Make content folders editable in jContent

Content folders are browsable via **jContent** by default, but if editors need to manage content directly from the **Content Tree** in Page Builder, add `jmix:visibleInContentTree` to the folder node type:

```cnd
[namespace:blogFolder] > jnt:contentFolder, jmix:visibleInContentTree
```

This makes the folder appear in the left sidebar of Page Builder, enabling drag-and-drop management.

---

## Step 3 — Write a JCR-SQL2 query

### Basic query — list all items of a type

```sql
SELECT *
FROM [namespace:typeName] AS item
WHERE ISDESCENDANTNODE(item, '/sites/<siteKey>/contents/<folderName>')
```

Replace `<siteKey>` with the site key set during site creation.

### Filter out drafts (items without a date)

```sql
SELECT *
FROM [namespace:blogPost] AS post
WHERE ISDESCENDANTNODE(post, '/sites/<siteKey>/contents/blog')
  AND post.[publicationDate] IS NOT NULL
ORDER BY post.[publicationDate] DESC
```

### Query all descendants (not just direct children)

Use `ISDESCENDANTNODE` for nested folder structures:

```sql
-- All blog posts anywhere under /contents/blog (including subfolders)
SELECT * FROM [namespace:blogPost] AS post
WHERE ISDESCENDANTNODE(post, '/sites/<siteKey>/contents/blog')
```

Use `ISCHILDNODE` when you want only direct children of a folder:

```sql
-- Only direct children of /contents/blog
SELECT * FROM [namespace:blogPost] AS post
WHERE ISCHILDNODE(post, '/sites/<siteKey>/contents/blog')
```

### Common query clauses

| Clause | Usage |
|---|---|
| `ISDESCENDANTNODE(x, '/path')` | Filter by location in the tree |
| `x.[prop] IS NOT NULL` | Exclude items without a property (draft filter) |
| `x.[prop] = 'value'` | Filter by property value |
| `ORDER BY x.[prop] DESC` | Sort descending |
| `ORDER BY x.[prop] ASC` | Sort ascending |

---

## Step 4 — Make a content type accessible at its own URL

Use `jmix:mainResource` **only** for content that needs **both a listing card AND a full detail page** (e.g. blog posts, team member profiles). Do not add it to visual composition types or navigation-only content.

To allow a blog post to be viewed as a full page, add `jmix:mainResource` to its CND definition:

```cnd
[namespace:blogPost] > jnt:content, mix:title, jmix:mainResource, namespacemix:component
```

Then create a full-page view for it:

```tsx
// src/components/BlogPost/fullPage.server.tsx
// NOTE: componentType is "view" (NOT "template") — the MainResource template
// at src/templates/MainResource/default.server.tsx routes to this view automatically
import { jahiaComponent } from "@jahia/javascript-modules-library";
import type { Props } from "./types.js";
import classes from "./component.module.css";

jahiaComponent(
  {
    componentType: "view",           // ← "view", NOT "template"
    nodeType: "namespace:blogPost",
    displayName: "Blog Post Full Page",
    name: "fullPage",                // ← this name is what MainResource routes to
  },
  ({ "jcr:title": title, body, subtitle }: Props) => (
    <article className={classes.article}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </article>
  ),
);
```

### Link to a full-page content item

Use `buildNodeUrl(currentNode)` to generate the URL to the item:

```tsx
<a href={buildNodeUrl(currentNode)}>{title}</a>
```

---

## Step 5 — Draft/publish pattern

A common pattern is to use a `publicationDate` property as a draft gate:

```cnd
- publicationDate (date)
```

Note: do **not** mark it as `mandatory` — that would be a breaking change on an existing type, and it doubles as the draft indicator (no date = draft).

In the query, filter published posts only:

```sql
AND post.[publicationDate] IS NOT NULL
ORDER BY post.[publicationDate] DESC
```

Display the date in the view:

```tsx
{publicationDate && (
  <time dateTime={publicationDate}>
    {new Date(publicationDate).toLocaleDateString(
      currentResource.getLocale().toString(),
      { dateStyle: "long" }
    )}
  </time>
)}
```

---

## Step 6 — Query in code with `useJCRQuery`

For custom listing components (rather than using the built-in query component), use `useJCRQuery` from the library inside a `.server.tsx` view:

```tsx
import { jahiaComponent, useJCRQuery, Render } from "@jahia/javascript-modules-library";
import type { JCRNodeWrapper } from "org.jahia.services.content";

jahiaComponent(
  { componentType: "view", nodeType: "namespace:blogListing" },
  (_, { renderContext }) => {
    const siteKey = renderContext.getSite().getName();
    const posts = useJCRQuery({
      query: `SELECT * FROM [namespace:blogPost] AS post
              WHERE ISDESCENDANTNODE(post, '/sites/${siteKey}/contents/blog')
                AND post.[publicationDate] IS NOT NULL
              ORDER BY post.[publicationDate] DESC`,
    });

    return (
      <section>
        {posts.map((post: JCRNodeWrapper) => (
          <Render key={post.getPath()} node={post} />
        ))}
      </section>
    );
  },
);
```

> `useJCRQuery` is server-side only (`.server.tsx`). For client-side dynamic queries triggered by user interaction, use the GraphQL approach in a `.client.tsx` island.

---

## Step 7 — Language switcher with `getSiteLocales`

For sites with multiple languages, build a language switcher by combining `getSiteLocales()` with `j:invalidLanguages` and `node.hasI18N()`. Filter out disabled or untranslated locales before generating URLs.

```tsx
import { getSiteLocales, buildNodeUrl, jahiaComponent } from "@jahia/javascript-modules-library";

jahiaComponent(
  { componentType: "view", nodeType: "ns:languageSwitcher" },
  (_, { currentNode }) => {
    const locales = getSiteLocales(); // Record<string, java.util.Locale>

    // Read j:invalidLanguages (languages disabled on this node)
    const invalidCodes = currentNode.hasProperty("j:invalidLanguages")
      ? currentNode.getProperty("j:invalidLanguages").getValues().map((v: any) => v.getString())
      : [];
    const invalidSet = new Set(invalidCodes);

    const links = Object.entries(locales)
      .filter(([code, locale]) =>
        !invalidSet.has(code) && currentNode.hasI18N(locale),
      )
      .map(([code]) => ({
        code,
        url: buildNodeUrl(currentNode, { language: code }),
      }));

    return (
      <nav aria-label="Language switcher">
        {links.map(({ code, url }) => (
          <a key={code} href={url} lang={code} hrefLang={code}>
            {code.toUpperCase()}
          </a>
        ))}
      </nav>
    );
  },
);
```

> `getSiteLocales()` returns all locales configured for the site — not just the active language. Always filter by `j:invalidLanguages` and `hasI18N()` before displaying.

---

## Step 7b — Query via GraphQL with `useGQLQuery`

For complex queries that span multiple nodes or need field-level projection, `useGQLQuery` is more efficient than `useJCRQuery`. It runs synchronously on the server using the current user's session.

```tsx
import { useGQLQuery, jahiaComponent } from "@jahia/javascript-modules-library";
import { gql } from "graphql-tag";

const BLOG_QUERY = gql`
  query LatestPosts($path: String!) {
    jcr {
      nodeByPath(path: $path) {
        descendants(typesFilter: { types: ["namespace:blogPost"] }, fieldFilter: {
          filters: [{ fieldName: "publicationDate", evaluation: NOT_EMPTY }]
        }) {
          nodes {
            name
            path
            displayName
            property(name: "publicationDate") { value }
            property(name: "jcr:title") { value }
          }
        }
      }
    }
  }
`;

jahiaComponent(
  { componentType: "view", nodeType: "namespace:blogListing" },
  (_, { renderContext }) => {
    const siteKey = renderContext.getSite().getName();
    const data = useGQLQuery(BLOG_QUERY, { path: `/sites/${siteKey}/contents/blog` });
    const posts = data?.jcr?.nodeByPath?.descendants?.nodes ?? [];

    return (
      <ul>
        {posts.map((post: any) => (
          <li key={post.path}>
            <a href={post.path}>{post.property?.value ?? post.displayName}</a>
          </li>
        ))}
      </ul>
    );
  },
);
```

---

## Step 8 — Hierarchical content with nested folders

Content folders can be nested to create sections (e.g. `tutorials/front-end/`, `tutorials/editors/`). Use `ISDESCENDANTNODE` in queries to automatically include all levels — no query changes needed as you add sub-folders.

For **sidebar navigation** or **tree panels**, traverse the JCR hierarchy directly instead of querying:

### Get a JCR node by path

```tsx
import { useServerContext } from "@jahia/javascript-modules-library";
import type { JCRNodeWrapper } from "org.jahia.services.content";

const { renderContext } = useServerContext();
const folderNode = renderContext.getMainResource().getNode().getSession().getNode(
  `/sites/${siteKey}/contents/tutorials`
) as JCRNodeWrapper;
```

### Walk up to the section root

```tsx
function findSectionRoot(node: JCRNodeWrapper): JCRNodeWrapper {
  const parts = node.getPath().split("/");
  const contentsPath = parts.slice(0, 4).join("/"); // /sites/siteKey/contents
  let current = node;
  while (current.getParent() && (current.getParent() as JCRNodeWrapper).getPath() !== contentsPath) {
    current = current.getParent() as JCRNodeWrapper;
  }
  return current;
}
```

> ⚠️ `getParent()` returns `Node` (JCR base type), not `JCRNodeWrapper`. Always cast: `current.getParent() as JCRNodeWrapper`.

### Recursively render a folder tree

Use a plain function (not a React component) for recursive tree rendering — avoids hook scope issues:

```tsx
import type { ReactElement } from "react";
import { buildNodeUrl } from "@jahia/javascript-modules-library";
import type { JCRNodeWrapper } from "org.jahia.services.content";

function renderTree(
  folder: JCRNodeWrapper,
  contentNodeType: string,
  depth: number = 0,
): ReactElement | null {
  const items: Array<{ type: "folder" | "item"; node: JCRNodeWrapper }> = [];
  const iter = folder.getNodes();
  while (iter.hasNext()) {
    const node = iter.nextNode() as JCRNodeWrapper;
    if (node.isNodeType("jnt:contentFolder")) items.push({ type: "folder", node });
    else if (node.isNodeType(contentNodeType)) items.push({ type: "item", node });
  }
  if (items.length === 0) return null;

  return (
    <ul>
      {items.map(({ type, node }) => {
        const key = node.getPath();
        if (type === "folder") {
          return (
            <li key={key}>
              <strong>{node.getPropertyAsString("jcr:title") || node.getName()}</strong>
              {renderTree(node, contentNodeType, depth + 1)}
            </li>
          );
        }
        return (
          <li key={key}>
            <a href={buildNodeUrl(node)}>
              {node.getPropertyAsString("jcr:title") || node.getName()}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

Use `folder.getNodes()` (returns a `NodeIterator`) — call `.hasNext()` / `.nextNode()` to iterate. The iterator preserves orderable-folder order (creation/manual reordering in jContent), which `ORDER BY jcr:name` would not.

---

- **JCR repository browser**: http://localhost:8080/modules/tools/jcrBrowser.jsp
- **Installed definitions browser**: http://localhost:8080/modules/tools/definitionsBrowser.jsp

---

## Validation checklist
- [ ] Content folder exists in Jahia UI under `contents/`
- [ ] Site key in query matches the actual site key (use `renderContext.getSite().getName()` in code)
- [ ] Query returns expected results in the built-in query component
- [ ] `jmix:mainResource` added if items need a full-page view
- [ ] Draft/publish filtering works correctly
- [ ] `buildNodeUrl(currentNode)` used for item links

## Troubleshooting
> https://academy.jahia.com/tutorials-get-started/front-end-developer/making-a-blog
