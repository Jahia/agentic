# Jahia Rendering Reference

## Table of Contents
1. [View script selection](#1-view-script-selection)
2. [JSP rendering with taglibs](#2-jsp-rendering-with-taglibs)
3. [Templates, areas, and cascading](#3-templates-areas-and-cascading)
4. [Caching directives](#4-caching-directives)
5. [Navigation menus](#5-navigation-menus)
6. [Rendering filters](#6-rendering-filters)
7. [List rendering](#7-list-rendering)

---

## 1. View script selection

**JSP naming convention:**
```
src/main/webapp/{nodeType_with_slash}/{templateType}/{viewName}.{displayType}.jsp
```

Examples:
```
src/main/webapp/jnt_article/html/article.jsp          # default view
src/main/webapp/jnt_article/html/article.summary.jsp  # "summary" named view
src/main/webapp/jnt_article/json/article.json.jsp     # JSON template type
src/main/webapp/jnt_article/html/article.hidden.header.jsp  # hidden view
```

**Prefix `hidden.`** on a view name to exclude it from the UI view selector.

---

## 2. JSP rendering with taglibs

### Standard taglib declarations
```jsp
<%@ taglib prefix="template" uri="http://www.jahia.org/tags/templateLib" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<%@ taglib prefix="jcr" uri="http://www.jahia.org/tags/jcr" %>
<%@ taglib prefix="ui" uri="http://www.jahia.org/tags/uiComponentsLib" %>
```

### Key implicit variables

| Variable | Type | Description |
|----------|------|-------------|
| `currentNode` | `JCRNodeWrapper` | The node being rendered |
| `currentUser` | `JahiaUser` | The currently logged-in user |
| `renderContext` | `RenderContext` | Current rendering context |
| `url` | `URLGenerator` | URL generation helper |

### Common template taglib usage
```jsp
<template:module node="${currentNode}" view="summary"/>
<template:area path="maincontent"/>
<template:addCacheDependency node="${commentNode}"/>
<template:link node="${targetNode}"/>
```

### Full JSP view example
```jsp
<%@ taglib prefix="template" uri="http://www.jahia.org/tags/templateLib" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>

<c:set var="title" value="${currentNode.properties['jcr:title'].string}"/>
<c:set var="body" value="${currentNode.properties['body'].string}"/>

<article class="my-article">
    <h1>${fn:escapeXml(title)}</h1>
    <div class="body">${body}</div>
    <template:area path="related-content"/>
</article>
```

---

## 3. Templates, areas, and cascading

Page rendering cascades: page → home template → base template → template view.

**Absolute areas** (`level` attribute): use an ancestor path instead of the template sequence.
- Level 0 = home page
- Level 1 = first sub-page level

---

## 4. Caching directives

### Per-view cache configuration

Create a `.properties` file alongside the JSP:

```properties
# jnt_banner/html/banner.properties
cache.expiration=30      # Cache for 30 seconds
# cache.expiration=-1   # Never cache this view
cache.perUser=true       # Cache per user
cache.mainResource=true  # Cache depends on the main resource
```

### Adding cache dependencies in JSPs

```jsp
<template:addCacheDependency node="${commentsNode}"/>
<template:addCacheDependency
    flushOnPathMatchingRegexp="\Q${renderContext.mainResource.node.path}\E/.*/comments/.*"/>
```

---

## 5. Navigation menus

```jsp
<jcr:node var="siteNode" path="${renderContext.site.path}"/>
<c:set var="homeNode" value="${siteNode.node['home']}"/>

<nav>
  <ul>
    <c:forEach var="pageNode" items="${homeNode.nodes}">
      <c:if test="${pageNode.nodeType.name == 'jnt:page'}">
        <li>
          <template:link node="${pageNode}">
            <c:out value="${pageNode.properties['jcr:title'].string}"/>
          </template:link>
        </li>
      </c:if>
    </c:forEach>
  </ul>
</nav>
```

---

## 6. Rendering filters

Filters intercept every module render. Extend `AbstractFilter` and register as OSGi `RenderFilter` services.

### Priority rules
- Priority > 16: runs once, result is cached
- Priority < 16: runs on EVERY request (very expensive — avoid)

### Filter implementation
```java
@Component(service = RenderFilter.class)
public class MyFilter extends AbstractFilter {

    @Activate
    public void activate() {
        setPriority(20);
        setApplyOnConfigurations("page");
        setApplyOnTemplateTypes("html,html-*");
        setApplyOnNodeTypes("jnt:myContent");
    }

    @Override
    public String execute(String previousOut, RenderContext renderContext,
            Resource resource, RenderChain chain) throws Exception {
        String output = super.execute(previousOut, renderContext, resource, chain);
        return output;
    }
}
```

---

## 7. List rendering

The `jmix:list` mixin provides built-in list rendering.

### moduleMap parameters

| Parameter | Description |
|-----------|-------------|
| `currentList` | Iterable of nodes to display |
| `begin` | Start index |
| `end` | End index |
| `listQuery` | JCR SQL2 query |
| `subNodesView` | View name used for child nodes |
| `editable` | Whether list is editable (default: true) |

### Query-based list example (`hidden.load.jsp`)
```jsp
<query:definition var="listQuery"
    statement="SELECT * FROM [jnt:article] WHERE ISDESCENDANTNODE('${renderContext.mainResource.node.path}') ORDER BY [jcr:lastModified] DESC"
    limit="10"/>
<c:set target="${moduleMap}" property="listQuery" value="${listQuery}"/>
<c:set target="${moduleMap}" property="editable" value="false"/>
```
