---
name: jahia-java-render-filter
description: Writes or reviews a Jahia render filter in Java — a class that extends `AbstractFilter` and changes the HTML or the response of every render it matches. Covers the OSGi registration, the conditions, the priority and the HTML cache (what runs on every request and what is cached), `prepare`, `execute` and `finalize`, idempotent rewrites, and how to encode a value written into the HTML. Use when a module must add or change markup, a header or a request attribute around the render of pages or components, or when you review an existing filter.
argument-hint: "[what the filter must do]"
allowed-tools: Read
---

# Write a render filter

A render filter runs around the render of a resource: a page, or a component inside a page. It can
change the HTML, set a response header, or prepare request attributes for the views. Jahia runs a
chain of filters for **every** resource it renders, so a filter costs something on every fragment
of every page.

Write a filter only when the change applies to many renders that you do not own. To change the
markup of one component, change its view instead.

## 1. The class

```java
package org.example.mymodule;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.services.render.RenderContext;
import org.jahia.services.render.Resource;
import org.jahia.services.render.filter.AbstractFilter;
import org.jahia.services.render.filter.RenderChain;
import org.jahia.services.render.filter.RenderFilter;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;

/** Adds the site title as a meta element to every live or preview HTML page. */
@Component(service = RenderFilter.class, immediate = true)
public class SiteTitleMetaFilter extends AbstractFilter {

    private static final String HEAD_END = "</head>";
    private static final String MARKER = "<meta name=\"site-title\"";

    @Activate
    public void activate() {
        setPriority(3f);                              // below the HTML cache (16): runs on every request
        setDescription("Adds the site title as a meta element");
        setApplyOnModes("live,preview");              // not in edit mode
        setApplyOnConfigurations("page");             // once per page, not on every fragment
        setApplyOnTemplateTypes("html,html-.+");      // a regular expression
        setSkipOnAjaxRequest(true);
    }

    @Override
    public String execute(String previousOut, RenderContext renderContext, Resource resource, RenderChain chain)
            throws Exception {
        JCRSiteNode site = renderContext.getSite();
        int headEnd = StringUtils.indexOfIgnoreCase(previousOut, HEAD_END);
        if (site == null || StringUtils.isBlank(site.getTitle()) || headEnd < 0 || previousOut.contains(MARKER)) {
            return previousOut;                       // nothing to add, or already added: the same HTML can pass twice
        }
        String meta = MARKER + " content=\"" + StringEscapeUtils.escapeXml11(site.getTitle()) + "\">\n";
        return new StringBuilder(previousOut).insert(headEnd, meta).toString();
    }
}
```

Add commons-text to the POM as `provided`, because Jahia exports it:

```xml
<dependency>
  <groupId>org.apache.commons</groupId>
  <artifactId>commons-text</artifactId>
  <version>1.10.0</version>
  <scope>provided</scope>
</dependency>
```

The rest of the POM is the one of `jahia-dev-java`, with `<_dsannotations>*</_dsannotations>`.

