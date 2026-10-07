---
name: jahia-java-jcr
description: JCR access from Jahia Java code — which session to use (user or system, default or live workspace, locale), node names, find-or-create under concurrent requests, mixins, JCR-SQL2 queries from Java, publication, locks, versioning and event listeners. Gives the correct pattern first, then the pitfalls that cause data loss, a permission bypass or a duplicate node. Load when you write or review any Java class that reads or writes the JCR.
allowed-tools: Read
---

# JCR access from Jahia Java code

## Which session

| Need | Session |
| --- | --- |
| Inside an Action, a render filter or a view | The session Jahia gives you: `session` in `Action.doExecute`, or `resource.getNode().getSession()`. It is the session of the current user, in the workspace and locale of the URL. |
| Elsewhere, as the current user | `JCRSessionFactory.getInstance().getCurrentUserSession(workspace, locale)` |
| As a named user, in a background job | `JCRTemplate.getInstance().doExecuteWithUserSession(username, workspace, locale, session -> { … })` |
| With every permission (system session) | `JCRTemplate.getInstance().doExecuteWithSystemSession(null, workspace, locale, session -> { … })` |

- **A user session applies the permissions (ACLs) of the user.** A guest reads only what guests
  may read, in `live` only.
- **A system session ignores every permission.** Use it only after a permission check that you can
  point to, in the same call chain. Write that check next to the call. A system session that
  works on a node chosen by a request parameter, with no check, lets any caller read or change any
  node.
- **Workspaces.** `default` holds what editors work on. `live` holds what visitors see. A public
  page reads `live`. Content reaches `live` through publication, never through a direct write to
  `live`.
- **Locale.** Pass the locale whenever you read an internationalized property (`jcr:title`, any
  `i18n` property). Without it, the value depends on the default locale of the session.
- **Threads.** A `JCRSessionWrapper` belongs to one thread. Never keep it in a field, and never pass
  it to another thread or an executor. Open a new session in the other thread.
- **Save.** Changes exist only in the session until `session.save()`.

## Read properties

```java
JCRNodeWrapper node = resource.getNode();
if (node.hasProperty("latitude")) {
    double latitude = node.getProperty("latitude").getDouble();
}
String title = node.getPropertyAsString("jcr:title");   // null when absent
String name = node.getDisplayableName();                // the title, or the node name
```

Check `hasProperty` before `getProperty`: a missing property throws `PathNotFoundException`. Every
property is optional at runtime, even when the definition declares it `mandatory`.

## Node names

`/ : [ ] | *` and names made only of spaces are not valid in a node name. Never build a node name
from user input with your own regular expression:

```java
String name = JCRContentUtils.generateNodeName(title);                  // a valid name from any text
String free = JCRContentUtils.findAvailableNodeName(parent, name);      // name, name-1, name-2, …
```

## Find or create under concurrent requests

Two requests can both check that `parent/x` does not exist, then both add it. Jahia then keeps two
siblings with the same name, or throws `ItemExistsException`. Choose one:

- a unique name by construction (`findAvailableNodeName`, or a UUID) with the display name in a
  property;
- a lock on the parent around the check and the creation, released in a `finally` block.

An endpoint open to guests that finds or creates without either one is a bug.

## Mixins

- Call `node.addMixin("jmix:myMixin")` before you set a property that only the mixin defines.
- Test with `node.isNodeType("jmix:myMixin")`. It is true for the primary type, its supertypes and
  the mixins.
- A mixin declared in the definition of a type exists on every node of that type. A mixin added
  with `addMixin` exists on that node only. Code that copies, exports or versions nodes must copy
  the mixins (`node.getMixinNodeTypes()`), not only the properties.
- Content created before a mixin was added to the definition does not have it. Do not assume.

## Queries

```java
QueryManager qm = session.getWorkspace().getQueryManager();
Query query = qm.createQuery(
        "SELECT * FROM [jnt:news] AS n WHERE ISDESCENDANTNODE(n, '/sites/mysite') AND n.[category] = $category "
        + "ORDER BY n.[date] DESC",
        Query.JCR_SQL2);
query.bindValue("category", session.getValueFactory().createValue(category));
query.setLimit(20);
for (NodeIterator it = query.execute().getNodes(); it.hasNext(); ) {
    JCRNodeWrapper item = (JCRNodeWrapper) it.nextNode();
}
```

- Always restrict the path with `ISDESCENDANTNODE` or `ISCHILDNODE`.
- Query the most precise node type. Never `[nt:base]`. For "any content", use `[jmix:searchable]`.
- JCR-SQL2 has no `LIMIT` keyword. Use `query.setLimit(n)` and `query.setOffset(n)`.
- Bind every value from a request with `$name` and `bindValue`. Never concatenate it into the
  statement.
- To get a node by identifier, call `session.getNodeByIdentifier(uuid)`. Do not query for it.
- The `jahia-jcr-sql2` skill has the full syntax.

## Publication

```java
JCRPublicationService.getInstance().publishByMainId(node.getIdentifier());
```

It publishes the node from `default` to `live` with the rules of Jahia (sub-nodes, references,
languages). Do not copy nodes to `live` yourself.

## Versioning

A node of type `mix:versionable` must be checked out before a write
(`session.getWorkspace().getVersionManager().checkout(node.getPath())`), or the write throws
`VersionException`. Publication handles this. Only a custom write path on versioned nodes needs it.

## Locks

Before a write, respect an existing lock. A lock held by another user, a workflow or a publication
means the node is in use. Fail with a clear error. Never clear a lock you did not take, and never
continue after a failed attempt to clear one.

## Event listeners

- Extend `DefaultEventListener`, return the event types (`getEventTypes`) and the path
  (`getPath`), and register the listener as an OSGi component
  (`@Component(service = DefaultEventListener.class, immediate = true)`). Jahia picks it up, and DS
  removes it when the bundle stops.
- Keep `onEvent` short. Move slow work, such as an HTTP call, to an executor that `@Deactivate`
  shuts down.
- `JCRObservationManager.setAllEventListenersDisabled(true)` applies to the current thread only.

## `RepositoryException`

- **In a permission or type check:** when the check throws, refuse the operation. A `catch` that
  logs and continues lets the operation run without the check.
- **In a read:** return an error to the caller rather than a partial result that looks complete.
- **In an Action:** catch the exceptions you expect and answer a JSON error. An uncaught exception
  becomes an HTML `500` page.
