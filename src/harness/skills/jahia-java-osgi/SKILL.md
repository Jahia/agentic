---
name: jahia-java-osgi
description: OSGi component patterns for Jahia Java development — correct usage of @Component lifecycle, @Reference, Export-Package, whiteboard services, and thread safety. Covers both the right approach and the pitfalls that cause NPEs, stale state, or leaked internals. Load when implementing or reviewing any class annotated with @Component, @Reference, or @Activate.
allowed-tools: Read
---

# OSGi Component Patterns for Jahia Java

This skill covers how to write OSGi components correctly in a Jahia Java module. Each section states the correct approach first, then the pitfall to avoid. Both developers and reviewers use this skill.

For broader Java concurrency patterns (atomic variables, locking, thread-safe collections, `ThreadLocal`, JCR session threading) that apply beyond OSGi components, load `/jahia-java-concurrency`.

For a comprehensive OSGi reference (bundle lifecycle, Blueprint XML, Karaf tooling, service registry), load the `jahia-dev-java` skill and read `references/osgi.md`.

---

## Component state and configuration reload

### Correct approach

`@Component` services are singletons. Configuration is delivered via `@Activate` (on first start) and `@Modified` (on config change). `@Modified` runs on a different thread than service consumers.

The safe pattern for config reload:

```java
private volatile Config config;

record Config(String host, int port) {}

@Activate @Modified
public void activate(MyOsgiConfig cfg) {
    this.config = new Config(cfg.host(), cfg.port());
}

public void doWork() {
    var c = this.config; // snapshot once — atomic read
    // use c.host(), c.port() ...
}
```

A single `volatile` write (the reference swap) is atomically visible to all readers. Readers snapshot the reference once at method entry and work with the snapshot — they never see a half-updated config.

### Pitfalls

- **Mutable fields updated in `@Activate`/`@Modified` without `volatile` or synchronization.** A consumer thread can read a field while `@Modified` is updating it — data race. P1 finding.
- **Multiple fields updated individually without synchronization.** Even with `volatile`, two separate field reads can see values from different config snapshots. Use a single `volatile Config` record, not individual `volatile String host; volatile int port`.

---

## Service references

### Correct approach

- `@Reference` fields are set by SCR before `@Activate`. Treat them as effectively final inside the component's methods.
- For **mandatory** references (`cardinality = MANDATORY`), the component will not activate if the service is absent — null checks are not needed.
- For **optional** references (`cardinality = OPTIONAL`), the field can be `null` — always guard.
- For **dynamic** references (`policy = ReferencePolicy.DYNAMIC`), the field can be replaced at runtime. Snapshot it at method entry: `var svc = this.myService;` then use `svc`. Reading the field twice risks NPE if the service is unregistered between reads.

### Pitfalls

- **Non-mandatory `@Reference` accessed without null guard.** P1 — NPE in production when the referenced bundle is not deployed.
- **Dynamic reference read twice without snapshot.** Between two reads the SCR may set the field to `null`. P1.
- **`policyOption = GREEDY`.** SCR rebinds to a higher-ranked service when one appears. Code holding a reference to the old service instance keeps using a deactivated service. Document this if intentional.

---

## Lifecycle side effects

### Correct approach

Every side effect created in `@Activate` must be undone in `@Deactivate`. Components can be deactivated and re-activated on config changes (depending on `@Modified` policy). Failing to undo side effects causes them to accumulate across activations.

Checklist:
- Thread started in `@Activate` → stopped in `@Deactivate` (interrupt + join).
- JCR event listener registered → unregistered.
- Scheduled task registered → cancelled.
- External connection opened → closed.
- Cache populated → cleared or reseeded.

### Pitfall

A listener registered in `@Activate` but never unregistered in `@Deactivate` survives deactivation, fires events for a component that is no longer active, and duplicates on next activation. P1.

---

## Export-Package hygiene

### Correct approach

`Export-Package` in `pom.xml` defines what other bundles can import. It is the module's public API contract.

- Export only interfaces and types in a dedicated `api` or `spi` sub-package.
- Never export `*.impl`, `*.internal`, `*.actions` — the name signals private scope.
- Never re-export third-party packages.
- If the module advertises an SPI for external consumers, the SPI should live in a **separate Maven module** (`{name}-api`). Changing the runtime JAR then does not force a version bump on the API.

### Pitfall

Exporting implementation packages means any other bundle can import your internal classes. A refactor that renames or removes an internal class becomes a breaking change for dependent bundles. P1.

---

## Whiteboard pattern services

Services registered as `@Component` — `Servlet`, `Filter`, `EventHandler`, GraphQL provider — are activated the moment the bundle starts. If the service is reachable over HTTP, it is as exposed as a `web.xml` servlet, with no extra protection by default. Apply the security mapping from `jahia-java-security` for every HTTP-reachable whiteboard service.

---

## Service locator anti-pattern

### Correct approach

Declare all dependencies as `@Reference` fields. SCR injects them before `@Activate`. The component's constructor or `@Activate` method has all dependencies available without any lookup.

### Pitfall

```java
// anti-pattern — service locator inside a method
MyService svc = (MyService) SpringContextSingleton.getBean("myService");
```

Service locator calls inside methods: hide the component's real dependencies, make the code impossible to unit-test, bypass SCR lifecycle guarantees, and can return stale or wrong beans after a context refresh. P2 in general code; P1 in a hot path or security-relevant method.

---

## Thread safety summary for reviewers

When reviewing an `@Component` service, ask:

1. Are there mutable instance fields? If yes — are they `volatile` or synchronized?
2. Does the component react to `@Modified`? If yes — do consumers snapshot config at method entry?
3. Are there `DYNAMIC` references? If yes — do callers snapshot the reference?
4. Does the component start threads, register listeners, or open connections? If yes — does `@Deactivate` undo all of them?
5. Does the component's Javadoc state its thread-safety contract? If the service is not internally safe, the caller must be told what external serialization is required.