| Part                                       | Why                                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@Component(service = RenderFilter.class)` | Jahia collects filters as services of exactly this type. Another type, or no `service`, and the filter never runs.                                               |
| No `@Reference RenderService`              | Jahia injects the render service itself when it registers the filter.                                                                                            |
| Conditions in `@Activate`                  | Each setter **adds** a condition, and nothing removes one. Never call them from `@Modified`. A `null` argument throws, and `@Activate` then disables the filter. |
| `setPriority(…)`                           | Always set it. The default is 99, the priority of the filter that renders the view. A filter left at 99 runs or never runs depending on the name of its package. |

## 2. Conditions

Every condition must match (AND). A comma list inside one setter is an OR.

| Setter                                    | Matches                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `setApplyOnModes("live,preview")`         | The render mode: `live`, `preview`, `edit`, `contribute`, `studio`.                         |
| `setSkipOnEditMode(true)`                 | Excludes the edit modes. `setApplyOnEditMode(false)` does **nothing**: do not use it.       |
| `setApplyOnConfigurations("page")`        | `page` is the whole page. `module` is a component, `include` and `wrapper` are inner calls. |
| `setApplyOnNodeTypes("jnt:news")`         | The node of the resource, with its supertypes and mixins.                                   |
| `setApplyOnTemplateTypes("html,html-.+")` | A **regular expression** on the template type. `html-*` would not match `html-iphone`.      |
| `setApplyOnTemplates("default")`          | The exact name of the view.                                                                 |
| `setApplyOnModules("my-module")`          | The module of the view being rendered.                                                      |
| `setSkipOnAjaxRequest(true)`              | Skips the Ajax renders.                                                                     |
| `addCondition((ctx, res) -> …)`           | Any other test, as a lambda. Keep it cheap: Jahia evaluates it several times per render.    |

A filter with no configuration condition runs on **every fragment** of the page: areas, lists,
components, includes. On the home page of the Digitall demo site, that is 183 calls for one request.
Add `setApplyOnConfigurations("page")` unless the work is per component.

A condition must give the same answer for the whole render. Jahia checks the conditions again before
each phase. A condition that changes during the render can make Jahia skip the `finalize` of the
filter (section 4).

## 3. Priority and the HTML cache

Jahia sorts filters by priority. `prepare` runs from the lowest priority up, and `execute` runs from
the highest down. The HTML cache of live mode is the filter at priority **16**:

| Priority     | When it runs                                                                                                   | Use it for                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| -3 and below | On every request. Its `execute` runs after those of the edit-mode, externalization and asset filters (-2 to 0) | The last word on the final page HTML, such as a nonce on every `<script>`.                  |
| -2 to 0      | Taken by core filters                                                                                          | Nothing: keep out of this range.                                                            |
| 1 to 15      | On every request, cached or not                                                                                | Anything per request or per user, a response header, a value that changes between requests. |
| 16           | The HTML cache itself                                                                                          | Nothing.                                                                                    |
| 17 to 98     | **Only when the fragment is not in the cache**, in live mode                                                   | A change that depends only on the content, and that may be cached with the fragment.        |
| 99 and above | Never, or not reliably                                                                                         | Nothing.                                                                                    |

What a filter above 16 must know:

- **Its output is cached and served to every visitor** who shares the cache key. A user name, a
  token, a request parameter or a random value written there leaks to the next visitors.
- **Its output stays stale** until Jahia flushes that fragment. A filter above 16 that writes a
  property of another node (the site, a parent page) shows the old value after that node changes.
- **A response header or a request attribute it sets is lost** on a cache hit.
- It sees cache placeholders (`cache:include` tags) instead of the HTML of the components below it,
  on the page as on a component. Do not rewrite or reorder them. To change the final HTML of the
  page, stay below 16.
- It runs while Jahia generates the fragment, and Jahia generates a limited number of fragments at
  once. A slow call there (a remote API, a heavy query) delays every render that waits for the same
  fragments.

**Preview and edit modes have no HTML cache.** A cache bug never shows there. Test in live, on
published content.

### Check the cache with two identical requests

Publish the page, then request it twice, as a guest, in live:

```bash
curl -s http://localhost:8080/sites/mysite/home.html > first.html
curl -s http://localhost:8080/sites/mysite/home.html > second.html
```

- A value written below 16 (a per-request id, a nonce) must **differ** between the two answers. A
  header must be on both.
- A value written above 16 is the **same** in both answers: it comes from the cache.
- A per-user value must differ between two users. If it does not, it leaks through the cache.
- Request the page in edit mode (`/cms/editframe/default/en/sites/mysite/home.html`) and check that
  a filter limited to `live,preview` added nothing, and that a filter allowed there added its markup
  once.

## 4. `prepare`, `execute`, `finalize`

| Method     | Order              | Returns                                                                                                      | Use                                                       |
| ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `prepare`  | Lowest priority up | `null` to continue. A non-null string **stops the chain**: it becomes the output, and the view does not run. | Set up the render. Short-circuit it with your own output. |
| `execute`  | Highest down       | The HTML, changed or not.                                                                                    | Change the HTML or the response.                          |
| `finalize` | Lowest up          | Nothing. It cannot change the HTML.                                                                          | Release what `prepare` took.                              |

`finalize` runs in a `finally` block: also when the render failed. Jahia logs an exception thrown in
`finalize` as a warning and goes on.

**Override `finalize` only when `prepare` takes a resource**: a lock, a permit, a `ThreadLocal`.
Release only what this call took, and never throw. A resource that a failed render does not give
back leaks on every error, and the leak can take the whole site down.

For a request attribute that the views must see during the render, do not write `finalize`. Use
`chain.pushAttribute(request, name, value)`: Jahia restores the previous value at the end of the
chain.

When `prepare` returns a non-null value, the chain stops at that filter:

- the filters of a higher priority run neither `prepare` nor `execute`. Below 16, the HTML cache is
  one of them, so it neither reads nor stores that output;
- the `execute` of the same filter runs, with that value as `previousOut`, then the `execute` of
  each filter of a lower priority.

A filter that redirects in `prepare`, for a login or an access check, returns `""`. With `null`,
Jahia renders the whole page anyway, into a response that is already sent, and throws the work away.

## 5. Write HTML from Java

Every value that reaches the HTML gets the encoder of its context. Content that editors write (the
site title, a page property) is not trusted: it reaches guests.

| Context                         | Encoder                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| HTML text                       | `StringEscapeUtils.escapeHtml4(value)`                         |
| HTML attribute, any quote style | `StringEscapeUtils.escapeXml11(value)`                         |
| A URL in `href` or `src`        | Allow only `http` and `https`, then encode it.                 |
| Inside `<script>`               | Never. Write a `data-*` attribute and read it from the script. |

`escapeHtml4` leaves the apostrophe as it is: never use it for an attribute.

- **Never echo a request parameter or header** into the page from a filter.
- **Make every rewrite idempotent.** The same HTML can pass through the filter twice: once on a
  fragment and once on the page, or again when it comes from the cache. Check for your marker
  before you insert it.
- Use the Jericho parser (`net.htmlparser.jericho`, exported by Jahia) for a structural change. A
  regular expression is acceptable only for a fixed insertion, such as before `</head>`.
- A filter is not a security control for the whole site. A header such as a Content Security Policy
  added by a filter covers only the renders it matches. Pages that other servlets serve, such as
  administration screens, do not get it.
- A filter used as an access guard covers only what its conditions match. A guard limited to one
  view (`setApplyOnTemplates("default")`) does not protect the other views of the same type: each
  view must check too.

## 6. When the filter does nothing

| Symptom                                    | Cause                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Never called                               | Bundle not `ACTIVE`, `_dsannotations` missing, wrong `service`, or `@Activate` threw (`jahia-java-osgi`).             |
| Never called, the component is active      | A condition never matches: a template type written as a glob, a mode list without the mode you test, a priority ≥ 99. |
| Works in preview, not in live              | It runs above 16: its first output is cached. Publish, then flush the cache or lower the priority.                    |
| Markup added twice                         | No configuration condition, or a rewrite that is not idempotent.                                                      |
| Called in edit mode although excluded      | `setApplyOnEditMode(false)`, which adds no condition. Use `setSkipOnEditMode(true)`.                                  |
| A header present on the first request only | The filter runs above 16: the next requests come from the cache.                                                      |

Log every filter step with the logger `org.jahia.services.render.filter.RenderChain` at `DEBUG`.

## Review checklist

1. `service = RenderFilter.class`, an explicit priority with a reason, and conditions set once in
   `@Activate`.
2. Edit mode excluded on purpose, with `setApplyOnModes` or `setSkipOnEditMode(true)`.
3. `page` configuration unless the work is per component.
4. Nothing per user or per request above 16. No blocking call above 16.
5. Every value encoded for its context. No request echo. An idempotent rewrite.
6. `finalize` exists if and only if `prepare` takes a resource, and it releases only what this call
   took.
7. The two-request check in live, written in the pull request.
