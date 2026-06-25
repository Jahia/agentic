---
name: jahia-java-persistence
description: Persistence and data model patterns for Jahia Java backend — correct usage of JPA/Hibernate with JCR, N+1 avoidance, timestamp consistency, entity model decisions, transactional asymmetry between SQL and JCR, and locking/concurrency in write paths. Load when implementing or reviewing any class that interacts with a relational database alongside JCR.
allowed-tools: Read
---

# Persistence Patterns for Jahia Java Backend

This skill covers how to design and implement the persistence layer correctly when combining SQL (JPA/Hibernate) with JCR in a Jahia Java module. Each section states the correct approach first, then the pitfall. Both developers and reviewers use this skill.

---

## Sequence and counter columns

### Correct approach

Use the database's native mechanisms for generating ordered identifiers:
- `IDENTITY` / `AUTO_INCREMENT` on the primary key for insertion order.
- A `SEQUENCE` object (reserved inside a serialized transaction) if you need a stable ordering column separate from the PK.

### Pitfall

```java
// anti-pattern — read-then-act race
int max = repository.selectMaxNumber(contentId, locale); // SELECT MAX(...)
entity.setNumber(max + 1);
session.persist(entity);
```

Two concurrent inserts for the same `(contentId, locale)` read the same `MAX`, produce duplicate numbers, and either hit a unique constraint violation or silently corrupt ordering. Application-managed counters are never safe without explicit row-level locking. The counter column is also redundant if the primary key already provides insertion order.

**Finding level:** P1 for concurrent write paths; P2 if access is serialised by a documented higher-level lock, but that invariant must be documented.

---

## N+1 query patterns

### Correct approach

Load parent and child data in one round-trip:
- SQL: `JOIN` or a `WHERE id IN (...)` batch query.
- JPA: `JOIN FETCH` in JPQL or `@EntityGraph`.

### Pitfall

```java
// anti-pattern
List<Group> groups = repo.listGroups(contentId);       // 1 query
for (Group g : groups) {
    g.setVersions(repo.loadVersionsForGroup(g.getId())); // N queries
}
```

N+1 patterns are invisible in low-volume testing but degrade linearly under real content volumes. For unbounded lists (version history, publication logs) this becomes a UI performance cliff.

**Finding level:** P2 for capped lists; P1 for unbounded lists in hot paths.

---

## Timestamp consistency in batch operations

### Correct approach

Compute the timestamp **once** at the start of a logical operation and pass it to every entity created by that operation:

```java
Instant now = Instant.now(); // computed once
groupEntity.setCreatedAt(now);
for (var version : versions) {
    versionEntity.setCreatedAt(now); // same value for all
}
```

This makes "all entities from this operation" a trivial equality predicate: `WHERE operationId = ? AND createdAt = ?`. It also makes the audit trail semantically correct — these are one logical event, not N sequential events.

### Pitfall

Multiple independent `Instant.now()` calls within the same logical operation produce timestamp drift. Even millisecond drift means "show me all versions from this publish event" requires a range query with fuzzy bounds instead of equality. It also implies false ordering between things that are the same event.

**Finding level:** P2 — correctness and query simplicity. Elevate to P1 if the drift creates misleading audit trails.

---

## Entity model: when a separate table earns its keep

### Correct approach

A separate table/entity is justified when it carries state that would be annoyingly denormalised across every member row: operation type, author, workflow status, retry counters, approval metadata, referential integrity constraints.

If the only purpose of the separate table is to group rows (no meaningful payload of its own), a plain `operationId` UUID column on the member table is sufficient:
- "All operations for a content": `SELECT DISTINCT operationId, createdAt FROM NodeVersion WHERE contentId = ? ORDER BY createdAt DESC`
- "All versions of one operation": `SELECT * FROM NodeVersion WHERE operationId = ?`

Rule of thumb: defer extraction to a separate entity until the denormalised columns exceed 3–4 fields, or you need referential integrity on the operation itself (cascading, per-operation locks). The refactor is straightforward later — `INSERT ... SELECT DISTINCT` into the new table, add the FK, drop the denormalised columns.

### Pitfall

```java
// separate table with no meaningful payload — not justified yet
@Entity class NodeVersionGroupEntity {
    UUID id;
    UUID nodeUuid;       // duplicated from every member row
    Instant createdAt;   // drifts from member rows (see above)
    // nothing else
}
```

A correlation-only entity adds a table, a JOIN on every group query, a separate Hibernate lifecycle, and the risk of timestamp drift — for zero domain benefit until the group gains real state.

**Finding level:** P2 — surface as a design decision for the team, not a demand for immediate refactoring. Ask: does the group entity carry any state today? What is the expected evolution?

---

## Transactional asymmetry — mixed SQL + JCR stores

### Correct approach

SQL (Hibernate) and JCR do not share a transaction. Treat every mixed write path as requiring explicit reasoning about failure modes.

Options in order of preference:
1. **JCR as system of record:** write to JCR first; only commit to SQL after a successful `session.save()`. If the SQL commit fails, log the orphaned JCR state and add it to a retry or cleanup queue.
2. **Outbox pattern:** write to SQL only (including a status/outbox column); a separate process reads and applies the JCR write idempotently.
3. **Accept the asymmetry:** document the inconsistency window explicitly, add a compensating cleanup path, and add monitoring to detect orphaned rows.

### Pitfall

```java
repository.insertVersion(entity);    // SQL committed inside Hibernate session
jcrNode.setProperty("...", value);   // if this fails, SQL is already committed
session.save();
```

A failure in the JCR write leaves the SQL committed and the JCR unchanged — silent data inconsistency. Symptoms: rows in the DB with no corresponding JCR node, or vice versa.

**Finding level:** P1 — silent data inconsistency. Elevate to P0 if the inconsistency is user-visible or hard to detect.

---

## Locking and write paths

### Correct approach

Document the thread-safety contract of every write path that involves locking, restoration, or multi-step state transitions:
- Is the path safe to call concurrently? If not, what external lock must the caller hold?
- Does the path clear existing locks? If yes, whose lock? Under what conditions is clearing safe?

Before clearing a JCR lock in a write path:
1. Verify the lock is not owned by an unrelated operation (active publication job, workflow, concurrent editor).
2. If the lock is external, fail with a clear error — do not continue.

### Pitfall

```java
// dangerous — clears all locks unconditionally, continues even if clearing fails
JCRContentUtils.clearAllLocks(node);
restoreContent(node, version);
```

This pattern is dangerous in any path that is not the sole writer. A publication job in progress may have locked the node for a reason; clearing the lock and continuing the restore corrupts the publication. See also `jahia-java-jcr` locking section.

**Finding level:** P0 if active in production code; P1 if guarded by a feature flag off by default — but must appear in known-limitations/next-steps regardless.

---

## Schema documentation

### Correct approach

For any module that introduces relational tables, include a schema summary in `docs/` or a README section covering:
- Table names and purpose.
- Key column types and constraints (primary keys, foreign keys, unique constraints, indexed columns).
- How SQL tables relate to JCR nodes (which JCR property or node UUID maps to which SQL column).
- Any migration strategy for schema changes.

### Pitfall

Undocumented tables discovered by reviewing Hibernate entity classes alone — reviewers and future maintainers cannot verify the full schema from code without running the application and inspecting the DB. This is a P2 documentation finding.
