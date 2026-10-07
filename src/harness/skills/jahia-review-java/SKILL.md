---
name: jahia-review-java
description: Reviews a Jahia Java module (OSGi, JCR, Actions, servlets, GraphQL) in six passes — orientation, security surface, code health, build and packaging, documentation, tests — and writes a prioritised report in which every finding names its fix and its effort. Use after you write or change a Java module, or when asked to review or audit one, including a proof of concept.
argument-hint: "[path to the module]"
allowed-tools: Bash, Read, Glob, Grep
---

# Review a Jahia Java module

Write a review that the author can act on: every finding names the problem, the fix and the effort.
Leave style out, unless a configured linter rule fails the build.

Read `references/code-review-output.md` before you write the report.

## Modes

| Mode | When | Output |
| --- | --- | --- |
| Module review | A module in the working directory | `code-review-<artifactId>-<YYYY-MM-DD>.md` at the module root |
| Proof of concept | The developer calls the code a proof of concept | Same file. List risks, missing parts and open questions, framed as "next step: team decision", not as a production checklist. |
| Follow-up | A `code-review-*.md` already exists | Update that file: mark each finding fixed, deferred or still open, and add the new findings. |

Ask once if the mode is unclear.

## Pass 0 — Orient

Do not write anything for this pass.

- List the packages and what each holds: actions, servlets, services, GraphQL, filters, listeners.
- Read `pom.xml`, `README.md`, `AGENTS.md` and `docs/` when they exist.
- Read every `.cnd` file and every file under `META-INF/configurations/`.
- Note `Export-Package` and the public interfaces.

## Pass 1 — Security surface

For every Action, servlet, GraphQL field, filter and choicelist initializer, answer the four
questions of `jahia-java-security`: who can call it, what it does, what checks it, and whether the
choice is written down. Look in particular for:

- an Action with `setRequireAuthenticatedUser(false)` that writes content;
- an action that changes content and is whitelisted in `org.jahia.modules.jahiacsrfguard-*.cfg`;
- a system session on a node that the request chooses;
- a GraphQL mutation without `@GraphQLRequiresPermission`;
- an outbound HTTP call without timeouts, or to a host from the request.

## Pass 2 — Code health

- **OSGi** (`jahia-java-osgi`): mutable fields of a component without `volatile`, configuration
  read in several steps, `@Activate` that throws, `@Deactivate` that does not stop what was
  started, `SpringContextSingleton.getBean` in a method.
- **JCR** (`jahia-java-jcr`): wrong workspace or missing locale, session kept in a field or used
  from another thread, find-or-create without protection, query without a path restriction or
  with concatenated values, cleared locks.
- **Actions** (`jahia-dev-java`): an `ActionResult` returned where the client expects JSON, an
  exception that escapes `doExecute`, a parameter used without validation.
- **Errors:** an exception swallowed, a security check that fails open, a failure of a side effect
  (an email, a cache) that stops the main operation.
- **Design:** business logic in an Action or a servlet, one class with five jobs, an abstraction
  with a single implementation and no planned second one.
- **Leftovers:** `TODO`, `FIXME`, commented-out code that no ticket tracks.

## Pass 3 — Build and packaging

- The parent is `org.jahia.modules:jahia-modules`, and `<_dsannotations>*</_dsannotations>` is set.
- Every dependency that Jahia exports is `provided`. Each embedded library has a comment that says
  why. The parent embeds transitive dependencies too: check the size of the JAR.
- `Export-Package` lists API packages only.
- Every `Import-Package` override has a comment that says why.

## Pass 4 — Documentation

Compare the README, the docs and the comments with the code: URLs, action names, configuration
pids and keys, the "not implemented" claims, the known limitations. A risk present in the code and
absent from the known limitations is a finding.

## Pass 5 — Tests

- Is there a `src/test/java`? List the classes that are pure logic and have no test: parsers,
  calculators, caches.
- Is each HTTP surface checked after deployment (a curl script, a Cypress test)? Name the cases to
  cover: guest, logged-in user, wrong method, bad parameter.

## Pass 6 — Consolidate

- Merge duplicates: one finding, several places.
- Give each finding a severity and an effort (below).
- Sort, then build the summary table.

## Severity

| Level | Use for |
| --- | --- |
| 🔴 P0 | A security hole that is reachable, data loss, a check that fails open, a broken public contract |
| 🟠 P1 | A significant gap that is acceptable only as a documented risk, a silent partial failure |
| 🟡 P2 | Code health that gets worse over time, wrong documentation, critical paths without tests |
| 🟢 P3 | Refactoring and cleanup |

When in doubt, choose the lower level. Effort: XS (under 1 hour), S (half a day), M (2 days),
L (more).

## Rules

- Every finding ends with a fix: a code change, a ticket, or "accept and document".
- Say what you could not verify. An explicit unknown is better than a false certainty.
- Anchor code with `ClassName#methodName`, not with line numbers you did not check.
- Do not split one problem into several findings.
- With no finding in a pass, write nothing for it, or one line when the absence matters
  ("No concurrency finding: every component is stateless").
