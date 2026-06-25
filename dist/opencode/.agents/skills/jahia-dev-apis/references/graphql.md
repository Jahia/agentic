# Jahia GraphQL API Reference

## Table of contents
1. [Endpoint and transport](#endpoint-and-transport)
2. [Authentication and authorization](#authentication-and-authorization)
3. [Workspaces and internationalization](#workspaces-and-internationalization)
4. [JCR queries](#jcr-queries)
5. [JCR mutations](#jcr-mutations)
6. [Pagination (Connection pattern)](#pagination-connection-pattern)
7. [Field filtering and sorting](#field-filtering-and-sorting)
8. [Extending the schema — SDL](#extending-the-schema--sdl)
9. [Extending the schema — Java](#extending-the-schema--java)
10. [Apollo client setup](#apollo-client-setup)
11. [CORS and OSGi configuration](#cors-and-osgi-configuration)
12. [GraphQL playground](#graphql-playground)
13. [Introspection access control](#introspection-access-control)

---

## Endpoint and transport

```
POST /modules/graphql
Content-Type: application/json
Accept: application/json
Body: { "query": "...", "variables": { ... } }
```

GraphQL is the preferred API for client-side applications in Jahia 8.2. The implementation is based on `graphql-java` with a JCR extension (`graphql-dxm-provider`).

From a view (JSP), you can call it with plain XHR:

```javascript
var xhr = new XMLHttpRequest();
xhr.responseType = 'json';
xhr.open("POST", "/modules/graphql");
xhr.setRequestHeader("Content-Type", "application/json");
xhr.setRequestHeader("Accept", "application/json");
xhr.send(JSON.stringify({ query: '{ jcr { nodeByPath(path: "/sites/mySite") { name } } }' }));
```

---

## Authentication and authorization

The GraphQL endpoint is **closed by default** to external callers. Access is granted through the security filter module.

**For a scoped token (recommended):**

1. Create a scope config in `digital-factory-data/karaf/etc/org.jahia.bundles.api.authorization-myapp.yml`:

```yaml
myapp:
  description: Access for myapp
  grants:
    - api: graphql
      node:
        pathPattern: /,/sites/mysite(/.*)?
        nodeType: jnt:news,jnt:contentFolder
```

2. Pass a personal API token in the `Authorization` header:

```
Authorization: APIToken <token>
```

**For same-origin browser requests**, auto-apply the scope:

```yaml
myapp:
  auto_apply:
    - origin: hosted
  grants:
    - api: graphql
```

**Field-level permission checks** can be added in `org.jahia.modules.graphql.provider-*.cfg`:

```properties
# Restrict nodesByQuery to users with graphQLNodesByQueryPermission on root
permission.JCRQuery.nodesByQuery=graphQLNodesByQueryPermission
# Restrict to a specific node path
permission.JCRQuery.nodesByQuery=graphQLNodesByQueryPermission/sites/mySite/content
```

Or in Java using the annotation `@GraphQLRequiresPermission("<permission>")`.

The JCR session is derived from the HTTP session, so standard Jahia node permissions apply automatically.

---

## Workspaces and internationalization

Every JCR query or mutation must be wrapped in a `jcr` block specifying the workspace:

```graphql
{
  jcr(workspace: LIVE) {   # LIVE or EDIT (default is EDIT)
    nodeByPath(path: "/sites/digitall/home") {
      displayName(language: "en")
      displayName_fr: displayName(language: "fr")
    }
  }
}
```

Unlike the REST API, GraphQL has **no global locale** on the session — you pass `language:` per field. A query can retrieve English and French properties in the same call.

The `validInLanguage` parameter (graphql-dxm-provider 2.10.0+) filters out nodes that have no content in the specified language:

```graphql
jcr {
  nodeByPath(path: "/sites/digitall/home", validInLanguage: "fr") { name }
}
```

---

## JCR queries

### Top-level query fields

```graphql
extends type Query {
  jcr(workspace: Workspace): JCRQuery
}

type JCRQuery {
  nodeById(uuid: String!): JCRNode!
  nodeByPath(path: String!): JCRNode!
  nodesById(uuids: [String!]!): [JCRNode]!
  nodesByPath(paths: [String!]!): [JCRNode]!
  nodesByQuery(query: String!, queryLanguage: QueryLanguage = SQL2, ...connection args...): JCRNodeConnection
  nodesByCriteria(criteria: InputGqlJcrNodeCriteriaInput!, ...connection args...): JCRNodeConnection
}
```

### Get a node and its properties

```graphql
query highlight {
  jcr {
    nodeByPath(path: "/sites/digitall/home/area-main/highlights/our-companies") {
      title: property(language: "en", name: "jcr:title") { value }
      description: property(language: "en", name: "description") { value }
      internalLink: property(language: "en", name: "internalLink") { value }
    }
  }
}
```

### Get rendered HTML for a node

```graphql
query {
  jcr {
    nodeByPath(path: "/sites/digitall/home/area-main/highlights/our-companies") {
      renderedContent(
        view: "imgView"
        contextConfiguration: "module"
        templateType: "html"
        requestAttributes: [{name: "someAttribute", value: "someValue"}]
      ) { output }
    }
  }
}
```

### Get all properties

```graphql
query {
  jcr {
    nodeByPath(path: "/sites/digitall") {
      properties { name value values }
    }
  }
}
```

### Children filtered by type and property

```graphql
{
  jcr(workspace: LIVE) {
    nodeByPath(path: "/sites/digitall/home") {
      children(
        typesFilter: {types: ["jnt:page"]}
        propertiesFilter: {filters: [{property: "j:templateName", value: "home"}]}
      ) {
        nodes {
          name
          name_en: displayName(language: "en")
          createdBy: property(name: "jcr:createdBy") { value }
        }
      }
    }
  }
}
```

### Descendants with type filter (paginated)

```graphql
query paginatedContents {
  jcr {
    nodesByPath(paths: ["/sites/digitall/home"]) {
      descendants(
        first: 3
        after: "NTE3ZjE1YmMtZTViYS00YzVkLWIxNmUtMDhiMTgzYTkzMTli"
        typesFilter: {types: ["jmix:editorialContent"], multi: ANY}
        recursionTypesFilter: {multi: NONE, types: ["jnt:page", "jnt:contentFolder"]}
      ) {
        edges {
          index
          cursor
          node { displayName path primaryNodeType { displayName(language: "en") } }
        }
      }
    }
  }
}
```

### SQL2 query

```graphql
{
  jcr(workspace: LIVE) {
    nodesByQuery(query: "select * from [jnt:page]", offset: 2, limit: 10) {
      edges {
        index
        cursor
        node { displayName(language: "en") }
      }
    }
  }
}
```

### Structured criteria query (alternative to SQL2)

```graphql
query {
  jcr {
    nodesByCriteria(criteria: {
      nodeType: "jnt:bigText"
      paths: ["/sites/digitall/home"]
      nodeConstraint: { property: "text", contains: "test" }
    }) {
      nodes { uuid }
    }
  }
}
# Equivalent SQL2: SELECT * FROM [jnt:bigText] WHERE ISDESCENDANTNODE("/sites/digitall/home") AND text LIKE "%test%"
```

### Publication info

```graphql
extend type JCRNode {
  aggregatedPublicationInfo(language: String, includesReferences: Boolean, includesSubNodes: Boolean): PublicationInfo
  vanityURLs(languages: [String], onlyActive: Boolean, onlyDefault: Boolean): [VanityURL]
  lockInfo: LockInfo
}
```

### Count descendants

```graphql
query pagesCount {
  jcr {
    nodeByPath(path: "/sites/digitall") {
      descendants(typesFilter: {types: ["jnt:page"]}) {
        pageInfo { totalCount }
      }
    }
  }
}
```

---

## JCR mutations

Session save happens automatically at the end of each `mutation { jcr }` block. Use multiple `jcr` blocks for multiple save points.

### Rename and set property

```graphql
mutation mutationExample {
  jcr {
    mutateNode(pathOrId: "/sites/digitall/home/corporate-responsibility") {
      rename(name: "responsibility")
      mutateProperty(name: "j:published") {
        setValue(type: BOOLEAN, value: "false")
      }
    }
    modifiedNodes { path }
  }
}
```

### Add a node

```graphql
mutation {
  jcr(workspace: EDIT) {
    addNode(
      parentPathOrId: "/sites/mySite"
      name: "page"
      primaryNodeType: "jnt:page"
      properties: [
        {language: "en", name: "jcr:title", type: STRING, value: "Page"}
        {name: "j:templateName", type: STRING, value: "2col"}
      ]
    ) { uuid }
    modifiedNodes { uuid name }
  }
}
```

### Update a property

```graphql
mutation {
  jcr(workspace: EDIT) {
    mutateNode(pathOrId: "/sites/mySite/page") {
      mutateProperty(name: "j:templateName") {
        setValue(type: STRING, value: "3col")
      }
    }
  }
}
```

### Add a mixin

```graphql
mutation {
  jcr(workspace: EDIT) {
    mutateNode(pathOrId: "/sites/mySite/page") {
      addMixins(mixins: "jmix:tagged")
    }
  }
}
```

### Publish a node

```graphql
mutation publishContent {
  jcr {
    mutateNode(pathOrId: "/sites/digitall/home/about") { publish }
  }
}
```

### Delete a node

```graphql
mutation {
  jcr(workspace: EDIT) {
    mutateNode(pathOrId: "/sites/mySite/home") { delete }
  }
}
```

### Edit OSGi configuration via GraphQL

```graphql
mutation {
  admin {
    jahia {
      configuration(pid: "org.jahia.modules.automatedtags.service.impl.AutomatedTagServiceImpl") {
        accessKey: value(name: "automated-tags.accessKey", value: "xxxxxx")
        endpoint: value(name: "automated-tags.endpoint", value: "https://rekognition.eu-central-1.amazonaws.com")
      }
    }
  }
}
```

### JCRNodeMutation available operations

- `mutateProperty` / `mutateProperties` → `JCRPropertyMutation` (setValue, addValue, removeValue)
- `addChild` / `addChildrenBatch`
- `mutateChildren` / `mutateDescendants`
- `addMixins` / `removeMixins`
- `move` / `rename`
- `delete` / `markForDeletion` / `unmarkForDeletion`
- `reorderChildren`
- `setPropertiesBatch`
- `lock(type, recursive)` / `unlock(type, recursive, force)`
- `publish(languages)`

---

## Pagination (Connection pattern)

Jahia GraphQL follows the [Relay connection spec](https://facebook.github.io/relay/graphql/connections.htm). Any field returning `...Connection` type supports:

**Arguments**: `first`, `after`, `last`, `before`, `afterOffset`, `beforeOffset`

**PageInfo type**:

```graphql
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  nodesCount: Int        # items in current page
  totalCount: Int        # total items
}
```

**Connection and Edge template**:

```graphql
type XxxConnection {
  edges: [XxxEdge]
  pageInfo: PageInfo
  nodes: [Xxx]           # shortcut for edges { node }
}
type XxxEdge {
  node: Xxx
  cursor: String
  offset: Int
}
```

**Important**: `nodesCount` is items in the current page; `totalCount` is the full count. The `nodes` shortcut is non-standard but available on all Jahia connections.

---

## Field filtering and sorting

Fields returning Connection or lists accept `fieldFilter` and `fieldSorter`:

```graphql
nodesByQuery(
  query: "SELECT * FROM [jnt:page]"
  fieldFilter: {filters: {evaluation: NOT_EMPTY, fieldName: "node.vanityUrls"}}
  fieldSorter: {fieldName: "displayName", sortType: ASC}
) { ... }
```

---

## Extending the schema — SDL

Place your SDL file at:

```
/<module_home>/src/main/resources/META-INF/graphql-extension.sdl
```

The filename must be exactly `graphql-extension.sdl`.

### SDL example — mapping JCR node types

```graphql
extend type Query {
  allHotel: [hotel]
  hotelByCity: [hotel]
  hotelByCityConnection: hotelConnection
}

type hotel @mapping(node: "jnt:hotel") {
  name: String! @mapping(property: "jcr:title")
  city: String @mapping(property: "city")
  address: String @mapping(property: "address")
  country: String @mapping(property: "country")
  metadata: Metadata          # built-in Jahia composite type
  rooms: [Room]
}

type Room @mapping(node: "jnt:room") {
  number: Int! @mapping(property: "roomNo")
  specification: String @mapping(property: "description")
  available: Boolean @mapping(property: "available")
}
```

**Directives**:
- `@mapping(node: "jnt:hotel")` on a type — maps to a JCR node type
- `@mapping(property: "jcr:title")` on a field — maps to a JCR property

**Common mistakes**:
- Extending a type that doesn't exist (`extend type ParagraphSDL { ... }`) → error
- Mapping to an invalid node type or property → error shown in SDL Report Tool
- `hotelByPropertyConnection` returning a non-list → connection error
- All custom queries **must** use `extend type Query { ... }` not `type Query`

**Built-in Jahia composite types** (no `@mapping` needed):
- `Metadata` → `{created, createdBy, lastModified, lastModifiedBy, lastPublished, lastPublishedBy}`
- `Asset` → `{type, size, metadata}`
- `ImageAsset` → `{type, size, height, width, metadata}`
- `Category` → `{title, metadata, description}`

**Auto-generated queries**: For each SDL type, Jahia generates `typeById` and `typeByPath` automatically. Explicitly declare only `ByProperty` queries.

**Validation**: Check deployment status at **Developer Tools → SDL Report Tool**. Errors appear in red per type or per module.

---

## Extending the schema — Java

Implement `DXGraphQLExtensionsProvider` to return annotated Java classes:

```java
// Extension class using graphql-java-annotations
@GraphQLName("JCRNodeExtensions")
public class JCRNodeExtensions implements GqlJcrNode {

    @GraphQLRequiresPermission("developer-tools-access")
    @GraphQLField
    public String myCustomField(@GraphQLName("arg") String arg) {
        return "result";
    }
}
```

Reference implementation: https://github.com/Jahia/graphql-core/tree/master/graphql-extension-example

---

## Apollo client setup

### Package installation

```bash
yarn add react-apollo apollo-cache-inmemory apollo-client apollo-link-http graphql
```

### Apollo client with personal API token (TypeScript)

```typescript
export const apolloClient = (token: string): ApolloClient<any> => {
  return new ApolloClient({
    link: new HttpLink({
      uri: `${JAHIA_URL}/modules/graphql`,
      headers: {
        authorization: `APIToken ${token}`
      }
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: 'no-cache' }
    }
  });
};
```

### Apollo client with JWT (legacy, deprecated)

```javascript
const client = new ApolloClient({
  link: new HttpLink({
    uri: 'http://localhost:8080/modules/graphql',
    headers: { 'Authorization': `Bearer ${JWTDXToken}` }
  }),
  cache: new InMemoryCache()
});
```

### Apollo query component example

```javascript
const COMPANIES_QUERY = gql`
  query CompaniesListQuery($language: String) {
    jcr(workspace: LIVE) {
      nodesByQuery(
        query: "SELECT * FROM [jdnt:company] as results WHERE ISDESCENDANTNODE(results, '/sites/digitall/')"
        queryLanguage: SQL2
      ) {
        nodes {
          uuid
          title: displayName(language: $language)
          description: property(name: "overview", language: $language) { value }
          thumbnail: property(name: "thumbnail", language: $language) {
            url: refNode { path }
          }
        }
      }
    }
  }
`;
```

---

## CORS and OSGi configuration

**CORS for GraphQL** — create `org.jahia.modules.graphql.provider-myapp.cfg` in `karaf/etc`:

```properties
http.cors.allow-origin=http://localhost:3000
```

Multiple origins: comma-separated list.

**Packaging config in a module** — add to `pom.xml`:

```xml
<plugin>
  <groupId>org.codehaus.mojo</groupId>
  <artifactId>build-helper-maven-plugin</artifactId>
  <executions>
    <execution>
      <id>attach-artifacts</id>
      <phase>package</phase>
      <goals><goal>attach-artifact</goal></goals>
      <configuration>
        <artifacts>
          <artifact>
            <file>src/main/resources/META-INF/configurations/org.jahia.modules.graphql.provider-custom.cfg</file>
            <type>cfg</type>
            <classifier>graphql-cfg</classifier>
          </artifact>
        </artifacts>
      </configuration>
    </execution>
  </executions>
</plugin>
```

The default config is at `/digital-factory-data/karaf/etc/org.jahia.modules.graphql.provider-default.cfg`.

---

## GraphQL playground

Access via **Developer Tools → GraphQL** in the Jahia admin UI, or directly:

```
http://localhost:8080/jahia/developerTools/graphql-workspace
```

Also accessible as Jahia Support Tools: `http://localhost:8080/tools` → **Jahia GraphQL Core Provider: graphql-playground**

Use the **Docs** panel to browse the schema, including custom SDL types.

---

## Introspection access control

Starting with GraphQL Provider 3.5.0, introspection can be restricted to users with `Developer tools access` permission:

```properties
# In org.jahia.modules.graphql.provider-*.cfg
introspectionCheckEnabled=true
```

When enabled, only authenticated users with the `Developer tools access` server-level permission can run introspection queries. Requires jContent 3.5.0+ when enabled to prevent UI issues.
