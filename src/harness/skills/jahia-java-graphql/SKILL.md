---
name: jahia-java-graphql
description: Extends the Jahia GraphQL schema from a Java module — a `DXGraphQLExtensionsProvider` that adds root queries, mutations and fields on `JCRNode`. Covers the POM, the annotations, returning a JCR node, the two gates every field passes (`@GraphQLRequiresPermission` and the API security filter scopes), how to test with curl, how a JavaScript module calls the field, and why a field does not appear. Use when a module must expose data or an operation over GraphQL, or when you review a GraphQL extension.
argument-hint: "[the query or mutation to add]"
allowed-tools: Read
---

# Extend the GraphQL schema

A Java module adds fields to the GraphQL API of Jahia (`/modules/graphql`) with three pieces: a
provider that lists the extension classes, the classes, and the gates that decide who calls each
field. `jahia-java-security` explains the gates in general. This skill gives the GraphQL details.

Write a GraphQL field when a page, a UI extension or another system needs data or an operation that
the standard `jcr` API does not give. To read content in a JavaScript view, use `useGQLQuery` or a
JCR-SQL2 query first (`jahia-dev-query-content`).

## 1. The POM

On top of the POM of `jahia-dev-java`:

```xml
<properties>
  <jahia-depends>default,graphql-dxm-provider</jahia-depends>
</properties>

<dependencies>
  <dependency>
    <groupId>org.jahia.modules</groupId>
    <artifactId>graphql-dxm-provider</artifactId>
    <version>3.4.0</version> <!-- the oldest provider the module supports: 3.4.0 ships with Jahia 8.2.1, 3.8.1 with 8.2.3.4 -->
    <scope>provided</scope>
  </dependency>
  <dependency>
    <groupId>io.github.graphql-java</groupId>
    <artifactId>graphql-java-annotations</artifactId>
    <version>${graphql-java-annotations.version}</version>
    <scope>provided</scope>
  </dependency>
  <dependency>
    <groupId>com.graphql-java</groupId>
    <artifactId>graphql-java</artifactId>
    <version>${graphql-java.version}</version>
    <scope>provided</scope>
  </dependency>
</dependencies>
```

The parent `jahia-modules` sets the two `${…}` versions to the ones Jahia runs. Keep
`<_dsannotations>*</_dsannotations>`, and add no `Import-Package` line for GraphQL: the bundle then
imports the provider packages with the range `[3.4,4)`.

## 2. The provider

```java
package org.example.mymodule.graphql;

import org.jahia.modules.graphql.provider.dxm.DXGraphQLExtensionsProvider;
import org.osgi.service.component.annotations.Component;

import java.util.Collection;
import java.util.List;

/** Lists every extension class: a reviewer sees the whole GraphQL surface of the module here. */
@Component(service = DXGraphQLExtensionsProvider.class, immediate = true)
public class MyModuleGraphQLExtensionsProvider implements DXGraphQLExtensionsProvider {

    @Override
    public Collection<Class<?>> getExtensions() {
        return List.of(MyModuleQueryExtension.class, MyModuleMutationExtension.class, MyModuleNodeExtension.class);
    }
}
```

Without `getExtensions()`, the provider scans its own package and the packages below for annotated
classes, and skips nested classes. The explicit list survives a move and shows the whole surface.

## 3. Queries

```java
package org.example.mymodule.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.node.GqlJcrNode;
import org.jahia.modules.graphql.provider.dxm.node.NodeQueryExtensions;
import org.jahia.modules.graphql.provider.dxm.node.SpecializedTypesHandler;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.services.sites.JahiaSitesService;

import javax.jcr.RepositoryException;
import java.util.regex.Pattern;

@GraphQLTypeExtension(DXGraphQLProvider.Query.class)
public final class MyModuleQueryExtension {

    private static final Pattern SITE_KEY = Pattern.compile("[A-Za-z0-9_-]+");

    private MyModuleQueryExtension() {
    }

    @GraphQLField
    @GraphQLName("myModuleGreeting")
    @GraphQLDescription("Greets the caller. Read-only, no node access.")
    public static GqlGreeting greeting(@GraphQLName("name") @GraphQLNonNull String name) {
        return new GqlGreeting("Hello " + name.strip());
    }

    @GraphQLField
    @GraphQLName("myModuleSiteHome")
    @GraphQLDescription("Home page of a site, read with the session of the caller")
    public static GqlJcrNode siteHome(@GraphQLName("siteKey") @GraphQLNonNull String siteKey,
                                      @GraphQLName("workspace") NodeQueryExtensions.Workspace workspace) {
        if (!SITE_KEY.matcher(siteKey).matches()) {
            throw new DataFetchingException("Invalid site key");      // getSiteByKey concatenates the key
        }
        NodeQueryExtensions.Workspace ws = workspace != null ? workspace : NodeQueryExtensions.Workspace.LIVE;
        try {
            JCRSessionWrapper session = JCRSessionFactory.getInstance().getCurrentUserSession(ws.getValue());
            JCRSiteNode site = JahiaSitesService.getInstance().getSiteByKey(siteKey, session);
            return SpecializedTypesHandler.getNode(site.getHome());
        } catch (RepositoryException e) {
            throw new DataFetchingException(e);
        }
    }
}
```

