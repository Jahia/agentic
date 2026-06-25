# Security Reference

Covers the security filter/service (scope-based API authorization), HTML filtering (XSS protection), and Content Security Policy (CSP).

## Table of Contents

- [Security Service and Filter](#security-service-and-filter)
  - [Overview](#overview)
  - [Authorization configuration](#authorization-configuration)
  - [Scope grants](#scope-grants)
  - [Auto-apply rules](#auto-apply-rules)
  - [User constraints](#user-constraints)
  - [Configuration profiles](#configuration-profiles)
  - [Extending an existing scope](#extending-an-existing-scope)
  - [Packaging configuration in a module](#packaging-configuration-in-a-module)
  - [Checking API authorization from Java](#checking-api-authorization-from-java)
  - [CORS filter](#cors-filter)
  - [JWT tokens (deprecated)](#jwt-tokens-deprecated)
  - [Legacy mode and migration](#legacy-mode-and-migration)
- [HTML Filtering (XSS Protection)](#html-filtering-xss-protection)
  - [Overview](#overview-1)
  - [Configuration file priority](#configuration-file-priority)
  - [Configuration structure](#configuration-structure)
  - [Strategies: SANITIZE vs REJECT](#strategies-sanitize-vs-reject)
  - [Process and skip settings](#process-and-skip-settings)
  - [Skip on permissions](#skip-on-permissions)
  - [Rule sets — allowed elements and attributes](#rule-sets--allowed-elements-and-attributes)
  - [GraphQL API for validation](#graphql-api-for-validation)
  - [Which properties are filtered](#which-properties-are-filtered)
  - [Best practices](#best-practices)
  - [Migrating from v1 to v2](#migrating-from-v1-to-v2)
- [Content Security Policy (CSP)](#content-security-policy-csp)
  - [Installation and enabling](#installation-and-enabling)
  - [Site-level CSP](#site-level-csp)
  - [Page-level CSP override](#page-level-csp-override)
  - [Report-only mode](#report-only-mode)
  - [Nonce generation](#nonce-generation)
  - [CSP examples](#csp-examples)

---

## Security Service and Filter

### Overview

The `security-filter` bundle protects all Jahia APIs (GraphQL, RESTful JCR, views, custom APIs) from unauthorized access, XSS/CSRF attacks, and provides CORS support.

**Core principle:** All API access is **denied by default**. Access is explicitly granted via scope-based configuration files. Without any configuration, even the Jahia Administration UI will not work.

Configuration files live in `digital-factory-data/karaf/etc/` with the filename pattern:

```
org.jahia.bundles.api.authorization-*.yml
or
org.jahia.bundles.api.authorization-*.cfg
```

YAML format is supported from Jahia 8.1.0.0 onward (recommended).

### Authorization configuration

The configuration is a list of named **scopes**. Each scope grants access to one or more APIs.

- If a request holds **at least one** scope that grants the API → access **granted**
- If a request holds **no** scope that grants the API → access **denied**

Scopes can be associated with a request via:
- Personal API tokens (explicitly carrying scopes)
- JWT tokens (deprecated — see below)
- Automatic rules based on request origin

**Minimal YAML scope example:**

```yaml
myscope:
  description: Can access some graphql API
  metadata:
    visible: true
  auto_apply:
    - origin: hosted
  grants:
    - api: graphql.MyGqlType
      node: none
```

Equivalent in `.cfg` format:

```properties
myscope.description = Can access some graphql API
myscope.metadata.visible = true
myscope.auto_apply[0].origin = hosted
myscope.grants[0].api = graphql.MyGqlType
myscope.grants[0].node = none
```

### Scope grants

A scope contains one or more grants. Within a single grant, **all conditions must match** (AND logic). Multiple grants use OR logic (any one matching grant grants access).

**Grant conditions:**

**`api`** — API identifier (dot-separated). Examples:
- `graphql.MyGqlType` — specific GraphQL type
- `graphql.JcrNode, graphql.JcrProperty` — multiple types (comma-separated)
- `view.json.tree` — the `tree.json` view
- `jcrestapi` — all JCRest API calls

API names by subsystem:
- GraphQL: `graphql.<gql-type>.<gql-field>`
- JCRest API: `jcrestapi.<query-type>`
- AJAX views: `view.<template-type>.<view-name>`

Include/exclude syntax:

```yaml
grants:
  - api:
      include: graphql
      exclude: graphql.GqlAdmin, graphql.JcrNode
```

**`node`** — matches requests involving a JCR node. Use `node: none` for requests that do not return a node. Sub-entries:

```yaml
grants:
  - node:
      pathPattern: /,/sites(/.*)?
      excludedPathPattern: /sites/[^/]+/users(/.*)?
      workspace: live           # or: default
      nodeType: jnt:page
      excludedNodeType: jnt:file
      withPermission: myPermission
```

**Combining conditions (AND within one grant):**

```yaml
grants:
  - api: graphql
    node: none
# Allows GraphQL calls that do NOT involve a node
```

**Multiple grants (OR between grants):**

```yaml
grants:
  - api: graphql
  - node: none
# Allows ALL GraphQL calls, AND all calls that don't involve a node
```

### Auto-apply rules

Scopes can be automatically applied based on request origin (checked against `Origin` and `Referer` headers):

```yaml
auto_apply:
  - origin: hosted    # same server as Jahia (same origin)
  - origin: same      # alias for hosted
  - origin: http://www.mysite.com   # specific trusted origin
```

To always apply a scope regardless of origin:

```yaml
auto_apply:
  - always: true
```

### User constraints

Restrict a scope to specific users:

```yaml
# Restrict to users with a specific permission on a node:
constraints:
  - user_permission: manageModules
    path: /sites
    workspace: live

# Restrict to privileged users only:
constraints:
  - privileged_user: true
```

The scope will **never** be applied to users who do not meet the constraints.

### Configuration profiles

Set a profile in `org.jahia.bundles.api.security.cfg` via `security.profile`:

| Profile | Description | Recommendation |
|---------|-------------|----------------|
| `default` | No API calls from external origins or non-privileged users | **Recommended** |
| `compat` | More open; compatible with pre-8.1 behavior | Not recommended for production |
| `open` | Allows every call | Never use in production |

The `compat` profile was introduced in 2021 as a migration aid and is not intended for ongoing production use.

### Extending an existing scope

Add grants or auto-apply rules to an existing scope from another configuration file:

```yaml
graphql:
  auto_apply:
    - origin: http://www.mytrusted-origin.com
```

### Packaging configuration in a module

Place configuration files in `META-INF/configurations/` within your module JAR. They are deployed to `karaf/etc` at module startup (supported from DX 7.2.2.0).

### Checking API authorization from Java

The bundle exposes an OSGi service implementing `org.jahia.services.securityfilter.PermissionService`. Call `hasPermission(query)` with a map:

```java
Map<String, Object> query = new HashMap<>();
query.put("api", "my-api.type.sub-type");       // required
query.put("node", jcrNodeWrapper);               // optional
boolean allowed = permissionService.hasPermission(query);
```

The `api` key value is tested by `ApiGrant`; the `node` key value (a `JCRNodeWrapper`) is tested by `NodeGrant`.

### CORS filter

The security-filter module includes a global CORS filter based on the Tomcat implementation. Configure it in `org.jahia.bundles.api.security.cfg`. All Tomcat CORS filter settings are supported — see [Tomcat CORS Filter docs](https://tomcat.apache.org/tomcat-9.0-doc/config/filter.html#CORS_Filter).

### JWT tokens (deprecated)

JWT tokens are **deprecated** — use personal API tokens instead.

Pass a JWT in the `Authorization: Bearer <token>` header. JWT tokens carry a `scopes` claim listing the scopes they grant. Configuration in `org.jahia.bundles.jwt.token.cfg`:

```properties
jwt.issuer = MyOrg
jwt.audience = http://jahia.com
jwt.algorithm = HMAC_SHA256
jwt.secret = my_super_secret_change_this
```

Tokens can be generated via **Developer Tools > JWT Configuration** in development mode.

### Legacy mode and migration

Enable legacy mode in `org.jahia.bundles.api.security.cfg`:

```properties
security.legacyMode=true
```

In legacy mode, old `org.jahia.modules.api.permissions-*.cfg` files are used. The new authorization YAML files are ignored.

Enable migration reporting to compare behaviors:

```properties
security.migrationReporting=true
```

This logs differences between legacy and standard mode without changing the active enforcement.

**Debugging:** Set `org.jahia.bundles.securityfilter.core` (or `.legacy` for legacy mode) to `DEBUG` in log4j to log every permission check with its result and matching grant.

---

## HTML Filtering (XSS Protection)

### Overview

The HTML Filtering module (v2) provides XSS protection for JCR properties containing HTML markup. It is **active as soon as the module is installed** — no per-site enablement is required. Compatible with Jahia 8.1.8.0+.

HTML filtering applies to content saves. It does not filter rendered output.

### Configuration file priority

Three configuration levels (highest to lowest priority):

| Level | Filename | Purpose |
|-------|----------|---------|
| Site-specific | `org.jahia.modules.htmlfiltering.site-<SITE_KEY>.yml` | Per-site overrides |
| Global custom | `org.jahia.modules.htmlfiltering.global.custom.yml` | Admin customizations for all sites |
| Global default | `org.jahia.modules.htmlfiltering.global.default.yml` | Shipped with module; do not modify |

If a configuration file is invalid, it is skipped and the next level in the chain is used. Check logs to confirm your configuration loaded.

### Configuration structure

All configuration files share the same structure with separate `editWorkspace` and `liveWorkspace` sections (both must be present for the file to be valid):

```yaml
htmlFiltering:
  formatDefinitions:
    HTML_ID: '[a-zA-Z0-9\:\-_\.]+'
    NUMBER_OR_PERCENT: '\d+%?'
    LINKS_URL: '(?:(?:[\p{L}\p{N}\\\.#@$%\+&;\-_~,\?=/!{}:]+|#(\w)+)|(\s*(?:(?:ht|f)tps?://|mailto:)[\p{L}\p{N}][\p{L}\p{N}\p{Zs}\.#@$%\+&:\-_~,\?=/!\(\)]*+\s*))'
  editWorkspace:
    strategy: REJECT
    skipOnPermissions: []
    process: ['nt:base.*']
    skip: []
    allowedRuleSet:
      elements:
        # rules for allowed elements and attributes
      protocols: [http, https, mailto]
  liveWorkspace:
    strategy: SANITIZE
    skipOnPermissions: []
    process: ['nt:base.*']
    skip: []
    allowedRuleSet:
      elements:
        # rules for allowed elements and attributes
      protocols: [http, https, mailto]
```

### Strategies: SANITIZE vs REJECT

| Strategy | Behavior | Recommended for |
|----------|----------|----------------|
| `SANITIZE` | Removes disallowed tags/attributes silently | `liveWorkspace` (no direct user feedback) |
| `REJECT` | Rejects the save operation if any disallowed content found | `editWorkspace` (editors can correct) |

**SANITIZE behavior by tag type:**
- Block-level tags (e.g., `<p>`): tag is removed but text content is kept (`<p>hello</p>` → `hello`)
- Other tags (e.g., `<script>`): tag and all its content are removed entirely

### Process and skip settings

Control which node types and properties are filtered:

```yaml
process: ['nt:base.*']          # Filter all properties of all node types
skip: ['nt:myNodeType.*']       # Skip all properties of a specific node type
skip: ['nt:myNodeType.myProp']  # Skip a specific property
```

`skip` takes precedence over `process`. The notation supports any node type/property combination that exists on the node, even via mixins — for example `skip: ['jnt:bigText.j:htmlContent']` is valid even if `j:htmlContent` is defined on a mixin.

### Skip on permissions

Bypass filtering for users holding specific permissions:

```yaml
skipOnPermissions: ['view-full-wysiwyg-editor', 'site-admin']
```

**Warning:** If a privileged user saves HTML content with elements that would be filtered for less privileged users, those users will be unable to later edit that content (their save will be rejected). Use `skipOnPermissions` with care and only for trusted users.

### Rule sets — allowed elements and attributes

```yaml
allowedRuleSet:
  elements:
    - attributes: [class, dir, hidden, lang, role, style, title]    # on any tag
    - attributes:
        - id
      format: HTML_ID                                               # must match regex
    - attributes: [align]
      tags: [caption, col, colgroup, hr, img, table, tbody, td, tfoot, th, thead, tr]
    - attributes: [alt]
      tags: [img]
    - tags: [h1, h2, h3, h4, h5, h6, p, a, img, figure, div, ul, ol, li,
             table, tbody, thead, tfoot, tr, td, th, blockquote, code, pre,
             br, strong, em, span, nav, article, main, aside, section, header, footer]
  protocols: [http, https, mailto]
```

Each rule can specify:
- `tags` — HTML tags the rule applies to (omit to apply to all tags)
- `attributes` — allowed attributes for those tags
- `format` — regex pattern name from `formatDefinitions` that attribute values must match

`protocols` restricts allowed URL schemes in `href` and `src` attributes.

`allowedRuleSet` is mandatory and must contain at least one rule. `disallowedRuleSet` is optional.

### GraphQL API for validation

Validate or preview HTML sanitization before saving:

```graphql
query HtmlFiltering($html: String!, $workspace: Workspace = EDIT, $siteKey: String!) {
  htmlFiltering {
    validate(html: $html, workspace: $workspace, siteKey: $siteKey) {
      removedTags
      removedAttributes {
        attributes
        tag
      }
      sanitizedHtml
      safe
    }
  }
}
```

Response fields:
- `removedTags` — list of tags removed during sanitization
- `removedAttributes` — list of attributes removed, with their parent tags
- `sanitizedHtml` — the sanitized output
- `safe` — `true` if nothing was removed (input is fully compliant)

### Which properties are filtered

A property is processed by HTML filtering only if **all** of the following are true:

1. The current user does not have any permission listed in `skipOnPermissions`
2. The property matches at least one pattern in `process`
3. The property does not match any pattern in `skip`
4. The property is declared as a `richtext` property in the CND definition

```
[nt:myNodeType] > jnt:content, jmix:droppableContent
 - myHTMLProperty (string, richtext)   # filtered
 - willNotBeProcessed (string)          # not filtered (no richtext)
```

**Important:** JSON overrides (jContent UI overrides) that change a property's editor to RichText are **ignored** by HTML filtering. The CND definition is authoritative. Properties must be declared `richtext` in the CND to be filtered.

### Best practices

1. Never modify `org.jahia.modules.htmlfiltering.global.default.yml` — create a custom or site-specific file instead.
2. Use `skipOnPermissions` sparingly; only for users who genuinely need to contribute unrestricted HTML.
3. Use `REJECT` in `editWorkspace` so editors receive immediate feedback; use `SANITIZE` in `liveWorkspace` for resilience.
4. Declare HTML properties with the `richtext` constraint in CND — JSON overrides do not affect filtering.
5. After adding or modifying a config file, verify in logs that it was loaded successfully.

### Migrating from v1 to v2

As soon as v2 is installed, it replaces v1 entirely. v1 custom configurations are no longer read.

**Key changes in v2:**

| Area | v1 | v2 |
|------|----|----|
| Strategy | SANITIZE only | SANITIZE or REJECT per workspace |
| Workspaces | Single config | Separate `editWorkspace`/`liveWorkspace` sections |
| Format definitions | Hardcoded (e.g., `HTML_ID`) | Configurable in `formatDefinitions` |
| Config files | `org.jahia.modules.htmlfiltering.config-*.yml` | Three-tier: global default, global custom, site-specific |
| `htmlSanitizerDryRun` | Available | Removed |

**GraphQL API change:**

v1 (mutation):
```graphql
mutation { htmlFilteringConfiguration { htmlFiltering {
  testFiltering(siteKey: $siteKey, html: $text) { html, removedElements, removedAttributes { element, attributes } }
}}}
```

v2 (query):
```graphql
query { htmlFiltering {
  validate(html: $html, workspace: $workspace, siteKey: $siteKey) {
    sanitizedHtml, removedTags, removedAttributes { attributes, tag }, safe
  }
}}
```

**Migration steps:**
1. Review existing v1 configs; note all custom rules.
2. Create `org.jahia.modules.htmlfiltering.global.custom.yml` for global customizations.
3. Create `org.jahia.modules.htmlfiltering.site-<SITE_KEY>.yml` for site-specific rules.
4. Use `SANITIZE` strategy in both workspaces to replicate v1 behavior, then tighten as needed.
5. Update any code using the v1 GraphQL API.
6. Test thoroughly, then delete the old v1 config files.

---

## Content Security Policy (CSP)

### Installation and enabling

The CSP module is installed by default with Jahia 8+. Enable it per site:

1. Go to **Administration > Server > Modules & Extensions > Modules**.
2. Find **Content Security Policy** and activate it on the relevant sites.

### Site-level CSP

1. Go to **Administration > Sites > Site properties > Edit site properties**.
2. In the Options section, check **Add Content-Security-Policy at the site level**.
3. Enter the CSP directive string (all on one line).
4. Optionally enable report-only mode or specify a violation report URL.

### Page-level CSP override

Override the site-level CSP for a specific page:

1. In **JContent**, edit the page.
2. In the Options section, check **Replace Content-Security-Policy at the page level**.
3. Enter the page-specific CSP directive.

### Report-only mode

Available only at the site level. Enable **Only report CSP violations** — violations are logged to Jahia log files instead of being blocked. Optionally specify a **Report violations to this URL** endpoint.

This is useful for testing a new CSP before enforcing it.

### Nonce generation

To use `nonce-` in your CSP (recommended for inline scripts):

1. Include `nonce-` (as a placeholder) in the site-level CSP value.
2. In your custom module's view, set the `nonce` attribute on `<script>` elements to the Jahia property value `contentSecurityPolicy.nonce.placeHolder`.

For each page rendering, Jahia generates a random nonce, updates the CSP header, and replaces the static placeholder in the HTML output.

### CSP examples

**Basic CSP:**

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://apis.google.com; object-src 'none'; frame-ancestors 'none';
```

**Strict CSP with nonce (multi-line for readability; enter on one line in Jahia):**

```
Content-Security-Policy:
default-src 'self' https://*.doubleclick.net;
script-src 'nonce-' 'strict-dynamic' https: 'unsafe-inline';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
img-src 'self' data:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
frame-src 'self' https://*.googletagmanager.com https://*.google-analytics.com https://*.doubleclick.net;
connect-src 'self' https://*.google-analytics.com https://*.googletagmanager.com;
```

The `'nonce-'` string is a placeholder — Jahia replaces it with a generated random value per request.

**References:**
- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- CSP Reference: https://content-security-policy.com/
