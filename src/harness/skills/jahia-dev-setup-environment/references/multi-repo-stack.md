# A stack spread over several repositories

A site often runs on a dozen modules, each in its own repository, with no document that lists them.
This procedure clones them into one directory, builds them with one command, and starts a Jahia that
installs every local build and imports the site. Ask the developer where the directory goes.

## 1. Find the repositories

Start from the module that carries the site, or from a package (a POM with parent
`jahia-packages-parent`), and follow three lists:

- `<jahia-depends>` in each `pom.xml`, or `jahia.module-dependencies` in `package.json`.
- The `<dependency>` list of a package POM. It often names modules that no module declares.
- The views. A folder `src/main/resources/<prefix>_<Type>/` holds views for the node type
  `<prefix>:<Type>`. When another module declares that type (`[<prefix>:<Type>]` in its
  `.cnd`), this module needs it at runtime, declared or not.

Then find each repository:

- The repository name can differ from the `<artifactId>`. Search the organization for the
  artifact id in POM files. On GitHub:
  `gh api "search/code?q=<artifactId>+filename:pom.xml+org:<org>"`. On another host, use its code
  search, or ask the developer.
- One repository can hold several modules: a parent POM with `<modules>`.
- The instance already holds the modules that ship with Jahia, such as `default`, `search` and
  `facets`. Do not clone them.
- An archived repository still builds. Note it for the developer.

Report the list before you clone: each module, its repository, and why it is in the stack. Ask the
developer which modules to build from source. The others install as released versions from Maven
(`installModule: 'mvn:…'`), when a release runs on the target Jahia.

## 2. One directory, one build

Clone each repository into a subdirectory, and put at the root:

- `pom.xml`, an aggregator: `<packaging>pom</packaging>` and one `<module>` per directory. It is not a
  parent, so each module keeps its own parent version and signature.
- `.mvn/maven.config`, with one line `-Djahia.plugin.version=<version>` when a module pins a broken
  `jahia-maven-plugin` (`jahia-dev-run-module` step 4). Take the version from the parent of the
  newest module.
- `mise.toml`, from `mise.toml` next to this file: the JDK, and Maven `3.8`.
- `build.sh`, which builds and copies each bundle to `dist/` under a name without its version, so the
  manifest never changes when a version does:

```sh
#!/bin/sh
set -e
cd "$(dirname "$0")"
mise exec -- mvn -B clean package -DskipTests "$@"
rm -rf dist
mkdir dist
for jar in */target/*.jar */*/target/*.jar; do
  case "$jar" in *-sources.jar | *-javadoc.jar | *-tests.jar | *-classes.jar) continue ;; esac
  cp "$jar" "dist/$(basename "$jar" | sed -E 's/-[0-9][^-]*(-SNAPSHOT)?\.jar$/.jar/')"
done
```

A JavaScript module (a `package.json` with a `jahia` block) is not part of the Maven reactor. Build it
with `yarn build` in `build.sh`, and deploy it with its own `yarn deploy` once the instance runs: that
script uploads `dist/package.tgz` with `installOrUpgradeBundle`. It needs the
`javascript-modules-engine` module, which goes in the manifest.

Run the build before you write the manifest, and fix each module that fails: the fix is part of the
environment. Write in a root `README.md` each workaround and the reason for it.

## 3. The manifest installs the local builds

Mount `dist/` next to the provisioning directory in `docker-compose.yml`:

```yaml
    volumes:
      - jahia-data:/var/jahia
      - ./provisioning:/opt/provisioning:ro
      - ./dist:/opt/dist:ro
```

List every bundle in one operation. `autoStart` starts them once all of them are installed, so the
order does not matter, and `uninstallPreviousVersion` replaces the versions the image ships:

```yaml
- installModule:
    - 'file:/opt/dist/module-a.jar'
    - 'file:/opt/dist/module-b.jar'
  autoStart: true
  uninstallPreviousVersion: true
```

Only the startup manifest (`EXECUTE_PROVISIONING_SCRIPT`) may read `file:` paths on every Jahia
version. A script sent to the API uploads its files instead (`jahia-dev-run-module` step 5).

## 4. The site comes from a module

A site module often packages its export: a ZIP under `META-INF/prepackagedSites/`, or an artifact
with the classifier `import`. Inside are the site export (`<Site>.zip`) and often a `users.zip`. Copy
that ZIP to `dist/` in `build.sh`, then import the users before the site, because the site's
permissions name them:

```yaml
- import: 'jar:file:/opt/dist/site-import.zip!/users.zip'
- importSite: 'jar:file:/opt/dist/site-import.zip!/Site.zip'
```

When no module packages the site, ask the developer for an export of a staging site, or create an
empty site from the template set (SKILL.md step 4). Never commit an export that holds customer data.

## 5. Redeploy after a change

The manifest runs once per container. After a change, upload the new bundles to the running
instance, with `forceUpdate` because a SNAPSHOT keeps its version:

```sh
#!/bin/sh
# ./deploy.sh module-a module-b: uploads those bundles of dist/, or all of them
set -e
cd "$(dirname "$0")"
[ $# -gt 0 ] || set -- $(cd dist && ls *.jar | sed 's/\.jar$//')
script=$(mktemp)
echo '- installModule:' >"$script"
for name in "$@"; do
  echo "    - '$name.jar'" >>"$script"
  set -- "$@" -F "file=@dist/$name.jar"
  shift
done
printf '  autoStart: true\n  forceUpdate: true\n  uninstallPreviousVersion: true\n' >>"$script"
curl -fsS -u "root:root1234" -F "script=@$script;type=text/yaml" "$@" \
  http://localhost:8080/modules/api/provisioning
rm "$script"
```

## 6. Verify from scratch

The environment works when an empty instance reaches the end state with no manual step:

```sh
./build.sh
docker compose down --volumes   # ask the developer first: it deletes the instance
docker compose up --wait
```

Then check, in this order: the manifest verdict and its `.failed` lines (SKILL.md step 5), the
`_localState` of every bundle of `dist/`, and a `200` on every page of the site. The table of
`jahia-dev-run-module` step 6 names the failures of such a stack: a signature that no longer covers
the version, and the wrong imports of a build with Maven 3.9 or later. Check the Maven version before
you change a module to satisfy an import.
