---
name: jahia-dev-java
description: Writes a Jahia Java module (an OSGi bundle built with Maven) that adds server-side behaviour a JavaScript module cannot provide. The main case is an HTTP endpoint on a content node, `<node URL>.<name>.do`, built as an `org.jahia.bin.Action`. Covers when Java is the right choice, the pom.xml, the Action from registration to a JSON response, OSGi configuration, outbound HTTP, unit tests, the CSRF guard when a browser calls the endpoint, and the errors you see when an action does not answer. Use when asked to create a Java module, a `.do` action, a JSON endpoint called from a page, or the Java part that a migrated JSP module still needs.
argument-hint: "[what the module must do]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Write a Jahia Java module

A Jahia Java module is an OSGi bundle. It is a Maven project with `<packaging>bundle</packaging>`
whose parent POM is `org.jahia.modules:jahia-modules`. The parent generates the manifest. Your POM
adds only what the module needs.

Load the other Java skills when the work reaches their subject:

| Subject | Skill |
| --- | --- |
| `@Component`, `@Reference`, `@Activate`, OSGi configuration | `jahia-java-osgi` |
| Reading or writing JCR content from Java | `jahia-java-jcr` |
| Who may call the endpoint: guests, permissions, CSRF guard, GraphQL | `jahia-java-security` |
| Build, deploy, bundle state, a module that does not start | `jahia-dev-run-module` |
| Review of a finished module | `jahia-review-java` |

## 1. Decide if the work needs Java

Write a JavaScript module when you only render content. Write Java only for what runs on the server
outside a render:

- an endpoint that a page calls from the browser (an Action, this skill);
- a call to an external API with a secret, a cache or a timeout;
- an OSGi service that other modules use;
- a render filter, a choicelist initializer, a JCR event listener or a GraphQL extension.

A JavaScript module and a Java module can work together. The JavaScript module renders the page,
and a client component (`.client.tsx`) calls the Java action with `fetch`.

## 2. The project

```
my-module/
  pom.xml
  src/main/java/org/example/mymodule/   one package, private to the bundle
  src/main/resources/META-INF/configurations/   optional OSGi .cfg files, see section 5
  src/test/java/org/example/mymodule/   JUnit 5 tests
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.jahia.modules</groupId>
    <artifactId>jahia-modules</artifactId>
    <version>8.2.1.0</version> <!-- the oldest Jahia the module supports -->
  </parent>
  <groupId>org.example</groupId>
  <artifactId>my-module</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>bundle</packaging>
  <name>My Module</name>

  <properties>
    <jahia-depends>default</jahia-depends>
    <jahia-module-type>module</jahia-module-type>
    <maven.compiler.release>17</maven.compiler.release>
  </properties>

  <repositories>
    <repository>
      <id>jahia-public</id>
      <url>https://devtools.jahia.com/nexus/content/groups/public</url>
    </repository>
  </repositories>
  <pluginRepositories>
    <pluginRepository>
      <id>jahia-public</id>
      <url>https://devtools.jahia.com/nexus/content/groups/public</url>
    </pluginRepository>
  </pluginRepositories>

  <dependencies>
    <!-- org.json: Jahia core exports it, so it is provided, never embedded -->
    <dependency>
      <groupId>org.json</groupId>
      <artifactId>json</artifactId>
      <version>20231013</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.10.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.felix</groupId>
        <artifactId>maven-bundle-plugin</artifactId>
        <extensions>true</extensions>
        <configuration>
          <instructions>
            <_dsannotations>*</_dsannotations>
            <!-- core exports an older org.json than the one we compile against -->
            <Import-Package>org.json;version="[20180813,30000000)",*</Import-Package>
          </instructions>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

Rules that a build does not check:

- **The parent version is the oldest Jahia the module supports.** It becomes the
  `Jahia-Required-Version` of the bundle. Use `8.2.1.0` for a module that must run on any Jahia
  8.2: it runs on every later 8.2 release. Do not query the running Jahia for its version.

- **The parent brings the Jahia API.** `jahia-impl`, the servlet API, the OSGi annotations and
  SLF4J arrive `provided` from the parent. Do not declare them again.
- **`<_dsannotations>*</_dsannotations>` is required.** Without it the classes compile, but no
  `@Component` is registered, and every action answers 404.
- **A dependency that Jahia already exports is `provided`.** A `compile` dependency is embedded in
  the JAR. Embed only a library that Jahia does not export.
- **Pin an import range when the build imports a version that Jahia does not export.** With
  `org.json` 20231013 on the classpath, BND imports `org.json;version="[20231013,…)"`, and the
  bundle stays `INSTALLED` with `Unresolved requirement: Import-Package: org.json`. The
  `Import-Package` line above fixes it. Apply the same fix to any package listed in that error.
- **Java 17 works on Jahia 8.2.** Records, `var`, switch expressions and `java.net.http.HttpClient`
  are available.

## 3. Write an Action

An Action answers `<node URL>.<name>.do`, for example `/sites/mysite/home.quote.do`. Jahia resolves
the node, checks the requirements of the action, then calls `doExecute` with that node.

```java
package org.example.mymodule;

