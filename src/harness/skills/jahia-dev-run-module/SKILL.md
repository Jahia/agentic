---
name: jahia-dev-run-module
description: Runs a Jahia module that already exists, on a local Jahia, when nobody documented how. Use when you are handed a repository and asked to start it, deploy it, redeploy it after a change, or find out why it does not start — including a monorepo with several modules to deploy in dependency order. Also the recovery skill for a broken local environment: change the published port or a mounted directory after the container exists, reset the root password, start again from an empty Jahia, install the same modules every time, and explain a build that passes locally and fails in the continuous integration. Reads the repository to tell a Java module from a JavaScript module and to find the Jahia version, the dependencies and the JDK it needs. For a NEW project scaffolded with @jahia/create-module, use jahia-dev-start-local instead.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Running a Jahia module you did not write

The repository holds every answer you need. Read it before you run anything, because a wrong Jahia
version or a missing dependency produces a module that installs and never starts.

> Ask the developer before you delete a container or a volume. Both actions destroy the site on
> their machine, and a running instance often carries content nobody exported.

## Step 1 — Classify the repository

```bash
ls
cat pom.xml 2>/dev/null | head -40
cat package.json 2>/dev/null
ls .github/workflows/ 2>/dev/null
cat docker-compose.yml compose.yml 2>/dev/null | head -40
cat mise.toml .nvmrc .tool-versions 2>/dev/null
ls tests/ 2>/dev/null
```

| Signal | What it means |
|---|---|
| `pom.xml` with parent `org.jahia.modules:jahia-modules` and `<packaging>bundle</packaging>` | A Java module. The parent `<version>` names the Jahia line it compiles against. |
| `package.json` with a `jahia` block | A JavaScript module. The block holds `required-version`, `module-dependencies` and `module-type`. |
| Both files | A Java module that also builds front-end assets. Build both parts. |
| Several directories with their own `pom.xml` or `package.json` | A monorepo. Every such directory is one module, and all of them are deployed. |
| `tests/` with `provisioning-manifest*.yml` | An end-to-end suite. The manifest lists the modules the suite needs, and that list is usually longer than the module's own dependencies. |
| `.github/workflows/*.yml` | The commands that really run. Prefer a workflow file over a README when the two disagree. |

Report the classification to the developer in one line before you continue.

## Step 2 — Read the version and the dependencies

- Jahia version: the parent `<version>` in `pom.xml`, or `jahia.required-version` in `package.json`.
  Run a Jahia at that version or above.
- Dependencies: `<jahia-depends>` in `pom.xml`, `jahia.module-dependencies` in `package.json`, and
  every entry of `tests/provisioning-manifest*.yml`.
- Toolchain: `maven.compiler.release` in `pom.xml` (11 or 17), and `packageManager` plus
  `engines.node` in `package.json`.

## Step 3 — Get a Jahia running

**Use the repository's own environment when it has one.** A compose file carries the image, the
ports, the password and often a provisioning manifest, which is the instance the project expects:

```bash
docker compose up --wait          # or: docker compose -f docker/docker-compose.yml up --wait
```

**When the repository has none, offer to write one.** A `docker run` command lives in one
developer's shell history and nowhere else, so the next question about this project starts from
zero again. `jahia-dev-setup-environment` writes the Compose file, the provisioning manifest that
installs the module's dependencies and creates or imports the site, the `mise.toml` and the short
`README.md` that states the start command. That set is also what a pipeline runs, so the project
stops carrying two environments.

Use a bare container only as a stop-gap, while the developer decides. `jahia/jahia-discovery:<version>`
runs a 30-day trial with a demo site, and `jahia/jahia-ee:<version>` needs a license file from the
developer.

```bash
docker run -d --name jahia-dev \
  -p 8080:8080 -p 8000:8000 -p 8101:8101 \
  -v jahia-data:/var/jahia \
  -e SUPER_USER_PASSWORD=root1234 \
  -e JPDA=true \
  jahia/jahia-discovery:8.2.3.2
```

Never assume `http://localhost:8080`. Read the port Docker published, because another container may
already hold 8080:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
```

Wait for the instance, then use that URL everywhere below:

```bash
docker logs -f jahia-dev   # ready when it prints "Initialization completed"
```

## Step 4 — Build

### A Java module

When the repository carries a `mise.toml`, run `mise install` and let it provide the JDK and Maven.
Otherwise export `JAVA_HOME` for the JDK that `maven.compiler.release` names, in the same command as
the build. A backgrounded subshell does not inherit a JDK you exported interactively. Offer to add a
`mise.toml` pinning `java`, `maven`, `node` and `yarn` when the project has no such file
(`jahia-dev-setup-environment` step 2), because that file is what makes your build and the
pipeline's build use the same versions.

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 11)   # macOS; 11 or 17, from the POM
mvn clean install -DskipTests
```

A `ConcurrentModificationException` from `maven-bundle-plugin` at the packaging step means the JDK
is too new. The failure is deterministic, so do not retry on the same JDK. Export `JAVA_HOME` for
the JDK the POM names and build once more.

### A JavaScript module

```bash
mise install   # only when the repository carries a mise.toml
yarn install
yarn build     # writes dist/package.tgz
```

Do not run `yarn dev`. It is an interactive watcher for a human, and it never returns.

## Step 5 — Deploy

Both module types install through the provisioning API at `/modules/api/provisioning`.

A JavaScript module carries the script already:

```bash
yarn deploy
```

It posts `dist/package.tgz` to `http://localhost:8080` as `root:root1234`. Change the target in a
`.env` file at the root of the project, and never by editing the script:

