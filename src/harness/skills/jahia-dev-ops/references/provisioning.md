# Jahia Provisioning Reference

A provisioning script is a YAML (or JSON) list of operations, run in order. The full reference is
the README of the provisioning bundle in the Jahia source; this page covers what a project needs.

## Where a script runs

- **At startup.** The Docker images run the URL in `EXECUTE_PROVISIONING_SCRIPT` once, when the
  container is created. Keep the `file:` scheme: `file:/opt/provisioning/bootstrap.yaml`. The image
  copies the script to `/var/jahia/patches/provisioning/999-docker-provisioning.yaml`.
- **On a running instance.** `POST /modules/api/provisioning`, as `root`:

```bash
# The script alone
curl -u root:root1234 -X POST -H "Content-Type: application/yaml" \
     --data-binary @my-script.yaml http://localhost:8080/modules/api/provisioning

# The script and the files it installs: each operation names a file by its part name
curl -u root:root1234 -F "script=@install.yaml;type=text/yaml" -F file=@target/my-module-1.0.0.jar \
     http://localhost:8080/modules/api/provisioning
```

Recent Jahia versions refuse a `file:` URL in a script sent to the API, and in anything it
`include`s. Upload the file with the script instead, which works on every version.

The API answers HTTP 200 for some failures. Read the body. Recent versions also check the script
against a schema, and report what does not match in a `validation` entry of the response while they
still run the script.

## Modules

```yaml
# One module, from Maven, an https URL, or a file (startup script only)
- installModule: 'mvn:org.jahia.modules/article/3.0.0'
  autoStart: true
  uninstallPreviousVersion: true

# Several modules: autoStart starts them once all of them are installed, so the order does not matter
- installModule:
    - 'mvn:org.jahia.modules/forms-core/3.2.0'
    - 'file:/opt/dist/my-module.jar'
    - { url: 'mvn:org.jahia.modules/font-awesome/6.0.0', autoStart: false }
  autoStart: true
  uninstallPreviousVersion: true

# Install, or upgrade and keep the started/stopped state of the previous version
- installOrUpgradeModule: 'mvn:org.jahia.modules/article/3.0.1'

# Same version again (a SNAPSHOT rebuild): forceUpdate
- installModule: 'my-module.jar'      # an uploaded part
  forceUpdate: true
  autoStart: true

- startModule: ['article/3.0.1', 'news/3.0.0']   # <symbolic-name>[/<version>]
- stopModule: 'article/3.0.0'
- uninstallModule: 'article/3.0.0'

# Enable modules on sites
- enable: ['news', 'article']
  site: ['mysite', 'demo']
```

`installBundle` is an older name of `installModule`. A private Maven repository goes first:

```yaml
- addMavenRepository: 'https://nexus.example.com/repository/releases@id=example@snapshots'
  username: 'user@example.com'
  password: 'xxx'   # never commit it: generate the script, or keep it out of the repository
```

## Sites and content

### Create a virtual site

> ⚠️ **CRITICAL — Jahia 8.2 syntax**: use `- createSite: ""` with properties at the **same indentation level**. There are **two common mistakes that both silently return HTTP 200 but create nothing**:
> - ❌ `- createSite:` with nested properties (missing `""`)
> - ❌ `- createVirtualSite:` (old name, no longer valid)

```yaml
- createSite: ""
  siteKey: acme
  title: "ACME Corp"
  locale: en
  serverName: localhost
  templateSet: acme-template-set
  modulesToDeploy: ['news']
```

Verify that the site exists, since HTTP 200 is not a confirmation:

```bash
curl -s -u root:root1234 -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites/acme\") { name } } }"}'
```

### Delete a site

```yaml
- deleteSite: ""
  siteKey: acme
```

### Import

`importSite` takes a site export; `import` takes any other export, such as the users. Both take a
URL, and a `jar:` URL reads a ZIP inside a ZIP. Import the users before the site whose permissions
name them:

```yaml
- import: 'jar:file:/opt/dist/site-import.zip!/users.zip'
- importSite: 'jar:file:/opt/dist/site-import.zip!/Acme.zip'
- importSite: 'https://myserver.com/exports/acme.zip'
```

## Configuration and scripts

```yaml
# Create or edit an OSGi configuration (factory PID: add configIdentifier)
- editConfiguration: 'org.jahia.modules.example'
  configIdentifier: 'default'
  properties:
    url: 'https://api.example.com'

# Install a .cfg file
- installConfiguration: 'https://myserver.com/org.jahia.modules.example-default.cfg'

# Run a .groovy or .graphql script; there is no operation for users or roles, so a script does that
- executeScript: 'file:/opt/provisioning/create-users.groovy'

- karafCommand: 'bundle:list'
- sleep: 1000
- include: 'mvn:org.jahia.packages/forms-package/3.2.1/yaml/provisioning'
- if: "'${jahia:operatingMode}' == 'development'"
  do:
    - installModule: 'mvn:org.jahia.modules/sdl-generator-tools/2.1.0'
```

## Did the script run?

Jahia renames a script it ran from the patches folder with its verdict, `.installed` or `.failed`,
and logs one line per script and one per failed operation:

```bash
docker compose exec jahia ls /var/jahia/patches/provisioning/
docker compose logs jahia | grep "999-docker-provisioning.yaml : "   # .installed when done
docker compose logs jahia | grep " : .failed"
```

A failed operation leaves the verdict of the script at `.installed`, so read both. Then check the
state of each module (`ACTIVE`) and the end state, such as the site.

## Patches folder

`/var/jahia/patches/` holds `groovy/`, `provisioning/` and `sql/`. Jahia runs a new file there at
startup, and renames it with its verdict.

## jCustomer (Unomi) provisioning

Unomi uses its own REST API and YAML/JSON rules. Key endpoints:

```bash
# Import a scope
curl -u karaf:karaf -X POST \
     -H "Content-Type: application/json" \
     -d '{"itemId":"mySite","itemType":"scope"}' \
     http://localhost:8181/cxs/scopes

# Import a rule
curl -u karaf:karaf -X POST \
     -H "Content-Type: application/json" \
     -d @my-rule.json \
     http://localhost:8181/cxs/rules

# Reload rules from classpath
curl -u karaf:karaf -X POST http://localhost:8181/cxs/rules/resetQueries
```
