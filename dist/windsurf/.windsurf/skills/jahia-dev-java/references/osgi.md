# Jahia OSGi Reference

## Table of Contents
1. [OSGi fundamentals](#1-osgi-fundamentals)
2. [Jahia OSGi architecture](#2-jahia-osgi-architecture)
3. [Declarative Services (preferred)](#3-declarative-services-preferred)
4. [Blueprint XML (deprecated in 8.2)](#4-blueprint-xml-deprecated-in-82)
5. [Package imports and exports](#5-package-imports-and-exports)
6. [Embedding vs importing libraries](#6-embedding-vs-importing-libraries)
7. [Service export between modules](#7-service-export-between-modules)
8. [Available Jahia OSGi services](#8-available-jahia-osgi-services)
9. [Bundle lifecycle states](#9-bundle-lifecycle-states)

---

## 1. OSGi fundamentals

Each bundle:
- Has its own class loader (isolation)
- Declares what packages it imports (`Import-Package`)
- Declares what packages it exports (`Export-Package`)
- Registers services in a shared service registry
- Can be installed, started, updated, stopped, and uninstalled at runtime

---

## 2. Jahia OSGi architecture

```
Jahia Application (DX)
  └── Apache Karaf         (module management, clustering support, SSH shell)
        └── Apache Felix   (OSGi framework implementation)
              └── Tomcat   (servlet container)
```

---

## 3. Declarative Services (preferred)

Declarative Services (DS) is the **only recommended** way to register OSGi services in Jahia 8.2.

### Enable DS annotation scanning in pom.xml
```xml
<_dsannotations>*</_dsannotations>
```

### Component declaration

```java
@Component(service = {MyServiceInterface.class})
public class MyServiceImpl implements MyServiceInterface {

    @Activate
    public void activate(BundleContext context) { }

    @Deactivate
    public void deactivate() { }
}
```

### Referencing a single service

```java
@Reference
public void setDependency(MyDependency dep) { this.dep = dep; }

public void unsetDependency(MyDependency dep) { this.dep = null; }
```

### Referencing multiple services

```java
@Reference(cardinality = ReferenceCardinality.MULTIPLE,
           policy = ReferencePolicy.DYNAMIC,
           policyOption = ReferencePolicyOption.GREEDY)
public synchronized void addService(MyService service) { this.services.add(service); }

public synchronized void removeService(MyService service) { this.services.remove(service); }
```

### Component with configuration

```java
@Component(service = MyConfiguredService.class,
           configurationPid = "org.example.myservice",
           configurationPolicy = ConfigurationPolicy.OPTIONAL)
public class MyConfiguredService {

    @Activate
    public void activate(Map<String, Object> props) {
        String value = (String) props.getOrDefault("myProperty", "default");
    }

    @Modified
    public void modified(Map<String, Object> props) { }
}
```

Configuration file: `src/main/resources/META-INF/configurations/org.example.myservice.cfg`

---

## 4. Blueprint XML (deprecated in 8.2)

Do not use for new development. For legacy modules only. Files go in `OSGI-INF/blueprint/`.

---

## 5. Package imports and exports

### Manually adding imports

```xml
<jahia.modules.importPackage>org.jahia.defaults.config.spring,org.example.api</jahia.modules.importPackage>
```

Or in bundle plugin instructions:
```xml
<Import-Package>
  org.example.api,
  com.optional.pkg;resolution:=optional,
  *
</Import-Package>
```

### Exporting packages

```xml
<export-package>org.example.mymodule.api</export-package>
```

---

## 6. Embedding vs importing libraries

### Option 1: Embed as JAR inside module JAR (easiest)

```xml
<Embed-Dependency>*;scope=compile|runtime;type=!pom;inline=false</Embed-Dependency>
```

To exclude a dependency from embedding, use `<scope>provided</scope>`.

**Caution:** `Embed-Transitive>true</Embed-Transitive>` embeds ALL transitive dependencies — use carefully.

---

## 7. Service export between modules

### Provider module

```java
@Component(service = {DataService.class})
public class DataServiceImpl implements DataService {
    @Override
    public List<String> getData() { return Arrays.asList("item1", "item2"); }
}
```

pom.xml: `<export-package>org.example.moduleA.api</export-package>`

### Consumer module

```java
@Component(service = MyConsumer.class)
public class MyConsumer {
    @Reference
    public void setDataService(DataService dataService) { this.dataService = dataService; }
}
```

pom.xml:
```xml
<jahia-depends>moduleA-artifactId</jahia-depends>
<jahia.modules.importPackage>org.example.moduleA.api</jahia.modules.importPackage>
```

---

## 8. Available Jahia OSGi services

Key Jahia services accessible via `@Reference`:

| Interface | Description |
|-----------|-------------|
| `JahiaTemplateManagerService` | Template package registry, module lifecycle |
| `JahiaUserManagerService` | User CRUD and lookup |
| `JahiaGroupManagerService` | Group management |
| `JCRSessionFactory` | JCR session factory |
| `JahiaSitesService` | Site management |
| `RenderService` | Content rendering |
| `CacheService` | Cache management |
| `WorkflowService` | Workflow management |

---

## 9. Bundle lifecycle states

| State | Description |
|-------|-------------|
| `INSTALLED` | Bundle JAR is installed but requirements not resolved yet |
| `RESOLVED` | All package dependencies resolved but not started |
| `STARTING` | Bundle activator is running |
| `ACTIVE` | Bundle is fully started and operational |
| `STOPPING` | Bundle is being stopped |
| `UNINSTALLED` | Bundle has been removed |

A bundle stuck in `RESOLVED` but not `ACTIVE` usually means an `@Activate` method threw an exception or a required `@Reference` could not be resolved.
