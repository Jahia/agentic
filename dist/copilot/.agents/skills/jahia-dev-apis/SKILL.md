---
name: jahia-dev-apis
description: >
  Jahia 8.2 developer API reference covering GraphQL, JCR Java API, RESTful JCR access,
  OAuth/SAML authentication, personal API tokens, HTML filtering, and Content Security Policy.

  Trigger this skill when the user is:
  - Working with the Jahia GraphQL API (queries, mutations, schema extensions, Apollo client)
  - Using the JCR Java API to read/write content nodes
  - Accessing the RESTful JCR API or building JAX-RS endpoints
  - Setting up OAuth 2.0 (social login) or building a custom OAuth connector
  - Configuring SAML 2.0 authentication
  - Using the UPA (username/password + MFA) authentication module
  - Creating or using personal API tokens
  - Configuring HTML filtering (XSS protection) for content properties
  - Setting up a Content Security Policy (CSP) for a Jahia site
  - Configuring the security filter/service (API authorization, CORS, scopes)
  - Asking which Jahia API to use (GraphQL vs REST vs Actions)
allowed-tools: Read
---

# Jahia 8.2 Developer APIs

This skill covers all developer-facing APIs and security configuration in Jahia 8.2.

## Reference files

| File | When to use |
|------|-------------|
| `references/graphql.md` | GraphQL endpoint URL, JCR queries/mutations, schema extension (SDL + Java), connection/pagination pattern, Apollo client setup, CORS and auth config |
| `references/jcr-api.md` | Java JCR Session API (read/write nodes), auto-splitting, property interceptors, RESTful JCR access (REST endpoints, HAL+JSON), JAX-RS endpoint registration, Actions (legacy) |
| `references/authentication.md` | OAuth 2.0 social login modules, building a custom OAuth connector, SAML 2.0 setup, UPA (username/password + MFA) module, personal API tokens (create/use/manage via Groovy) |
| `references/security.md` | Security filter/service (scope-based authorization config), HTML filtering v2 (YAML config, strategies, workspace rules), Content Security Policy setup, JahiaUserManagerService |

## Quick API overview

| API | Endpoint / Access | Primary use case |
|-----|-------------------|------------------|
| GraphQL | `POST /modules/graphql` | Client-side apps, SPA; flexible queries, mutations, JCR node access, custom schema extension |
| RESTful JCR | `GET/PUT/DELETE /modules/api/jcr/v1/{workspace}/{lang}/nodes/{id}` | CRUD on JCR nodes via HTTP; useful for automation scripts and server-to-server calls |
| JAX-RS (custom REST) | Registered under `/modules/{alias}` via OSGi bundle directives | Custom REST endpoints packaged as Jahia modules |
| JCR Java API | `JCRTemplate.getInstance().doExecuteWithSystemSession(...)` | Server-side Java code; direct node manipulation inside modules |
| Actions | `POST /{path}.{actionName}.do` | Legacy: simple isolated server-side operations triggered from forms or rules |
| Personal API tokens | `Authorization: APIToken <token>` header | Authenticate API calls without credentials; scoped access |
| JWT tokens | `Authorization: Bearer <token>` header | Deprecated — use personal API tokens instead |

## Key Jahia-specific concepts

- **Workspaces**: `EDIT` (default) and `LIVE`. GraphQL queries default to `EDIT`; specify `jcr(workspace: LIVE)` for published content.
- **Security filter**: All APIs (GraphQL, REST, views) are closed by default. Access is granted via scope-based config files in `karaf/etc` with pattern `org.jahia.bundles.api.authorization-*.yml`.
- **Internationalization**: JCR sessions are opened in one language; GraphQL can query multiple languages in one call using `language:` arguments on individual fields.
- **Session save**: Every JCR write must end with `session.save()`. In GraphQL mutations, save is automatic at the end of each `mutation { jcr }` block.
