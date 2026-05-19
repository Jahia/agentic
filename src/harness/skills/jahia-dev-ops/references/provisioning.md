# Jahia Provisioning Reference

## Provisioning API overview

The Jahia Provisioning API (introduced in DX 8.x) executes YAML scripts that
install modules, create sites, configure OSGi services, and seed JCR content.
Scripts can be:

- Placed in `/var/jahia/patches/` — executed automatically at startup.
- POSTed to the REST endpoint: `POST /modules/api/provisioning`.

## REST endpoint

```
POST /modules/api/provisioning
Authorization: Basic <base64(root:password)>
Content-Type: application/yaml   (or multipart/form-data)

<provisioning script body>
```

### Upload via curl

```bash
curl -u root:changeme \
     -X POST \
     -H "Content-Type: application/yaml" \
     --data-binary @my-script.yaml \
     http://localhost:8080/modules/api/provisioning
```

### Upload via multipart (with file)

```bash
curl -u root:changeme \
     -F "script=@my-script.yaml" \
     http://localhost:8080/modules/api/provisioning
```

## Script structure

```yaml
# provisioning-script.yaml
- installOrUpgradeModules:
    - url: "mvn:org.jahia.modules/article/3.5.0"
    - url: "file:///var/jahia/modules/my-custom-module-1.0.jar"

- createVirtualSite:
    siteKey: mySite
    title: "My Site"
    locale: en
    serverName: www.example.com
    templateSet: my-template-set

- importSite:
    siteKey: mySite
    uri: "file:///var/jahia/imports/mySite-export.zip"
```

## Common provisioning operations

### Install / upgrade a module from Maven

```yaml
- installOrUpgradeModules:
    - url: "mvn:org.jahia.modules/bootstrap4-core/4.0.0"
    - url: "mvn:org.jahia.modules/bootstrap4-components/4.0.0"
```

### Install from a local file

```yaml
- installOrUpgradeModules:
    - url: "file:///var/jahia/modules/my-module-1.0.jar"
```

### Enable / start a module

```yaml
- startModules:
    - name: my-module
```

### Disable / stop a module

```yaml
- stopModules:
    - name: my-module
```

### Uninstall a module

```yaml
- uninstallModules:
    - name: my-module
```

### Create a virtual site

```yaml
- createVirtualSite:
    siteKey: acme
    title: "ACME Corp"
    locale: en
    serverName: acme.example.com
    templateSet: acme-template-set
    installedModules:
      - bootstrap4-core
      - acme-components
```

### Delete a virtual site

```yaml
- deleteSite:
    siteKey: acme
```

### Import a site export ZIP

```yaml
- importSite:
    siteKey: acme
    uri: "file:///var/jahia/imports/acme-export.zip"
    rootUsersGroup: site-admins
```

### Execute a Groovy script

```yaml
- executeScript:
    script: "file:///var/jahia/patches/migrate-content.groovy"
```

Or inline:

```yaml
- executeScript:
    scriptContent: |
      import org.jahia.services.content.*
      def session = JCRSessionFactory.getInstance().getCurrentSystemSession("default", null, null)
      // ... do work ...
      session.save()
```

### Set a system property / OSGi configuration

```yaml
- setSystemProperty:
    name: my.custom.property
    value: "my-value"
```

```yaml
- setOsgiConfiguration:
    pid: "org.jahia.services.content.nodetypes.NodeTypeRegistry"
    properties:
      autoDeployBundles: "true"
```

### Add a user

```yaml
- addUser:
    username: john.doe
    password: secret123
    email: john.doe@example.com
    firstName: John
    lastName: Doe
    roles:
      - site-administrator:acme
```

### Grant a role on a node

```yaml
- grantRoles:
    path: /sites/acme
    principal: "u:john.doe"
    roles:
      - site-administrator
```

## Patches directory

Files placed in `/var/jahia/patches/` are executed **once** at startup
(Jahia records which files have already been applied):

```
/var/jahia/patches/
  cfg/               ← OSGi .cfg files
  spring/            ← Spring XML context overrides
  groovy/            ← Groovy scripts (executed once)
  yaml/              ← Provisioning YAML scripts (executed once)
```

Mount a host directory here to inject patches without rebuilding the image:

```yaml
volumes:
  - ./patches:/var/jahia/patches
```

## Execution order and idempotency

- Provisioning YAML scripts in `patches/yaml/` are sorted alphabetically.
  Prefix filenames with a two-digit index (`01-modules.yaml`, `02-sites.yaml`)
  to control order.
- Most operations are idempotent: `installOrUpgradeModules` skips if the exact
  version is already installed; `createVirtualSite` skips if the site key exists.
- Groovy scripts in `patches/groovy/` run exactly once; rename the file to
  force re-execution.

## Checking provisioning status

```bash
# View provisioning log output (appears in jahia.log)
docker compose exec jahia grep -i "provisioning\|install.*module\|createVirtualSite" /var/log/jahia/jahia.log

# List applied patches via Karaf
ssh -p 7770 karaf@localhost
# In Karaf:
jahia:patches-list
```

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
