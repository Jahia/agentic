---
name: jahia-java-security
description: Who may call what a Jahia Java module exposes over HTTP — an Action (`.do`), a servlet, a GraphQL field — and how Jahia enforces it. Covers the requirements of an Action (authenticated user, permission, method, workspace), the CSRF guard and its whitelist, the API security filter scopes (`org.jahia.bundles.api.authorization-*.yml`), `@GraphQLRequiresPermission`, system sessions, and outbound calls. Load when you implement or review any HTTP-reachable surface of a Jahia Java module.
allowed-tools: Read
---

# Protect what a Jahia Java module exposes

For every surface that the module exposes, answer four questions, then apply the rules below:

1. **Who can call it?** Guests, logged-in users, users with a permission, administrators.
2. **What does it do?** Read, write content, send an email, call another server.
3. **What checks it?** The requirements of the Action, a permission on the node, a scope, the CSRF
   guard, a check in the code.
4. **Is the choice written down?** A comment on the class that says "open to guests, read-only,
   because …" tells the next developer that the choice was deliberate.

## Actions (`<node URL>.<name>.do`)

Jahia checks the requirements of an Action before `doExecute`. Set them in `@Activate`:

| Setter | Default | Effect |
| --- | --- | --- |
| `setRequireAuthenticatedUser(boolean)` | `true` | A guest gets an access-denied error. |
| `setRequiredPermission(String)` | none | The user must have the permission on the node of the URL. |
| `setRequiredMethods(String)` | `"POST"` | Any other HTTP method is refused. |
| `setRequiredWorkspace(String)` | none | The action answers only in that workspace. |

- **The node of the URL is chosen by the caller.** Jahia resolves it with the session of the user,
  so a user who cannot read a node cannot call the action on it. A check on the node that the action
  then changes is your job: `setRequiredPermission`, or `node.hasPermission("jcr:write")` in the
  code.
- **A read-only action may be open to guests**, with `GET`. Its answer must not depend on data that
  guests may not read.
- **An action that changes content uses `POST`**, requires an authenticated user, and requires a
  permission on the node.

## CSRF guard

The CSRF guard of Jahia checks every `.do` request of a **logged-in user**. The page must carry
the CSRF token, which the guard injects in the pages it serves to logged-in users (forms, links and
`XMLHttpRequest`/`fetch` headers). Guests are not checked: a guest has no rights that an attacker
could borrow.

- **A read-only action** called by scripts or by `fetch` can be whitelisted in the module, in
  `src/main/resources/META-INF/configurations/org.jahia.modules.jahiacsrfguard-<artifactId>.cfg`:
  ```
  whitelist = *.myAction.do
  ```
- **Never whitelist an action that changes content.** The whitelist removes the protection for
  every logged-in user, administrators included.
- The guard also refuses a `POST`, `PUT`, `DELETE` or `PATCH` that the browser marks as
  `Sec-Fetch-Site: cross-site`.

## API security filter (GraphQL, REST, views)

Jahia filters calls to its APIs (GraphQL, JCR REST, Ajax views) by **scopes**. A scope is granted
to a request by a token, or automatically, for example to calls that come from the same site.
Configuration files are `digital-factory-data/karaf/etc/org.jahia.bundles.api.authorization-*.yml`.
A module ships its own in `src/main/resources/META-INF/configurations/`:

```yaml
mymodule_public:
  description: Pages of this site may call the public fields of MyModule
  auto_apply:
    - origin: hosted
  grants:
    - api: graphql.Query.myModulePublicField
      node: none
```

- A request that holds no scope granting an API is refused.
- `origin: hosted` matches calls whose `Origin` or `Referer` is the Jahia server itself.
- An unknown key under `api` or `node` makes Jahia ignore the whole scope and log an error.
  Check the log after deployment.

## GraphQL fields

A field that a module adds to the GraphQL schema runs with the session of the caller. Protect an
administrative field with `@GraphQLRequiresPermission("permissionName")`
(`org.jahia.modules.graphql.provider.dxm.security`). A mutation without it, that writes with a
system session, is open to every caller that the security filter lets through.

## System sessions

A system session ignores permissions (`jahia-java-jcr`). When code uses one:

1. Find the check that happened before, in the same call chain, on the same node.
2. Without such a check, any caller of the surface reads or writes with every permission. For a
   write, that is the most severe finding a review can make.
3. Never take the path or the identifier of the node for a system session from a request parameter
   without a check of the user on that node.

## Outbound calls

- Set a connect timeout and a request timeout on every HTTP call (`jahia-dev-java`, section 6).
- Never build the target host from a request parameter. Keep the host in the code or in the
  configuration.
- Never send an email to an address taken from a request without a list of allowed recipients.
- Never write a secret (API key, password, token) to the log or to an answer.

## Review findings

| Finding | Severity |
| --- | --- |
| A surface that changes content with no authentication and no permission check | Highest |
| A system session on a node chosen by the caller, with no prior check | Highest for a write, high for a read |
| An action that changes content, whitelisted in the CSRF guard | High |
| A GraphQL mutation without `@GraphQLRequiresPermission` | High |
| An outbound HTTP call without timeouts | High |
| A guest-open surface, not documented as deliberate | Medium |
| A permission named in code that no module declares | Medium |
