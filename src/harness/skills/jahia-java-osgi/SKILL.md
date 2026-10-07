---
name: jahia-java-osgi
description: OSGi Declarative Services in a Jahia Java module — @Component, @Reference, @Activate, @Modified, @Deactivate, typed configuration with @ObjectClassDefinition, the .cfg file of a configuration, Export-Package, and how to find why a component does nothing. Gives the correct pattern first, then the pitfalls that cause a missing service, a NullPointerException, stale configuration or leaked threads. Load when you write, review or debug any class annotated with @Component.
allowed-tools: Read
---

# OSGi components in a Jahia Java module

Declarative Services (DS) is the dependency injection of a Jahia module. The annotations come from
`org.osgi.service.component.annotations`. Do not start a Spring context and do not write a
`BundleActivator`.

The build turns the annotations into component descriptors only when the `maven-bundle-plugin`
has `<_dsannotations>*</_dsannotations>`. Without it, the classes compile and nothing registers.

## A component

```java
@Component(service = QuoteService.class, immediate = true, configurationPid = "org.example.quote")
public class QuoteServiceImpl implements QuoteService {

    @Reference
    private JahiaSitesService sitesService;           // mandatory: the component waits for it

    private volatile Settings settings = Settings.DEFAULTS;

    @Activate
    @Modified
    public void apply(Map<String, Object> config) {
        settings = Settings.from(config);              // one write: readers see old or new, never a mix
    }

    @Deactivate
    public void deactivate() {
        // stop what apply() or the methods started: threads, listeners, connections
    }

    @Override
    public Quote quote(String product) {
        Settings s = settings;                         // read once per call
        return new Quote(product, s.basePrice(product));
    }
}
```

- **`service`** names the type that other code looks up. Jahia finds an Action, a render filter or
  a choicelist initializer by its type, so `service = Action.class` is required for an Action.
- **`immediate = true`** creates the component when the bundle starts. Without it, DS creates a
  component that has a `service` only when somebody looks it up. Use it for a servlet, a listener,
  and any component that does work in `@Activate`.
- **Components are singletons.** All requests share one instance. Keep the request state in local
  variables, never in fields.
- **One method for `@Activate` and `@Modified`.** DS calls `@Activate` once, and `@Modified` on
  every change of the configuration, on another thread. Build one immutable object (a record) and
  assign it to one `volatile` field. Several `volatile` fields updated one by one can be read in a
  mixed state.
- **`@Activate` must not throw.** A throwing `@Activate` disables the component, and nothing else
  tells you. Use defaults for a missing or bad value, and log a warning.
- **`@Deactivate` undoes `@Activate`.** A thread, a scheduled task, a JCR listener or a connection
  that survives deactivation runs twice after the next activation.

## References

| Need | Annotation |
| --- | --- |
| A service that must be there | `@Reference private X x;` (the component does not start without it) |
| A service that may be absent | `@Reference(cardinality = ReferenceCardinality.OPTIONAL)`, then check for `null` at each use |
| Every service of a type, as they come and go | `@Reference(cardinality = MULTIPLE, policy = DYNAMIC)` on a `bind`/`unbind` pair that updates a thread-safe collection |
| One instance among several | `@Reference(target = "(service.pid=org.example.custom)")` |

With `policy = DYNAMIC`, DS can replace or clear the field while a request runs. Copy it to a local
variable once, then use the local variable.

`@Reference` is for services. A configuration value comes from the configuration, below.

Common Jahia services: `JCRSessionFactory`, `JCRPublicationService`, `JahiaSitesService`,
`JahiaUserManagerService`, `JahiaGroupManagerService`, `JahiaTemplateManagerService`,
`RenderService`, `CacheService`.

## Configuration

`configurationPid` connects the component to one configuration. Its file is
`digital-factory-data/karaf/etc/<pid>.cfg`. Jahia also copies a default file from
`src/main/resources/META-INF/configurations/<pid>.cfg` on deployment.