```
JAHIA_HOST=http://localhost:8081
JAHIA_USER=root:mypassword
```

Deploy a Java module, or several modules of a monorepo, in one request. Order the entries so that a
module comes after the modules it depends on:

```bash
cat > /tmp/install.yaml <<'EOF'
- installOrUpgradeModule: "module-a-1.0.0-SNAPSHOT.jar"
- installOrUpgradeModule: "module-b-1.0.0-SNAPSHOT.jar"
EOF

curl -u root:root1234 \
  -F script=@/tmp/install.yaml \
  -F file=@module-a/target/module-a-1.0.0-SNAPSHOT.jar \
  -F file=@module-b/target/module-b-1.0.0-SNAPSHOT.jar \
  http://localhost:8080/modules/api/provisioning
```

The value of `installOrUpgradeModule` is the file name of the uploaded part. Install a dependency
you do not build with `installModule` and a Maven URL:

```yaml
- installModule: "mvn:org.jahia.modules/<artifact-id>/<version>"
  autoStart: true
```

The API answers HTTP 200 for some failures. Read the body, and then verify every module in step 6.

## Step 6 — Verify, and only then report success

A green build and a 200 response are not a verdict. Ask the module manager for the state of each
bundle:

```bash
curl -su root:root1234 \
  "http://localhost:8080/modules/api/bundles/org.jahia.modules/<symbolic-name>/<version>/_localState"
```

Read `<symbolic-name>` and `<version>` from `Bundle-SymbolicName` and `Bundle-Version` in the JAR
manifest, or from the `jahia.name` and `version` fields of `package.json`.

`ACTIVE` is the only answer that means the module runs. For any other answer, read the log before
you form a theory, and never change a configuration value to force an install:

```bash
docker logs jahia-dev --since 5m | grep -iE "error|unresolved|exception"
```

| State or log line | Cause | Action |
|---|---|---|
| `INSTALLED`, and `Unresolved requirement: Import-Package: <p>` | No installed bundle exports a package this module imports. | Install the module that provides the package. |
| `RESOLVED` | OSGi resolved the bundle and the bundle did not start. | Read the activation error in the log. |
| `Skipping installation of <jar>, a more recent version is already installed` | Jahia does not replace a module with an older version, and the request still succeeds. | Uninstall first with `- uninstallModule: "<symbolic-name>/<version>"`, then install. |
| `Invalid license check`, and the bundle stops itself | The module signature no longer matches its version. A signature covers one `major.minor` line. | Report it to the developer. You cannot sign a module. |
| `unreachable` | The instance did not answer. | Check the published port and that the container is running. |

## Step 7 — Repair the local environment

**Change a published port or a mounted directory.** Docker fixes both when it creates a container,
and neither can change afterwards. Delete the container and create it again with the same
`-v jahia-data:/var/jahia` volume, which is what keeps the site. Ask the developer first. Then
update `JAHIA_HOST` in `.env`, and the URL in every curl command.

**Reset the password of root.** Start the container again with a new `SUPER_USER_PASSWORD`. Jahia
compares the value with the hash in `/var/jahia/info/passwd` and resets the password of `root`.

**Start again from an empty Jahia.** `docker rm -f jahia-dev` and `docker volume rm jahia-data`
delete the site and every module. Ask the developer, then repeat steps 3 to 6.

**Leave the environment behind you.** Every repair you make by hand is one a colleague repeats.
Move what you did into the compose file and the manifest, and commit them.

**Install the same modules every time.** Write one provisioning manifest and pass it to the
container, so the next developer needs no manual steps. `jahia-dev-setup-environment` carries the
manifest and the Compose file to keep; the bare form is:

```bash
docker run -d --name jahia-dev -p 8080:8080 \
  -v jahia-data:/var/jahia \
  -v "$PWD/provisioning:/opt/provisioning:ro" \
  -e EXECUTE_PROVISIONING_SCRIPT=/opt/provisioning/modules.yaml \
  jahia/jahia-discovery:8.2.3.2
```

## Step 8 — A build that passes locally and fails in the continuous integration

Compare these five items, and report the difference you find rather than a fix for the code:

- **Toolchain.** The JDK, Node.js and Yarn versions in the workflow file, against the versions in
  use locally.
- **Modules.** The developer installed modules by hand over weeks. A pipeline installs only what
  `tests/provisioning-manifest*.yml` and the module dependencies declare, so name the module that
  is missing from the manifest.
- **Maven artifacts.** A snapshot built locally sits in `~/.m2` and is published nowhere, so the
  pipeline cannot resolve it.
- **Content.** A pipeline starts from an empty instance. A test that reads a site somebody created
  by hand passes only on that machine.
- **Jahia version and operating mode.** The image tag in the workflow file, and `OPERATING_MODE` in
  both environments. The images start in development mode.

## The human-facing reference

The same ground, written for a developer rather than for an agent, including the repository layout
of a multi-module project, the editor setup and the full provisioning manifest:

> https://academy.jahia.com/documentation/jahia-cms/jahia-8.2/developer/introducing-jahia-technical-concepts/setting-up-your-local-dev-environment-and-starting-jahia

## Validation checklist

- [ ] The module type, the Jahia version and the dependency list are read from the repository and
      reported to the developer.
- [ ] The instance answers on the port Docker published, not on an assumed 8080.
- [ ] Every module of the repository is built, including a test module under `tests/`.
- [ ] The provisioning response body carries no error.
- [ ] Every deployed bundle answers `ACTIVE` on `_localState`.
- [ ] No container and no volume was deleted without the developer's agreement.
- [ ] Anything you set up by hand was offered back as a change to the compose file, the
      provisioning manifest or `mise.toml`.