A small result type:

```java
package org.example.mymodule.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;

@GraphQLName("MyModuleGreeting")
@GraphQLDescription("A greeting")
public class GqlGreeting {

    private final String message;

    public GqlGreeting(String message) {
        this.message = message;
    }

    @GraphQLField
    @GraphQLNonNull
    @GraphQLDescription("The greeting text")
    public String getMessage() {          // field "message"
        return message;
    }

    @GraphQLField
    @GraphQLDescription("Length of the greeting")
    public int getLength() {              // field "length", type Int (nullable)
        return message.length();
    }
}
```

| Rule                                                       | Why                                                                                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root fields are `static`                                   | `Query` and `Mutation` extensions are never instantiated.                                                                                                                        |
| Prefix every root field and type by the module             | Two modules that add the same field name break the schema of the **whole** platform: even `jcr` disappears, and Content Editor stops, until one of the modules stops.            |
| Only types GraphQL can map                                 | A field that takes or returns `Object` makes the schema invalid, and every GraphQL request fails until the module stops. Return a scalar, a `GqlJcrNode` or a class of your own. |
| `getX()` is the field `x`                                  | Jahia removes `get` and `is`. `@GraphQLName` sets any other name.                                                                                                                |
| `@GraphQLNonNull` where null is impossible                 | A Java `int` or `boolean` becomes a nullable `Int` or `Boolean`.                                                                                                                 |
| Read with `getCurrentUserSession(workspace)`               | The caller then reads only what the caller may read. The default workspace of the `jcr` field is `EDIT`, where a guest reads nothing.                                            |
| Return a node with `SpecializedTypesHandler.getNode(node)` | The client can then select every `JCRNode` field on it, and the node is checked for validity.                                                                                    |
| Throw `DataFetchingException`                              | The client gets a GraphQL error with your message, and the other fields of the query still resolve.                                                                              |
| `@Reference` does not work in these classes                | They are not OSGi components. Get a service with `BundleUtils.getOsgiService(MyService.class, null)` and check it for `null`.                                                    |

## 4. A field on every JCR node

```java
package org.example.mymodule.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.node.GqlJcrNode;

import javax.jcr.RepositoryException;

@GraphQLTypeExtension(GqlJcrNode.class)
public class MyModuleNodeExtension {

    private final GqlJcrNode node;

    public MyModuleNodeExtension(GqlJcrNode node) {      // Jahia passes the node being resolved
        this.node = node;
    }

    @GraphQLField
    @GraphQLName("myModuleIsOfType")
    @GraphQLDescription("True when the node is of the given node type or mixin")
    public boolean isOfType(@GraphQLName("type") @GraphQLNonNull String type) {
        try {
            return node.getNode().isNodeType(type);
        } catch (RepositoryException e) {
            throw new DataFetchingException(e);
        }
    }
}
```

Jahia builds the extension for each node it resolves: the class needs the public constructor that
takes the `GqlJcrNode`, and its fields are not `static`. Without that constructor, the field still
appears in the schema, and every call answers `Internal Server Error(s) while executing query`.

## 5. Mutations and the two gates

```java
package org.example.mymodule.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.security.GraphQLRequiresPermission;
import org.jahia.osgi.BundleUtils;

@GraphQLTypeExtension(DXGraphQLProvider.Mutation.class)
public final class MyModuleMutationExtension {

    private MyModuleMutationExtension() {
    }

    // Not a JCR write, so no JCR ACL stops it: the permission is the only gate.
    @GraphQLField
    @GraphQLName("myModuleFlushCache")
    @GraphQLDescription("Flushes the cache of the module. Requires myModuleAdmin on /.")
    @GraphQLRequiresPermission("myModuleAdmin")
    public static boolean flushCache() {
        MyCacheService cache = BundleUtils.getOsgiService(MyCacheService.class, null);
        if (cache == null) {
            throw new DataFetchingException("The cache service is not available");
        }
        cache.flush();
        return true;
    }
}
```

`myModuleAdmin` is a permission of the module, declared in `src/main/import/permissions.xml`
(`jahia-java-permissions`).

Every field passes two gates.

**`@GraphQLRequiresPermission("perm")` checks the permission on the root node `/`**, not on a site
and not on the node the field returns. A site administrator or an editor holds site permissions on
the site only, so they fail a site permission written this way.

