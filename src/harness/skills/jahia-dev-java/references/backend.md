# Jahia Backend Capabilities Reference

## Table of Contents
1. [Drools rule engine](#1-drools-rule-engine)
2. [JCR event listeners](#2-jcr-event-listeners)
3. [JCR SQL2 cheat sheet](#3-jcr-sql2-cheat-sheet)
4. [Queries and search indexing](#4-queries-and-search-indexing)
5. [External data sources (Provider API)](#5-external-data-sources-provider-api)
6. [Permissions and roles](#6-permissions-and-roles)

---

## 1. Drools rule engine

Jahia uses JBoss Drools 6 for a rules engine that reacts to JCR events.

### Rule file locations

| File | Scope |
|------|-------|
| `META-INF/rules.drl` | All workspaces (default and live) |
| `META-INF/default-rules.drl` | Edit/preview workspace only |
| `META-INF/live-rules.drl` | Live workspace only |
| `META-INF/rules.dsl` | Custom DSL extensions |

### Basic rule structure

```drools
package org.example.mymodule.rules

import org.jahia.services.content.rules.*
import org.jahia.services.content.JCRContentUtils
import org.slf4j.Logger

global User user
global Service service
global Logger logger
global MyService myService

rule "Log new article creation"
    when
        A new node is created
        - the node has the type jnt:article
    then
        Log "New article created: " + node.getName() at INFO level
end

rule "Notify on page publish"
    salience 100
    when
        A node is published
        - the node has the type jnt:page
    then
        myService.notifyPublish(node)
end
```

**Critical rules:** Rule titles are globally unique across the platform — never reuse rule names between modules.

**Package names:** Use a unique package per module — do not share package names across modules.

### Built-in DSL conditions (excerpt)

```drools
A new node is created             # AddedNodeFact
A node is published               # PublishedNodeFact
A node is deleted                 # DeletedNodeFact
A node is modified                # ChangedPropertyFact
- the node has the type {type}    # Checks primaryType or mixin
```

### Built-in global objects

| Global | Type | Description |
|--------|------|-------------|
| `user` | `org.jahia.services.content.rules.User` | Current user context |
| `service` | `org.jahia.services.content.rules.Service` | Core JCR service shortcuts |
| `logger` | `org.slf4j.Logger` | SLF4J logger |
| `imageService` | `org.jahia.services.content.rules.ImageService` | Image operations |
| `extractionService` | `org.jahia.services.content.rules.ExtractionService` | Content extraction |

### Registering a custom service as a rules global

Step 1 — Declare the service component:
```java
@Component(service = MyService.class)
public class MyService {
    public void doSomething(AddedNodeFact node) throws RepositoryException { }
}
```

Step 2 — Register as a global rules object:
```java
@Component(service = ModuleGlobalObject.class)
public class MyRulesGlobalObjects extends ModuleGlobalObject {
    @Reference
    public void setMyService(MyService myService) {
        getGlobalRulesObject().put("myService", myService);
    }
    public void unsetMyService(MyService myService) {
        getGlobalRulesObject().remove("myService");
    }
}
```

Step 3 — Declare global and import in rules.drl:
```drools
import org.example.mymodule.MyService
global MyService myService
```

**Important:** Export the package containing `MyService` so other modules can import it in DRL files.

### Custom DSL extensions (rules.dsl)

```drools
[condition][]A new article is created=node : AddedNodeFact (types contains "jnt:article")
[consequence][]Notify publish for {node}=myService.notifyPublish({node});
```

---

## 2. JCR event listeners

Extend `DefaultEventListener` to react to JCR node events:

```java
public class MyJCREventListener extends DefaultEventListener {

    @Override
    public int getEventTypes() {
        return Event.NODE_ADDED | Event.NODE_REMOVED | Event.PROPERTY_CHANGED;
    }

    @Override
    public String getPath() {
        return "/sites";
    }

    @Override
    public void onEvent(EventIterator events) {
        while (events.hasNext()) {
            Event event = events.nextEvent();
            try {
                String path = event.getPath();
            } catch (RepositoryException e) {
                logger.error("Error processing event", e);
            }
        }
    }
}
```

**JCR Event types:** `Event.NODE_ADDED`, `Event.NODE_REMOVED`, `Event.PROPERTY_ADDED`, `Event.PROPERTY_CHANGED`, `Event.PROPERTY_REMOVED`, `Event.NODE_MOVED`

---

## 3. JCR SQL2 cheat sheet

JCR SQL2 syntax: `SELECT * FROM [nodeType] AS alias WHERE conditions ORDER BY alias.[prop]`

### Querying node types

```sql
-- Prefer jmix:searchable over nt:base for broad queries
SELECT * FROM [jmix:searchable] AS node

SELECT * FROM [jnt:page] AS page
SELECT * FROM [jnt:file] AS file
SELECT * FROM [jnt:article] AS article
```

### Path constraints (always include for performance)

```sql
SELECT * FROM [jnt:article] AS node
WHERE ISDESCENDANTNODE(node, '/sites/mySite')

SELECT * FROM [jnt:page] AS child
WHERE ISCHILDNODE(child, '/sites/mySite/home')
```

### String matching

```sql
SELECT * FROM [jnt:content] AS node WHERE node.[jcr:title] = 'My Title'
SELECT * FROM [jnt:content] AS node WHERE node.[jcr:title] LIKE '%news%'
SELECT * FROM [jnt:page] AS node WHERE LOWER(node.[jcr:title]) = 'home'
SELECT * FROM [jnt:page] AS page WHERE page.[jcr:title] IS NOT NULL
SELECT * FROM [jnt:content] AS node WHERE CONTAINS(node.*, 'digital')
```

### Property and type queries

```sql
SELECT * FROM [jnt:page] AS page WHERE page.[j:published] > CAST('true' AS BOOLEAN)
SELECT * FROM [jnt:page] AS page
WHERE page.[j:published] > CAST('2021-01-01T00:00:01.000Z' AS DATE)
```

### Ordering and templates

```sql
SELECT * FROM [jnt:page] AS page ORDER BY page.[j:lastModified] DESC
SELECT * FROM [jnt:page] AS page WHERE page.[j:templateName] = 'home'
```

### Non-query lookups (use instead of queries for performance)

```java
// By UUID (preferred over UUID query)
session.getNodeByIdentifier("the-uuid-string");

// Set result limit (no LIMIT keyword in JCR SQL2)
QueryObjectModelImpl qom = ...;
qom.setLimit(20);
qom.setOffset(0);
```

---

## 4. Queries and search indexing

### Executing a JCR SQL2 query in Java

```java
JCRSessionWrapper session = JCRSessionFactory.getInstance()
    .getCurrentUserSession("default", Locale.ENGLISH);

QueryManager queryManager = session.getWorkspace().getQueryManager();
Query query = queryManager.createQuery(
    "SELECT * FROM [jnt:article] WHERE ISDESCENDANTNODE('/sites/mySite')",
    Query.JCR_SQL2
);
QueryResult result = query.execute();
NodeIterator nodes = result.getNodes();
while (nodes.hasNext()) {
    JCRNodeWrapper node = (JCRNodeWrapper) nodes.nextNode();
}
```

### Index tuning via CND keywords

```cnd
- title (string) i18n boost=3.0          # Higher search relevance
- code (string) analyzer=keyword          # Index as single token
- internalNotes (string) nofulltext       # Indexed but not in full-text search
- binaryData (binary) indexed=no          # Not indexed at all
- category (string) facetable            # Enables faceted search
```

---

## 5. External data sources (Provider API)

The External Provider API allows exposing non-JCR data as virtual JCR nodes.

### Key interfaces

| Interface | Purpose |
|-----------|---------|
| `ExternalDataSource` | Main interface to implement for external data |
| `ExternalDataSource.Searchable` | Add search support |
| `ExternalDataSource.Writable` | Add write support |
| `ExternalContentStoreProvider` | OSGi service to mount the provider |

### Minimal ExternalDataSource implementation

```java
@Component(service = ExternalDataSource.class)
public class MyExternalDataSource implements ExternalDataSource {

    @Override
    public List<String> getChildren(String path) throws PathNotFoundException {
        return Arrays.asList("item1", "item2");
    }

    @Override
    public ExternalData getItemByPath(String path) throws PathNotFoundException {
        ExternalData data = new ExternalData("unique-id", path, "jnt:content",
            new HashMap<String, String[]>());
        data.getProperties().put("jcr:title", new String[]{"My Title"});
        return data;
    }

    @Override
    public ExternalData getItemByIdentifier(String identifier) throws ItemNotFoundException {
        return null;
    }

    @Override
    public Set<String> getSupportedNodeTypes() {
        return Collections.singleton("jnt:content");
    }

    @Override public boolean isSupportsUuid() { return false; }
    @Override public boolean isSupportsHierarchicalIdentifiers() { return false; }
    @Override public boolean itemExists(String path) { return true; }
}
```

---

## 6. Permissions and roles

### Permission hierarchy

| Level | Description |
|-------|-------------|
| Server level | Global roles (e.g., Server Administrator) |
| Site level | Site-specific roles (e.g., Site Administrator, Editor) |
| Node level | Per-node ACL inheritance |

### Checking permissions in code

```java
if (currentNode.hasPermission("jcr:write")) { }

// In JSP
<c:if test="${jcr:hasPermission(currentNode, 'jcr:write')}">...</c:if>
```

### Standard JCR permissions

| Permission | Description |
|------------|-------------|
| `jcr:read` | Read node and properties |
| `jcr:write` | Modify properties and children |
| `jcr:addChildNodes` | Add child nodes |
| `jcr:removeNode` | Delete the node |
| `jcr:modifyProperties` | Modify properties |