import org.jahia.bin.Action;
import org.jahia.bin.ActionResult;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.render.RenderContext;
import org.jahia.services.render.Resource;
import org.jahia.services.render.URLResolver;
import org.json.JSONObject;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Modified;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;

/** {@code GET <node URL>.greeting.do?name=Ada}: a JSON greeting. Open to guests. */
@Component(service = Action.class, configurationPid = "org.example.mymodule")
public class GreetingAction extends Action {

    private volatile String salutation = "Hello";

    @Activate
    @Modified
    public void activate(Map<String, Object> config) {
        setName("greeting");
        setRequireAuthenticatedUser(false);
        setRequiredMethods("GET");
        salutation = String.valueOf(config.getOrDefault("salutation", "Hello"));
    }

    @Override
    public ActionResult doExecute(HttpServletRequest req, RenderContext renderContext, Resource resource,
                                  JCRSessionWrapper session, Map<String, List<String>> parameters,
                                  URLResolver urlResolver) throws Exception {
        HttpServletResponse resp = renderContext.getResponse();
        String name = getParameter(parameters, "name");
        if (name == null || name.isBlank()) {
            return send(resp, 400, new JSONObject().put("error", "missing-name"));
        }
        JCRNodeWrapper node = resource.getNode();
        return send(resp, 200, new JSONObject()
                .put("greeting", salutation + ", " + name)
                .put("page", node.getDisplayableName()));
    }

    /** Writes the JSON body and returns null, so Jahia neither redirects nor renders anything. */
    private static ActionResult send(HttpServletResponse resp, int status, JSONObject body) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write(body.toString());
        return null;
    }
}
```

What each part does, and what goes wrong without it:

| Part | Why |
| --- | --- |
| `@Component(service = Action.class)` | Jahia finds actions as OSGi services of type `Action`. Without `service`, the action is not registered. |
| `setName("greeting")` in `@Activate` | The name is the `.greeting.do` part of the URL. An action has no name until you set it. |
| `setRequireAuthenticatedUser(false)` | The default is `true`: a guest gets an `AccessDeniedException`, so Jahia sends the login page or a 401. |
| `setRequiredMethods("GET")` | The default is `POST` only. A `GET` to a default action fails. Several methods: `"GET,POST"`. |
| `setRequiredPermission("jcr:write")` | Optional. Jahia checks the permission on the node before `doExecute`. |
| `setRequiredWorkspace("live")` | Optional. The action then answers only in that workspace. |

### What `doExecute` returns

Jahia reads the returned `ActionResult` like this (`org.jahia.bin.Render`):

| Return value | What the client gets |
| --- | --- |
| `null` | Only what you wrote to the response. Use this for a JSON API. |
| `new ActionResult(200, null, json)` | The JSON, **only** if the request has `Accept: application/json` or the parameter `returnContentType=json`. Otherwise a redirect to the node. |
| `ActionResult.OK` | A redirect to the node (`302`). |
| A code ≥ 300 without the JSON condition above | `sendError(code)`: the HTML error page of Jahia, not your JSON. |

Write the response yourself and return `null` (the `send` helper above). The answer is then the
same for `curl`, `fetch` and a browser, whatever their `Accept` header is.

Read parameters with the helpers of `Action`: `getParameter(parameters, "x")`,
`getParameter(parameters, "x", "default")`, or `getRequiredParameter(parameters, "x")`, which
throws when the parameter is absent. Validate every parameter. Answer `400` with a JSON error for a
bad value. Do not let an exception escape, because Jahia then logs an error and sends an HTML
`500` page.

### Keep the logic out of the Action

Put the computation in a plain class with no Jahia type (a calculator, a client, a cache), and keep
the Action as a thin adapter: read the node and the parameters, call the class, write the JSON.
The plain class is what the unit tests cover (section 7).

## 4. Call the action from a page

From a client component of a JavaScript module:

```tsx
const response = await fetch(`${nodeUrl}.greeting.do?name=${encodeURIComponent(name)}`, {
  credentials: "omit",
});
```

Build `nodeUrl` on the server with `buildNodeUrl(node)` and pass it to the client component as a
prop. The CSRF guard of Jahia checks every `.do` request of a **logged-in** user. A request without
the CSRF token fails, and the browser console shows
`[CsrfGuard] - potential cross-site request forgery (CSRF) attack thwarted`. Guests are not
checked. Choose one fix:

- **A read-only action:** whitelist it in the module. Create
  `src/main/resources/META-INF/configurations/org.jahia.modules.jahiacsrfguard-<artifactId>.cfg`:
  ```
  whitelist = *.greeting.do
  ```
- **A read-only action open to guests:** call it with `credentials: "omit"`. The request is then a
  guest request, so a logged-in editor also gets the guest answer.
- **An action that changes content:** never whitelist it. Keep `POST`, keep the CSRF guard, and
  call it from a page where the guard injects its token. `jahia-java-security` explains the rules.

## 5. OSGi configuration

`configurationPid = "org.example.mymodule"` connects the component to the configuration
`org.example.mymodule`. An administrator sets it in `digital-factory-data/karaf/etc/org.example.mymodule.cfg`:

```
salutation = Welcome
```

- Without a `.cfg` file, the component starts with an empty configuration, and `getOrDefault`
  returns your defaults. Do not use `configurationPolicy = REQUIRE` unless the module must not
  start without a configuration.
- `@Modified` on the same method applies a change without a restart of the component. Build all
  the values into one immutable object (a record), and assign it to one `volatile` field. Several
  `volatile` fields assigned one by one can be read half updated by a concurrent request.
- Values arrive as strings from a `.cfg` file. Parse them:
  `Long.parseLong(String.valueOf(config.getOrDefault("ttlSeconds", 600)))`.
- To ship a default file with the module, put it in `src/main/resources/META-INF/configurations/`.
  Jahia copies it to `karaf/etc` on deployment.
- Never put a secret in a file of the repository. Read it from the configuration.

Typed configuration with `@ObjectClassDefinition`, and the pitfalls, are in `jahia-java-osgi`.

## 6. Outbound HTTP

Use `java.net.http.HttpClient`, with both timeouts. A call without a timeout can block a request
thread of Jahia for minutes.

```java
private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5)).GET().build();
HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
if (response.statusCode() != 200) {
    throw new IOException("Upstream answered HTTP " + response.statusCode());
}
```

- Answer `503` with a JSON error when the upstream fails. Do not cache a failure.
- A cache shared by all requests is a `ConcurrentHashMap` keyed by the node identifier, with an
  expiry time per entry. Do not hold a lock during a network call.
- Build the URL with `String.format(Locale.ROOT, …)` for numbers, so that a French locale does not
  write `48,85`.

## 7. Unit tests

`mvn package` runs the JUnit 5 tests in `src/test/java`. Test the plain classes: the computation,
the parsing, the cache with an injected `java.time.Clock`. The Action itself needs a running Jahia.
Test it with HTTP calls after deployment (section 8).

## 8. Build, deploy, verify

`jahia-dev-run-module` has the full procedure. The short version, with JDK 17 and Maven:

```bash
mvn clean package
curl -s -u root:root1234 -X POST -F bundle=@target/my-module-1.0.0-SNAPSHOT.jar -F start=true \
  http://localhost:8080/modules/api/bundles