| Annotation                                        | Checked on        | Fits                                                                     |
| ------------------------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `@GraphQLRequiresPermission("myModuleAdmin")`     | `/`               | A server permission, held by server roles.                               |
| `@GraphQLRequiresPermission("perm/sites/mysite")` | `/sites/mysite`   | One fixed site only.                                                     |
| No annotation, a check in the code                | The node you name | A site permission: `site.hasPermission("perm")` on the site of the node. |

A mutation whose effect is not a JCR write (a cache, a configuration, a token, a call to another
server) has no other gate: give it a permission of the module, never none.

**The API security filter checks each field as `graphql.<Type>.<field>`**, for example
`graphql.Query.myModuleGreeting`. The default `graphql` scope applies only to a request whose
`Origin` or `Referer` is the Jahia server itself, from a user who may read `/sites`. A `curl` call
without an `Origin` header is refused, even as root. A guest gets no scope. A module that a guest or
a page must call ships its own scope (`jahia-java-security`) in
`src/main/resources/META-INF/configurations/org.jahia.bundles.api.authorization-<artifactId>.yml`:

```yaml
my_module_public:
  description: Pages of the site may call the public fields of MyModule
  auto_apply:
    - origin: hosted
  grants:
    - api: graphql.Query.myModuleGreeting, graphql.MyModuleGreeting, graphql.Query.myModuleSiteHome, graphql.GenericJCRNode.path
      node: none
    - api: graphql.Query.myModuleSiteHome, graphql.GenericJCRNode.path
      node:
        pathPattern: /sites/[^/]+/home
        workspace: live
```

- Jahia checks each field first with no node: every field needs a grant with `node: none`.
- Jahia checks again, with the node, a field that returns a node and each field selected on that
  node: they also need a grant that matches the node. Without both grants, the field answers
  `Permission denied`.
- A field selected on a node is named after the concrete type of the node: `graphql.GenericJCRNode.path`
  for a page or a content, `graphql.JCRSite.name` for a site. Grant the fields the client selects,
  and no more: a field left out of the grant, such as `name` here, stays refused.
- Never grant `api: graphql` as a whole, and never open a mutation with `auto_apply: always`.

## 6. Test it

```bash
curl -s -u root:<password> -H 'Content-Type: application/json' -H 'Origin: http://localhost:8080' \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ myModuleGreeting(name:\"Ada\") { message length } }"}'
```

- HTTP 200 does not mean success: read `errors` in the body.
- Without `-H 'Origin: …'`, every field answers `Permission denied`.
- Call the mutation as a user without the permission. Expect `GqlAccessDeniedException`.
- Test as the real users, not only as root: root holds every declared permission.
- Send a bad argument. Expect your `DataFetchingException` message.

## 7. Call it from a JavaScript module

- In a server view, call the field with `useGQLQuery({ query, variables })` from
  `@jahia/javascript-modules-library`, as `jahia-dev-create-view` shows.
- From the browser, in a `.client.tsx` island, `fetch` the URL that the server built with
  `buildEndpointUrl("/graphql")`, with `method: "POST"` and a JSON body. A guest then needs the scope
  of section 5.

## 8. When the field does not appear

| Symptom                                                            | Cause                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| The field is absent from the schema                                | The provider is not registered: bundle not `ACTIVE`, `_dsannotations` missing, wrong `service` (`jahia-java-osgi`). |
| One class of the module is absent                                  | The provider scans its package and finds no nested class. List the classes in `getExtensions()`.                    |
| Every query fails: `Field 'jcr' in type 'Query' is undefined`      | Two modules add the same field name. The log has `Duplicate field found in extension`.                              |
| Every query fails: `Object required to be not null`                | A type GraphQL cannot map, such as `Object`. The log has `InvalidSchemaException`.                                  |
| One field answers `Internal Server Error(s) while executing query` | A node extension without the public `(GqlJcrNode)` constructor, or an exception in the method.                      |
| Bundle `INSTALLED`, `Unresolved requirement … graphql.provider`    | Compiled against a newer provider than the server runs. Compile against the oldest one you support.                 |
| `Permission denied` for every field                                | No `Origin` header, or no scope for that caller.                                                                    |
| `Permission denied` on a field selected on a node                  | The scope has no grant that matches the node (section 5).                                                           |
| `Permission denied` for a site administrator                       | A site permission in `@GraphQLRequiresPermission`, which checks `/`. Check it in the code.                          |

List the fields the server has with `{ __type(name: "Query") { fields { name } } }`, as root.

## Review checklist

1. An explicit list of extension classes, and every root field and type prefixed by the module.
2. Every mutation, and every query that reveals administrative data, has a permission of the module
   in `@GraphQLRequiresPermission`, or a check in the code on the right node.
3. Reads use the session of the caller, never a system session on a path or key from an argument.
4. Arguments are validated before they reach a path, a query or a key.
5. A list returned to the client is bounded.
6. The module ships the scope its callers need, and no wider one.
7. Tests as root, as the real roles, as a guest, and without `Origin`.
