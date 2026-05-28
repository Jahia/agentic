---
name: jahia-dev-java
description: |
  Jahia 8.2 Java module development — creating OSGi modules, defining content types (CND),
  building JSP views, implementing backend logic (rules, actions, queries), and extending
  the Jahia UI (Content Editor, jContent, component registry).
  Trigger when the user is: creating or modifying a Java module, writing CND content type
  definitions, building JSP rendering views, implementing Jahia rules or actions, running
  JCR SQL2 queries, extending Content Editor or jContent UI, configuring OSGi services,
  or troubleshooting module deployment issues.
allowed-tools: Read
---

# Jahia 8.2 Java Developer Skill

## When to load which reference

| Task | Reference |
|------|-----------|
| Creating a new module, Maven pom.xml, deployment, Java 11/17, static assets, deploy-free coding, troubleshooting bundle errors | `references/modules.md` |
| Writing CND definitions, content type hierarchy, property types, choicelist initializers, modifying existing definitions | `references/content-types.md` |
| JSP views, view selection, `@cache` tag, caching configuration, navigation menus, rendering filters, AMP | `references/rendering.md` |
| Drools rules (DRL), JCR event listeners, JCR SQL2 queries, external data provider, permissions and roles | `references/backend.md` |
| OSGi bundle lifecycle, Declarative Services, Blueprint XML, package Import/Export, service registry, Karaf tooling | `references/osgi.md` |
| Content Editor JSON overrides, jContent UI extension points, component registry, custom selectors, settings pages, CKEditor | `references/ui-extensions.md` |
| JCR session lifecycle, workspace, node names, SNS, mixins, locks, versioning — **correct patterns and pitfalls** | `/jahia-java-jcr` skill |
| OSGi `@Component` state, `@Reference`, lifecycle side effects, Export-Package — **correct patterns and pitfalls** | `/jahia-java-osgi` skill |
| Securing HTTP-reachable surfaces (servlets, GraphQL, filters) — Security Filter, CSRF Guard, ACLs | `/jahia-java-security` skill |
| Relational persistence alongside JCR — N+1, timestamp consistency, entity model, transactional asymmetry | `/jahia-java-persistence` skill |
| Thread safety in a multi-threaded webapp — `volatile`, locking, atomic variables, thread-safe collections, JCR session threading | `/jahia-java-concurrency` skill |

## Key Concepts Glossary

**Bundle / Module**
An OSGi JAR deployed into Jahia. Every Jahia module is an OSGi bundle. Jahia adds custom MANIFEST attributes (`Jahia-Module-Type`, `Jahia-Depends`, `Jahia-Root-Folder`) on top of standard OSGi headers.

**CND (Compact Namespace and Node Type Definition)**
Apache Jackrabbit standard file format (`definitions.cnd`) that declares content types. Lives at `src/main/resources/META-INF/definitions.cnd`.

**JCR (Java Content Repository)**
The underlying storage model. Content is a tree of nodes, each with a primary type and optional mixin types. Jahia uses Apache Jackrabbit Oak as the JCR implementation.

**jnt: prefix**
Jahia Node Types namespace (`http://www.jahia.org/jahia/nt/1.0`). Used for concrete content types like `jnt:content`, `jnt:page`, `jnt:file`.

**jmix: prefix**
Jahia Mixin namespace (`http://www.jahia.org/jahia/mix/1.0`). Used for abstract mixin types like `jmix:editorialContent`, `jmix:list`, `jmix:cache`.

**jmix:editorialContent**
Key mixin — makes a content type visible in jContent and enables content versioning. Required for any user-editable content type.

**jmix:droppableContent**
Base mixin for component categories. Types that inherit from this mixin create a component folder in the content picker sidebar.

**Declarative Services (DS)**
Preferred OSGi service mechanism in Jahia 8.2. Uses `@Component`, `@Activate`, `@Reference` annotations. Blueprint XML is deprecated as of Jahia 8.2.

**jahia-depends**
MANIFEST / pom.xml property declaring other module artifact IDs that this module requires. OSGi resolves dependencies before starting the bundle. Supports version ranges and optional dependencies.

**Embed-Dependency**
Felix Maven Bundle Plugin instruction to embed non-OSGi JARs inside the module JAR. Default scope: `compile|runtime`. Dependencies scoped `provided` are NOT embedded.

**Deploy-free coding**
Development workflow where source file changes (JSP, CSS, JS, CND) are picked up live without redeployment. Requires initial deploy and `Jahia-Source-Folders` MANIFEST attribute pointing to the project base directory.

**jahia:deploy Maven goal**
Deploys the compiled module JAR to a local Jahia server or Docker container. Usage: `mvn clean install jahia:deploy -P <profile>`.

**Content Editor**
Jahia's React-based form UI for creating/editing content. Forms are generated from CND definitions merged with JSON override files. Override files live in `META-INF/jahia-content-editor-forms/`.

**jContent**
Jahia's React-based content management UI. Extended via the component registry (`window.jahia.uiExtender.registry`). Used by editors to browse, create, and manage content.

**Component Registry**
JavaScript hashmap (`type + key → value`) used to inject UI elements (actions, accordions, nav items, selector types) into jContent and Content Editor at runtime. Access via `import {registry} from '@jahia/ui-extender'`.

**DRL (Drools Rule Language)**
Rule files placed at `META-INF/rules.drl` (all workspaces), `META-INF/default-rules.drl` (edit workspace only), or `META-INF/live-rules.drl` (live workspace only). Jahia provides a built-in DSL that simplifies rule conditions and consequences.

**Workspace**
Jahia has two JCR workspaces: `default` (edit/preview, where authors work) and `live` (what visitors see). Publication copies nodes from default to live.

**Felix Web Console**
OSGi administration UI at `http://localhost:8080/tools`. Shows bundle states, packages, services. Useful for diagnosing dependency issues.

**Karaf SSH Shell**
Command-line OSGi console accessible via `ssh -p 8101 jahia@localhost`. Key commands: `jahia:modules`, `bundle:requirements`, `jcr:query`.

**JCR SQL2**
Query language for the JCR. Syntax: `SELECT * FROM [nodetype] AS alias WHERE condition`. Use `ISDESCENDANTNODE(alias, '/path')` to scope queries. Do NOT query `nt:base` — use `jmix:searchable` instead for broad content queries.

**choicelist initializer**
Java class implementing `ModuleChoiceListInitializer` that populates dropdown values in Content Editor. Registered as an OSGi `@Component` service. Referenced in CND with `choicelist[keyName]` syntax.

**Rendering filter**
OSGi service implementing `RenderFilter`. Wraps every JSP/module render. Priority < 16 runs per-request; priority > 16 runs only on cache miss. Extend `AbstractFilter` to use condition setters.

**Migration scripts**
Groovy scripts in `src/main/resources/META-INF/patches/` that run once on module deployment to migrate JCR content or configuration.

**Module types**
`Jahia-Module-Type` MANIFEST value controls module behavior:
- `module` — regular content module (default)
- `system` — loaded early, provides system-level services
- `templatesSet` — template set module that defines site templates

**Static resources**
JS/CSS/images declared in `Jahia-Static-Resources` MANIFEST header (e.g. `/css,/icons,/javascript`). Served directly from the OSGi bundle JAR under `src/main/resources/`.
