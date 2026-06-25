# Jahia JCR API Reference

## Table of contents
1. [JCR Java API — sessions](#jcr-java-api--sessions)
2. [CRUD operations](#crud-operations)
3. [Auto-splitting nodes](#auto-splitting-nodes)
4. [Property interceptors](#property-interceptors)
5. [RESTful JCR access](#restful-jcr-access)
6. [JAX-RS custom endpoints](#jax-rs-custom-endpoints)
7. [Actions (legacy)](#actions-legacy)

---

## JCR Java API — sessions

Everything in the JCR happens within a session, opened for **one user**, **one workspace** (`default`/`EDIT` or `live`/`LIVE`), and **one language**. Non-internationalized properties are readable without a language; i18n properties require the session language.

### Getting a session

**Inside an Action** — the session is passed as a parameter:

```java
public ActionResult doExecute(HttpServletRequest req, RenderContext renderContext,
    Resource resource, JCRSessionWrapper session,
    Map<String, List<String>> parameters, URLResolver urlResolver) throws Exception {
    // use session directly
}
```

**From a service** — use `JCRTemplate`:

```java
JCRTemplate.getInstance().doExecuteWithSystemSession(
    null,                       // user (null = system)
    Constants.EDIT_WORKSPACE,   // "default"
    Locale.ENGLISH,
    new JCRCallback<Object>() {
        public Object doInJCR(JCRSessionWrapper session) throws RepositoryException {
            // ... your code here
            return null;
        }
    }
);
```

Use `Constants.LIVE_WORKSPACE` (`"live"`) to operate on published content.

---

## CRUD operations

### Create a node

```java
JCRTemplate.getInstance().doExecuteWithSystemSession(null, Constants.EDIT_WORKSPACE, Locale.ENGLISH,
    new JCRCallback<Object>() {
        public Object doInJCR(JCRSessionWrapper session) throws RepositoryException {
            JCRNodeWrapper parent = session.getNode("/sites/mySite/contents/news");
            String nodeTitle = "My node";
            JCRNodeWrapper newNode = parent.addNode(nodeTitle, "jnt:news");
            newNode.setProperty("jcr:title", nodeTitle);
            newNode.setProperty("desc", "my node content");
            session.save();  // MUST save — changes are local until then
            return null;
        }
    }
);
```

Steps: open session → get parent → `parent.addNode(name, nodeType)` → set properties → `session.save()`.

### Read a node

```java
JCRNodeWrapper node = session.getNode("/sites/mySite/contents/news");
String title = node.getPropertyAsString("jcr:title");
```

### Update a property

```java
JCRNodeWrapper node = session.getNode("/sites/mySite/contents/news/my-article");
node.setProperty("jcr:title", "Updated title");
session.save();
```

### Delete a node

```java
JCRNodeWrapper node = session.getNode("/sites/mySite/contents/news/my-article");
node.remove();
session.save();
```

### Common pitfall

**Always call `session.save()`** before your callback returns. Unsaved changes exist only in the local session context and are lost when the session closes.

---

## Auto-splitting nodes

Auto-splitting avoids flat node collections becoming too large. Enable it by adding the `jmix:autoSplitFolders` mixin and specifying a split configuration.

### Split configuration syntax

Semicolon-separated levels; each level is comma-separated tokens:

```
<level1>;<level2>;<level3>
```

Token types:
- `constant,<name>` — fixed folder name
- `property,<propertyName>` — value of the given property (`jcr:creator`, `jcr:nodename`, etc.)
- `firstChars,<propertyName>,<count>` — first N characters of property value
- `substring,<propertyName>,<start>-<end>` — zero-based substring
- `date,<datePropertyName>,<SimpleDateFormat pattern>` — e.g. `date,jcr:created,yyyy`

### Example: split by author → year → month

```java
import org.jahia.services.content.JCRAutoSplitUtils;

JCRNodeWrapper filesNode = session.getNode("/shared/files");
JCRAutoSplitUtils.enableAutoSplitting(
    filesNode,
    "property,jcr:creator;date,jcr:created,yyyy;date,jcr:created,MM",
    "jnt:contentList"   // node type for split folders
);
```

Result: `/shared/files/sergiy/2020/07/report.pdf`

### Enable from business rules

```
rule "Auto-split user activities node on creation"
  salience 101
  when
    A new node "activities" is created
    The node has a parent
      - the parent has the type jnt:user
  then
    Enable auto-splitting for subnodes of the node into folders of type jnt:contentList
      using configuration "date,jcr:created,yyyy;date,jcr:created,MM"
end
```

---

## Property interceptors

Interceptors catch all `get` and `set` operations on JCR properties. They can transform or reject values. Use cases: text filtering/moderation, auto-tagging, URL rewriting.

### Implementation pattern

```java
@Component(immediate = true)
public class PostFilteringInterceptor extends BaseInterceptor {

    private JCRStoreService jcrStoreService;

    @Activate
    public void start() {
        setRequiredTypes(Collections.singleton("String"));   // only String properties
        setNodeTypes(Collections.singleton("jnt:post"));      // only on jnt:post nodes
        jcrStoreService.addInterceptor(this);
    }

    @Deactivate
    public void stop() {
        jcrStoreService.removeInterceptor(this);
    }

    @Reference
    public void setJcrStoreService(JCRStoreService jcrStoreService) {
        this.jcrStoreService = jcrStoreService;
    }

    @Override
    public Value beforeSetValue(JCRNodeWrapper node, String name,
                                ExtendedPropertyDefinition definition, Value originalValue)
            throws RepositoryException {
        String content = originalValue.getString();
        if (content == null || content.isEmpty()) return originalValue;
        String filtered = filter(content);
        return !filtered.equals(content)
            ? node.getSession().getValueFactory().createValue(filtered)
            : originalValue;
    }

    @Override
    public Value[] beforeSetValues(JCRNodeWrapper node, String name,
                                   ExtendedPropertyDefinition definition, Value[] originalValues)
            throws RepositoryException {
        Value[] result = new Value[originalValues.length];
        for (int i = 0; i < originalValues.length; i++) {
            result[i] = beforeSetValue(node, name, definition, originalValues[i]);
        }
        return result;
    }

    private String filter(String content) {
        // implement filtering logic
        return content;
    }
}
```

**Important**: Interceptors are disabled for unlocalized sessions. Declare as an OSGi `@Component(immediate=true)` and register/unregister via `JCRStoreService`.

---

## RESTful JCR access

> **Deprecated** — the REST API is deprecated and will be removed in a future version. Use the GraphQL API instead.

### Base context

```
/modules/api/jcr/v1/{workspace}/{language}/
```

All URIs use `<basecontext>` = `/modules/api/jcr/v1`.

### URI encoding rules

- `:` in property/node names → `__` (e.g., `jcr:uuid` → `jcr__uuid`)
- Same-name siblings index → `--N` suffix (e.g., second `bar` child → `bar--2`)

### Entry points

| Pattern | Description |
|---------|-------------|
| `/{workspace}/{lang}/nodes/{uuid}[/children\|mixins\|properties\|versions][/{name}]` | Access node by UUID |
| `/{workspace}/{lang}/paths{/absolute/path}` | Access node by path |
| `/{workspace}/{lang}/types/{type}` | List nodes by type (disabled by default) |
| `/{workspace}/{lang}/query` | JCR-SQL2 query endpoint (disabled by default) |
| `/{workspace}/{lang}/version` | API version info |

### Authentication

- Browser session: log in to Jahia, session is inherited
- Non-browser: `POST /cms/login?doLogin=true&restMode=true&username=X&password=Y&redirectActive=false` (cookie-based)
- HTTP Basic auth: `Authorization: Basic <base64(user:pass)>`
- Personal API token: `Authorization: APIToken <token>`

### HTTP operations

```
GET    <basecontext>/default/en/nodes/<uuid>                     → read node
GET    <basecontext>/default/en/nodes/<uuid>/children            → list children
GET    <basecontext>/default/en/nodes/<uuid>/properties          → list properties
PUT    <basecontext>/default/en/nodes/<uuid>/children/foo        → create/update child node
PUT    <basecontext>/default/en/nodes/<uuid>/properties/jcr__title → create/update property
DELETE <basecontext>/default/en/nodes/<uuid>                     → delete node
POST   <basecontext>/default/en/nodes/<uuid>/moveto/newName      → rename node
POST   <basecontext>/default/en/paths/users/root/files           → upload file (multipart)
```

### Example: create a child node

```
PUT /modules/api/jcr/v1/default/en/nodes/27d671f6.../children/foo
Content-Type: application/hal+json

{
  "type": "jnt:bigText",
  "properties": { "text": { "value": "FOO!" } }
}
```

### Example: add a mixin with properties

```
PUT /modules/api/jcr/v1/default/en/nodes/eae598a3.../mixins/jmix__rating
Content-Type: application/hal+json

{
  "properties": {
    "j__lastVote": {"value": "-1"},
    "j__nbOfVotes": {"value": "100"},
    "j__sumOfVotes": {"value": "1000"}
  }
}
```

### Batch delete properties

```
DELETE /modules/api/jcr/v1/default/en/nodes/eae598a3.../properties
Body: ["j__sumOfVotes", "j__nbOfVotes"]
```

### Security filter configuration for REST

```properties
# karaf/etc/org.jahia.bundles.api.authorization-myapi.yml
permission.myApiAccess.api=jcrestapi
permission.myApiAccess.nodeType=nt:myNodeType1,nt:myNodeType2
permission.myApiAccess.pathPattern=/sites/mysite/nodes/.*
# Optional: require a specific permission
permission.myApiAccess.requiredPermission=jcr:write
# Or require a token scope
permission.myApiAccess.scope=myApp
```

### Query endpoint (disabled by default)

Enable via `jahia.find.disabled=false` in `jahia.properties`. Supports prepared queries registered as Spring `PreparedQuery` beans.

```
POST /modules/api/jcr/v1/default/en/query
{
  "query": "SELECT * FROM [nt:base]",
  "limit": 10,
  "offset": 1
}
```

Or using a named prepared query:

```
POST /modules/api/jcr/v1/default/en/query
{
  "queryName": "foo",
  "namedParameters": { "nodeType": "nt:%" }
}
```

---

## JAX-RS custom endpoints

Jahia bundles Jersey (JAX-RS 2) with an OSGi extender pattern. Register your endpoint via `pom.xml` bundle directives:

```xml
<plugin>
  <groupId>org.apache.felix</groupId>
  <artifactId>maven-bundle-plugin</artifactId>
  <extensions>true</extensions>
  <configuration>
    <instructions>
      <Jahia-Depends>default,...</Jahia-Depends>
      <JAX-RS-Alias>/myendpoint</JAX-RS-Alias>
      <JAX-RS-Application>com.example.MyApplication</JAX-RS-Application>
    </instructions>
  </configuration>
</plugin>
```

Your endpoint will be accessible at `/modules/myendpoint/...`. Jahia authentication propagates automatically — the session credentials are available in the endpoint.

Your `Application` class should extend Jersey's `ResourceConfig`:

```java
@ApplicationPath("/")
public class MyApplication extends ResourceConfig {
    public MyApplication() {
        packages("com.example.resources");
    }
}
```

---

## Actions (legacy)

> **Deprecated** — Jahia recommends using GraphQL for new development. Actions are still usable for simple isolated operations.

Actions are triggered via `POST` to `/{nodePath}.{actionName}.do`.

### Minimal action implementation

```java
@Component(service = RateContent.class)
public class RateContent extends Action {

    @Activate
    public void activate() {
        setName("rate");
        // setRequireAuthenticatedUser(false);  // allow unauthenticated
        // setRequiredPermission("addBlogEntry");
        // setRequiredWorkspace("default");
    }

    @Override
    public ActionResult doExecute(HttpServletRequest req, RenderContext renderContext,
            Resource resource, JCRSessionWrapper session,
            Map<String, List<String>> parameters, URLResolver urlResolver) throws Exception {
        // ... business logic
        return new ActionResult(HttpServletResponse.SC_OK, null, responseJson);
    }
}
```

### URL pattern

```
POST /cms/render/{workspace}/{lang}/{node/path}.{actionName}.do
```

### Key action parameters (hidden form fields)

| Parameter | Purpose |
|-----------|---------|
| `jcrNodeType` | Type of node to create |
| `jcrRedirectTo` | Redirect URL after action |
| `jcrNewNodeOutputFormat` | Output format (default: `html`) |
| `jcrMethodToCall` | `post` (required for tokenized forms) |
| `jcrCaptcha` | Captcha response value |

### CSRF guard (Jahia 8.0.1+)

All actions from Jahia pages have CSRF protection automatically. Actions called from outside a Jahia context (external systems) will fail unless excluded. See the knowledge-base article on CSRF errors for how to exclude an action.

GET-based actions are blocked by default since 8.0.1. Allow explicitly:

```java
// In Spring XML: requiredMethods="GET,POST"
```

### Tokenized forms for live-workspace content creation

Wrap forms in `<template:tokenizedForm>` to allow guest users to submit content:

```jsp
<template:tokenizedForm>
  <form action="${url.base}${boundComponent.path}.addComment.do" method="post">
    <input type="hidden" name="jcrNodeType" value="jnt:post"/>
    <input type="hidden" name="jcrRedirectTo" value="${url.base}${renderContext.mainResource.node.path}"/>
    <!-- ... fields ... -->
  </form>
</template:tokenizedForm>
```

**Warning**: Tokenized forms execute with system user — they bypass all permission checks. Validate inputs inside the action itself.

### Chaining actions

```html
<form action="mynode.chain.do" method="post">
  <input type="hidden" name="chainOfAction" value="mail,redirect"/>
</form>
```

### File upload in actions

```java
final FileUpload fu = (FileUpload) req.getAttribute(FileUpload.FILEUPLOAD_ATTRIBUTE);
DiskFileItem inputFile = fu.getFileItems().get("fileField");
```

### BackgroundAction interface

Implement `BackgroundAction` to allow the action to be called from rules or GWT UI:

```java
public class SendAsNewsletterAction extends Action implements BackgroundAction {
    public void executeBackgroundAction(JCRNodeWrapper node) {
        // typically does a local POST to the action URL using a token
    }
}
```