### A `Map`

`apply(Map<String, Object> config)` receives every key of the file. The values of a `.cfg` file are
strings: parse them, with a default for a missing or bad value.

### A typed configuration

```java
@ObjectClassDefinition(name = "Quote service")
public @interface Config {
    @AttributeDefinition(name = "Car base price") double car_price() default 45;
    @AttributeDefinition(name = "API key", type = AttributeType.PASSWORD) String api_key() default "";
}

@Component(service = QuoteService.class, configurationPid = "org.example.quote")
@Designate(ocd = QuoteServiceImpl.Config.class)
public class QuoteServiceImpl implements QuoteService {
    @Activate @Modified
    public void apply(Config config) { /* config.car_price(), config.api_key() */ }
}
```

- An underscore in a method name is a dot in the file: `car_price()` reads `car.price`.
- The annotations come from `org.osgi.service.metatype.annotations`. Jahia shows the form in the
  OSGi configuration screen of the administration.
- `PASSWORD` hides the value in the screen only. The file keeps it in clear text: never log it and
  never commit a real value.

### Pitfalls

- **`configurationPolicy = ConfigurationPolicy.REQUIRE`**: the component does not exist until a
  `.cfg` file exists. Keep the default (`OPTIONAL`) unless that is the intent.
- **A file name that differs from the pid**: DS never sees the file. Nothing reports the mismatch.
- **Two `@Activate` methods, or an overloaded one**: DS may pick the wrong one, and the
  configuration stops arriving.

## Export-Package

A Jahia module exports nothing unless you ask. Export a package only when another module uses it:

- Put the shared interfaces in a package of their own (`org.example.quote.api`), and export only
  that one: `<export-package>org.example.quote.api</export-package>` in the POM properties.
- Never export an implementation package. Another module that imports it breaks at your next
  refactoring.
- A module that uses your API declares your module in `<jahia-depends>`, so Jahia starts yours first.

## HTTP endpoints

A component that serves HTTP is reachable as soon as the bundle starts:

- An Action (`service = Action.class`) answers `<node URL>.<name>.do`. `jahia-dev-java` covers it.
- A servlet uses the HTTP whiteboard:
  `@Component(service = {HttpServlet.class, Servlet.class}, property = {"alias=/my-endpoint"})`. It
  answers `/modules/my-endpoint`.

Apply `jahia-java-security` to each of them before you deploy.

## The service locator

`SpringContextSingleton.getBean("…")` inside a method hides a dependency and breaks unit tests. Use
`@Reference`. Keep `getBean` for a core bean that has no OSGi service, check the result for `null`,
and never call it on every request.

## A component that does nothing

Open the Karaf console (`ssh -p 8101 jahia@localhost`, or **Administration > Server > OSGi console**) and run:

| Command | Answer | Meaning |
| --- | --- | --- |
| `scr:list` | the component is absent | `_dsannotations` is missing, or the bundle is not `ACTIVE`. |
| `scr:list` | `UNSATISFIED REFERENCE` | A mandatory `@Reference` has no service. `scr:info <name>` names it. |
| `scr:list` | `UNSATISFIED CONFIGURATION` | `configurationPolicy = REQUIRE` and no `.cfg` file. |
| `scr:list` | `FAILED ACTIVATION` | `@Activate` threw. The exception is in the Jahia log. |
| `bundle:diag <id>` | missing requirement | An `Import-Package` that no bundle exports. |

## Review checklist

1. Does the component hold mutable fields? Are they `volatile`, or behind a lock?
2. Does `@Modified` update several fields that a reader uses together? Use one immutable object.
3. Is a `DYNAMIC` or `OPTIONAL` reference read more than once per call, or without a `null` check?
4. Does `@Deactivate` stop every thread, listener and connection that the component started?
5. Does `@Activate` throw on a bad configuration?
6. Does `Export-Package` list only API packages?
