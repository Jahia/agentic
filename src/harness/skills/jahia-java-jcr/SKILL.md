---
name: jahia-java-jcr
description: JCR patterns for Jahia Java development — correct usage of sessions, workspaces, node operations, mixins, locks, and versioning. Covers both the right approach and the pitfalls that cause data loss, security gaps, or concurrency bugs. Load when implementing or reviewing any class that reads or writes the JCR.
allowed-tools: Read
---

# JCR Patterns for Jahia Java

This skill covers how to use the JCR correctly in a Jahia Java module. Each section states the correct approach first, then the pitfall to avoid. Both developers and reviewers use this skill: developers to implement correctly from the start, reviewers to identify violations.

---

## Session lifecycle and workspace

### Correct approach

- **User session** (`JCRSessionWrapper` obtained from `JCRSessionFactory.getCurrentUserSession(workspace, locale)`) enforces ACLs. Use this for any operation that should respect the user's permissions.
- **System session** (`JCRTemplate.doExecuteWithSystemSession` or `JCRSessionFactory.getCurrentSystemSession`) bypasses ACLs. Use only when a permission check was performed earlier in the call chain and documented explicitly.
- **Workspace boundary.** `default` (edit workspace, where authors work) vs `live` (published, visitor-facing). Public-facing reads must use `live`. Admin UIs use `default`. Writes that must appear publicly go through `PublicationService` — never write to `live` directly unless you have a specific operational reason.
- **Locale.** `getCurrentUserSession(workspace, locale)` resolves i18n properties. Omitting the locale falls back to default — correct only if the caller truly does not need a specific locale.

### Pitfalls

- **System session without prior permission check.** When a system session performs an operation, trace back to where the target node ID came from. If it came from a user-session lookup with no further authorization check, the user-session lookup is the entire security boundary. Document this explicitly. If it is absent, it is a security finding.
- **Workspace mismatch.** Reading from `default` when rendering public pages, or writing to `live` when the intended target is `default`. Both produce silent wrong behavior.
- **Locale omission.** Calling without locale and reading `jcr:title` or any i18n property — the result is locale-nondeterministic.

---

## Node names — JSR-283 conformance

### Correct approach

Forbidden characters in a local name: `/ : [ ] | *`, plus whitespace-only names. Use `JCRContentUtils.escapeLocalNodeName` to sanitize any externally-supplied string before using it as a node name.

### Pitfall

Hand-rolled filename sanitization (regex replacements, `String.replace`) is almost always incomplete. The JSR-283 character set is non-obvious. Use the platform helper.

---

## Same-name siblings (SNS)

### Correct approach

Two children with the same name under the same parent are indexed `node[1]`, `node[2]`. If you need to find-or-create by name under concurrent load, either:
- Lock the parent node before the check-then-create sequence.
- Use a unique-by-construction name (UUID, slug+timestamp) and store the display name as a property.

### Pitfall

Unguarded find-or-create patterns under any concurrent caller (publication pipeline, event listener, HTTP endpoint) hit `ItemExistsException` or silently create a duplicate SNS node. Under guest endpoints this is a P1 finding.

---

## Mixin handling

### Correct approach

- Before setting properties specific to a mixin, call `node.addMixin("ns:myMixin")` if the node does not already have it.
- Use `node.isNodeType("ns:myMixin")` to classify behavior rather than switching on concrete node type strings from another module. This keeps the engine decoupled from specific UI modules.
- **Definition-level vs instance-level mixins.** Mixins applied in the CND definition are always present on every node of that type. Mixins added at runtime via `addMixin()` are instance-level — they must be captured and restored explicitly in any serialization/versioning path.

### Pitfalls

- Assuming a mixin is present because the content type "should" have it — this breaks when the content was created before the mixin was added to the definition.
- Hardcoded concrete node-type strings from another module (`fmdb:inputText`, `fmdb:textarea`). The correct pattern is classifying mixins in the engine's own CND.
- Serialization paths (export, versioning, diff) that capture `properties` but ignore `mixinNodeTypesNames` — instance-level mixin changes are silently lost on restore.

---

## Versioning and checkout

### Correct approach

Writing to a `mix:versionable` node requires a `checkout()` call first. After saving, call `checkin()` if the workflow requires it. Jahia's publication service handles this for standard publication flows — only write direct checkout/checkin in custom write paths.

### Pitfall

Writing to a versioned node without `checkout()` throws `VersionException`. Code that assumes the node is always in a checked-out state breaks whenever the publication service last left it checked in.

---

## Locking

### Correct approach

Respect existing locks before performing write operations. Before clearing a lock:
1. Check whether the lock is owned by the current operation or by an external caller (another user, a publication job, a workflow).
2. If the lock is external, **fail the operation** with a clear error — do not clear it silently and continue.
3. Document the thread-safety contract of any write path that involves locking.

### Pitfall

```java
// dangerous — clears locks unconditionally, continues even if clearing fails
JCRContentUtils.clearAllLocks(node);
restoreContent(node, version);
```

A node locked by an active publication job, a concurrent editor, or a workflow step is locked for a reason. Clearing it unconditionally can corrupt in-progress work. This is a P0 finding if the code ships to production; P1 if guarded by a feature flag that is off by default.

---

## JCR event listeners

### Correct approach

Register listeners in `@Activate` and unregister in `@Deactivate`. Use `JCRObservationManager` or Jahia's `DefaultEventListener` base class. Keep listeners short — heavy work should be dispatched to a separate thread or scheduled task.

Event listener disabling via `JCRObservationManager.setAllEventListenersDisabled(true)` is **thread-local** in Jahia, not global. It is safe to use inside a request thread or a background thread without affecting other concurrent threads.

### Pitfalls

- Listeners registered but never unregistered — accumulate across reactivations, causing duplicate event processing.
- Blocking I/O or JCR writes inside a synchronous event listener — holds the observation thread and causes lag across the entire event queue.

---

## `RepositoryException` handling

### Correct approach

- On a **security gate** (checking node type, checking permission): if the check throws, fail closed. Do not let the operation continue.
- On a **data read**: if partial results would be misleading downstream, fail or return an empty result with a logged warning.

### Pitfall

```java
try {
    requiresAuth = node.isNodeType("...");
} catch (RepositoryException e) {
    log.warn(...);
    return; // operation continues — fails open
}
```

Fail-open on a security gate is a P0 finding. Fail-open on a data read producing misleading partial state is P0 or P1 depending on downstream impact.

---

## JCR SQL2 queries

### Correct approach

- Scope queries with `ISDESCENDANTNODE(alias, '/sites/...')` — never query the entire repository.
- Use specific node types, not `nt:base`. Use `jmix:searchable` for broad content queries.
- Parameterize with bind variables, not string concatenation.
- Set a `LIMIT` on unbounded queries.

### Pitfall

`SELECT * FROM [nt:base]` against the full repository is a full-scan and blocks the query index. String-concatenated queries are a JCR injection vector (less critical than SQL injection but still wrong).