```

Then check every behaviour, as a guest, with the exact URL a page will use:

```bash
curl -s -i 'http://localhost:8080/sites/mysite/home.greeting.do?name=Ada'    # 200, JSON
curl -s -i 'http://localhost:8080/sites/mysite/home.greeting.do'             # 400, JSON error
curl -s -i -X POST 'http://localhost:8080/sites/mysite/home.greeting.do?name=Ada'  # refused
```

A guest reads only published content. Call the action on a published node. `/sites/systemsite/home`
exists, and guests can read it, on every Jahia.

After a change, build and post the JAR again. The same version replaces the bundle.

## 9. When the action does not answer

| Symptom | Cause | Fix |
| --- | --- | --- |
| `404` HTML page for `<node>.<name>.do` | The action is not registered: bundle not `ACTIVE`, `_dsannotations` missing, `service = Action.class` missing, or the name differs from `setName`. | Check the bundle state (`jahia-dev-run-module`), then the POM and the annotation. |
| `404` HTML page, and the action is registered | The node does not exist in that workspace, or the user cannot read it. A guest reads `live` only. | Publish the node, or call the action on another node. |
| `401` for a guest | `requireAuthenticatedUser` is still `true`, or the method is not a required method. Jahia answers a guest `401` for both. | `setRequireAuthenticatedUser(false)` and `setRequiredMethods("GET")` in `@Activate`. |
| `405` for a logged-in user | The method is not a required method. The default is `POST` only. | `setRequiredMethods("GET")`, or `"GET,POST"`. |
| `302` for a logged-in user, `200` for a guest | The CSRF guard refused the request. | Section 4. |
| `302` redirect instead of JSON | `doExecute` returned an `ActionResult`, and the request has no `Accept: application/json`. | Write the response and return `null`. |
| HTML error page instead of your JSON error | A code ≥ 300 in the `ActionResult`, or an exception. | Write the error JSON and return `null`. Catch the expected exceptions. |
| `CSRF attack thwarted` in the browser console | A logged-in user called the action without the CSRF token. | Section 4. |
| `[ERROR] Error resolving dependencies … (present, but unavailable)` during `mvn package`, then `BUILD SUCCESS` | A dependency scan of `jahia-maven-plugin` that reads the local Maven repository. | Nothing. The build passed. |
| Bundle `INSTALLED`, `Unresolved requirement: Import-Package: …` | An import that no bundle exports in that version. | Pin a range in `Import-Package` (section 2), or embed the library. |
| Bundle `ACTIVE`, the action still absent | `@Activate` threw. The component is disabled. | Read the exception in the Jahia log. Make `@Activate` tolerate a missing or bad configuration. |
