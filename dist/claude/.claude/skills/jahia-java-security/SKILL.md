---
name: jahia-java-security
description: Jahia security model for Java backend development — the four protection mechanisms (Security Filter, CSRF Guard, ACLs, captcha), when each applies, and how to audit or implement each correctly. Load when implementing or reviewing any HTTP-reachable surface in a Jahia Java module.
allowed-tools: Read
---

# Jahia Security Model for Java Backend

This skill covers how to correctly protect HTTP-reachable surfaces in a Jahia Java module. Each mechanism is described with its correct use, its limits, and the common mistakes that create vulnerabilities. Both developers and reviewers use this skill.

---

## The four protection mechanisms

Every reachable surface in a Jahia module is protected by zero, one, or several of these. Map each one explicitly for any surface you implement or review.

### 1. Jahia Security Filter (API scopes)

- **What:** OSGi-configurable filter that gates URL patterns by `Origin`/`Referer` and required permissions/scopes.
- **Config:** YAML under `META-INF/configurations/org.jahia.modules.api.permissions-*.yaml`.
- **Origin gating:** `auto_apply: - origin: hosted` ensures requests come from the same domain. Works for guests and authenticated users. Does not break CDN caching.
- **Permission gating:** `grants: - api: <name>; node: <selector>` enforces a Jahia permission.
- **When to use:** default protection for any module-exposed servlet or GraphQL endpoint reachable over HTTP. This is the first line of defense — apply it before considering CSRF Guard or inline checks.

### 2. CSRF Guard

- **What:** Jahia-wide servlet filter injecting a token into XHR/fetch and validating it server-side.
- **Critical limitation:** `jahia.csrf-guard.bypassForGuest = true` by default. CSRF Guard **does not protect guest submissions** out of the box. Enabling it for guests breaks CDN caching of public pages.
- **When to use:** authenticated-only operations where you can verify the URL pattern is in the guard's `resolvedUrlPatterns` config.
- **Common mistake:** assuming CSRF Guard protects a guest-reachable form. It does not — a guest submitting a public form bypasses CSRF Guard entirely.

### 3. Jahia permissions and ACLs

- **What:** JCR-based ACLs + named permissions declared in `permissions.xml` or `*.cnd`.
- **Enforcement:** `JCRSessionWrapper` (user session — permissions apply) vs `JCRSessionFactory.getCurrentSystemSession()` / `JCRTemplate.doExecuteWithSystemSession` (system session — permissions bypassed).
- **GraphQL:** `@GraphQLField` operations should declare `@RequirePermission` annotations. An admin operation without `@RequirePermission` is a finding.
- **When to use:** any operation that reads/writes JCR content with content-level access rules — jContent admin screens, content workflows, operations that respect site/node permissions.
- **Audit rule:** when code uses a system session, the security boundary is whatever check happened *before* the `doExecuteWithSystemSession` call. Find that check explicitly. If there is none, the operation is anonymous-privileged — P0 for writes, P1 for reads.

### 4. Captcha and one-time tokens

- **What:** non-replayable credentials tied to the rendering page.
- **When to use:** defense-in-depth against bots and as partial CSRF mitigation for guest forms.
- **Not a primary CSRF control.** Captcha protects a specific form when enabled, but it is not origin verification. Do not let a code path rely on captcha alone.

---

## Decision matrix

For each surface you implement or review, fill this in:

| Surface | Guests? | Auth users? | Side effects? | Required protection |
|---|---|---|---|---|
| Public form submit | Yes | Yes | Email, JCR write | Security Filter `origin: hosted` (primary) + captcha (defense-in-depth) |
| Admin GraphQL query | No | Yes (with permission) | Read JCR | Security Filter `origin: hosted` + `@RequirePermission(...)` |
| Admin GraphQL mutation | No | Yes (with permission) | Write JCR | Same + verify ACL when system session is used |
| OSGi servlet at `/modules/...` | Depends | Depends | Depends | At minimum: `origin: hosted` |
| Choicelist initializer | Indirect (editor UI) | Yes (editor) | Read config | Inherits editor auth — verify it does not leak cross-tenant data |

---

## Implementing a secure surface — checklist

When adding a new servlet, GraphQL operation, or filter:

1. **Declare the Security Filter scope** in `org.jahia.modules.api.permissions-*.yaml`.
2. **Classify the surface** in the decision matrix above.
3. **If writing JCR with a system session:** document the prior permission check in a Javadoc comment on the method.
4. **If the surface is public (guest-reachable):** do not rely on CSRF Guard alone. Use `origin: hosted` + captcha if the action has side effects.
5. **If the surface is admin-only:** add `@RequirePermission` to the GraphQL field or inline `JCRTemplate` ACL check.
6. **Document the intent.** A deliberate "this endpoint is public because X" must be in a Javadoc on the class or in `docs/security.md`. An undocumented gap is a finding even if intentional — the next maintainer cannot tell intent from accident.

---

## Findings to surface during review

1. **Unprotected endpoint.** Any servlet/GraphQL operation without a Security Filter scope **and** without `@RequirePermission` **and** without an inline auth check. P0 unless explicitly documented as intentionally public.
2. **CSRF Guard guest bypass misunderstood.** Code or docs claiming CSRF Guard protects guests. P0 — foundational misunderstanding.
3. **System session without prior permission check.** P0 for writes, P1 for reads.
4. **Captcha presented as primary CSRF defense.** P1 — it is defense-in-depth, not primary.
5. **Missing `@RequirePermission` on admin GraphQL.** P0 for mutations, P1 for sensitive-data queries.
6. **Permission referenced but not declared.** A permission name used in code or config that is not declared in any module resource. P1.
7. **Email recipients from user input.** Any `to:` address derived from a submitted field without an allowlist. P1 — open relay vector.
8. **Outbound HTTP without timeouts.** `HttpClient.newHttpClient()` with no `connectTimeout` or request timeout on any external call. P0 — trivial DoS.
