# Jahia Java Module Development Reference

## Table of Contents
1. [Module types and structure](#1-module-types-and-structure)
2. [Maven pom.xml patterns](#2-maven-pomxml-patterns)
3. [Deployment methods](#3-deployment-methods)
4. [Deploy-free coding](#4-deploy-free-coding)
5. [Static asset management](#5-static-asset-management)
6. [Java 11 / 17 configuration](#6-java-11--17-configuration)
7. [OSGi tooling in Karaf](#7-osgi-tooling-in-karaf)
8. [Troubleshooting common deployment errors](#8-troubleshooting-common-deployment-errors)

---

## 1. Module types and structure

| Type | Purpose |
|------|---------|
| `module` | Standard content module (default) |
| `system` | System-level services, loaded early |
| `templatesSet` | Provides site page templates |

### Directory structure

```
src/main/
  java/                    # Java source code
  resources/
    META-INF/
      definitions.cnd      # Content type definitions
      rules.drl            # Drools rules (all workspaces)
      default-rules.drl    # Rules for edit/preview workspace only
      live-rules.drl       # Rules for live workspace only
      rules.dsl            # Custom DSL extensions
      configurations/      # OSGi .cfg files deployed to karaf/etc/
      patches/             # Groovy migration scripts
    OSGI-INF/blueprint/    # Blueprint XML (deprecated in 8.2)
  webapp/
    css/
    javascript/
    icons/                 # Node type icons (jnt_news.png format)
    resources/             # Resource bundles (ModuleName.properties)
    WEB-INF/macros/        # Groovy/Velocity macros
```

Icons naming: replace `:` with `_` — `jnt:news` → `jnt_news.png`.

---

## 2. Maven pom.xml patterns

### Minimal pom.xml

```xml
<parent>
  <artifactId>jahia-modules</artifactId>
  <groupId>org.jahia.modules</groupId>
  <version>8.2.0.0</version>
</parent>

<groupId>org.example</groupId>
<artifactId>my-module</artifactId>
<version>1.0.0-SNAPSHOT</version>
<packaging>bundle</packaging>
<name>My Module</name>

<properties>
  <jahia-depends>default,assets</jahia-depends>
  <jahia.modules.importPackage>org.jahia.defaults.config.spring</jahia.modules.importPackage>
  <export-package>org.example.mymodule.api</export-package>
</properties>

<build>
  <plugins>
    <plugin>
      <groupId>org.apache.felix</groupId>
      <artifactId>maven-bundle-plugin</artifactId>
      <extensions>true</extensions>
      <configuration>
        <instructions>
          <Jahia-Module-Type>module</Jahia-Module-Type>
          <Jahia-Static-Resources>/css,/icons,/javascript</Jahia-Static-Resources>
          <Jahia-Source-Folders>${project.basedir}</Jahia-Source-Folders>
          <Embed-Dependency>*;scope=compile|runtime;type=!pom;inline=false</Embed-Dependency>
          <_dsannotations>*</_dsannotations>
        </instructions>
      </configuration>
    </plugin>
    <plugin>
      <groupId>org.jahia.server</groupId>
      <artifactId>jahia-maven-plugin</artifactId>
    </plugin>
  </plugins>
</build>
```

### Declaring module dependencies with version constraints

```xml
<jahia-depends>dep-module1=4.1,dep-module2,dep-module3=[0, 3)</jahia-depends>
<jahia-depends>dep-module1=optional</jahia-depends>
```

---

## 3. Deployment methods

### Method 1: Copy to modules directory (development)
Drop the JAR into `digital-factory-data/modules/`. Jahia auto-deploys.

### Method 2: Maven deploy goal (recommended)
```xml
<profile>
  <id>jahia-local</id>
  <properties>
    <jahia.deploy.targetServerType>tomcat</jahia.deploy.targetServerType>
    <jahia.deploy.targetServerDirectory>/path/to/jahia/apache-tomcat</jahia.deploy.targetServerDirectory>
  </properties>
</profile>
```
```bash
mvn clean install jahia:deploy -P jahia-local
# For Docker:
mvn jahia:deploy -Djahia.deploy.targetContainerName=CONTAINER_NAME
```

### Creating a new module from archetype
```bash
mvn archetype:generate -Dfilter=org.jahia.archetypes:
# Select: jahia-module-archetype
```

---

## 4. Deploy-free coding

Deploy-free coding allows JSP, CSS, JS, and CND changes to be reflected without redeployment.

**Requirement:** `Jahia-Source-Folders` must point to the project base directory in MANIFEST.

**Limitations:** Java class changes still require redeployment. Remove `Jahia-Source-Folders` for release builds.

---

## 5. Static asset management

Assets are served from within the OSGi bundle JAR:
```xml
<Jahia-Static-Resources>/css,/icons,/images,/javascript</Jahia-Static-Resources>
```

OSGi configuration files shipped with a module go in:
`src/main/resources/META-INF/configurations/` → auto-deployed to `digital-factory-data/karaf/etc/`

To prevent overwriting on upgrade, start the file with:
```
# default configuration
```

---

## 6. Java 11 / 17 configuration

For Java 17, add to JVM startup arguments:
```
--add-opens java.base/java.lang=ALL-UNNAMED
--add-opens java.base/java.io=ALL-UNNAMED
--add-opens java.base/java.util=ALL-UNNAMED
```

---

## 7. OSGi tooling in Karaf

```bash
ssh -p 8101 jahia@localhost
bundle:list                    # List all OSGi bundles
jahia:modules                  # List Jahia modules with state
bundle:requirements --namespace=osgi.wiring.package <bundleId>  # Package requirements
jcr:query "SELECT * FROM [jnt:page]"  # Execute JCR SQL2 query
```

### Jahia Maven Plugin goals for OSGi diagnostics

```bash
mvn jahia:dependencies          # Generate/inspect Import-Package list
mvn jahia:find-package-uses -DpackageNames=com.example.pkg
mvn jahia:osgi-inspect          # Dump MANIFEST headers of built JAR
```

---

## 8. Troubleshooting common deployment errors

### Bundle stuck in Installed/Resolved (not Started)

Causes:
1. Missing package import
2. Unsatisfied Jahia-Depends
3. CND dependency not met

Diagnosis:
```bash
bundle:requirements --namespace=osgi.wiring.package <bundleId>
bundle:requirements --namespace=com.jahia.services.content <bundleId>
```

### JSP compilation error: "class cannot be resolved"

Solution: Add the package to `jahia.modules.importPackage` or run `mvn jahia:dependencies`.

### "Unresolved constraint in bundle" on deploy

```
Unable to resolve 118.0: missing requirement [118.0] osgi.wiring.package
```

Solution: Use `mvn jahia:find-package-uses` to identify source. Mark as `resolution:=optional` if not needed at runtime.
