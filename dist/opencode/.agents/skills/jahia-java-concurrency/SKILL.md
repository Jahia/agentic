---
name: jahia-java-concurrency
description: Thread safety patterns for Jahia Java backend development in a multi-threaded web application. Covers volatile, locking, atomic variables, thread-safe collections, immutability, and common pitfalls that cause data races, stale reads, and silent corruption. Load when implementing or reviewing any class that holds mutable state accessible from multiple threads — OSGi services, caches, static fields, background workers, event listeners.
allowed-tools: Read
---

# Concurrency and Thread Safety for Jahia Java Backend

In a Jahia webapp, every OSGi service is a singleton — its instance fields are shared across every concurrent request, publication job, event listener, and background thread. A field that looks fine in a single-threaded test can silently corrupt data or read stale values under real load.

This skill covers the correct patterns and the pitfalls. Both developers and reviewers use it.

> OSGi-specific concurrency (`@Modified` config reload, `@Reference` dynamic rebinding) is covered in `/jahia-java-osgi`. This skill covers the general Java concurrency model applicable to all backend code.

---

## The three questions to ask about any mutable field

Before writing or reviewing any instance or static field in a service:

1. **Can it be written by more than one thread?** If yes → needs synchronization or an atomic type.
2. **Can it be read while another thread is writing it?** If yes → at minimum needs `volatile`.
3. **Are read + write part of a compound action** (check-then-act, read-modify-write)? If yes → `volatile` alone is not enough, needs a lock or an atomic with CAS.

---

## Immutability — the first line of defence

### Correct approach

Prefer immutable objects. An immutable object needs no synchronization — it is inherently thread-safe.

- Make fields `final` wherever possible.
- Use `record` types for config/value objects (all fields are final by definition).
- Use `List.of()`, `Map.of()`, `Set.of()` for collections that do not change after construction.
- Return copies or unmodifiable views of mutable internal collections rather than the live reference.

### Pitfall

```java
// dangerous — caller can mutate the internal list
public List<String> getAllowedRoles() {
    return allowedRoles; // returns live mutable reference
}
```

Return `Collections.unmodifiableList(allowedRoles)` or `List.copyOf(allowedRoles)` instead.

---

## `volatile` — correct use and limits

### Correct use

`volatile` guarantees **visibility**: a write to a `volatile` field is immediately visible to all subsequent reads in other threads. Use it when:

- One thread writes, many threads read (no compound action needed).
- The written value is a single reference or primitive (not two fields that must be updated atomically together).

```java
// correct — single writer (SCR @Modified), many readers
private volatile Config config;

@Activate @Modified
void activate(Cfg cfg) {
    this.config = new Config(cfg); // atomic reference swap
}
```

### Limits — volatile is NOT enough for compound actions

```java
// WRONG — read-modify-write is not atomic even with volatile
private volatile int counter = 0;
public void increment() {
    counter++; // read, increment, write — three steps, not one
}
```

Two threads can both read `counter = 5`, both compute `6`, and both write `6` — losing one increment. Use `AtomicInteger.incrementAndGet()` instead.

Similarly, volatile does not protect **two fields that must be consistent with each other**:

```java
// WRONG — reader can see updated 'host' with old 'port'
private volatile String host;
private volatile int port;
```

Bundle related fields into a single immutable record and swap the reference atomically (as shown in `/jahia-java-osgi`).

---

## Atomic variables

Use `java.util.concurrent.atomic` for lock-free, thread-safe single-value updates:

| Need | Type |
|---|---|
| Thread-safe counter | `AtomicInteger` / `AtomicLong` |
| Thread-safe reference swap | `AtomicReference<T>` |
| Conditional update (compare-and-swap) | `AtomicReference.compareAndSet()` |
| Accumulator under high contention | `LongAdder` (more scalable than `AtomicLong` for pure counting) |

### Check-then-act with `compareAndSet`

```java
// correct — atomic conditional update
AtomicReference<State> stateRef = new AtomicReference<>(State.IDLE);

public boolean tryStart() {
    return stateRef.compareAndSet(State.IDLE, State.RUNNING);
}
```

Two threads calling `tryStart()` concurrently: only one gets `true`. No lock needed.

---

## Synchronized blocks and `ReentrantLock`

### When to use

Use explicit locking when:
- The critical section spans multiple statements that must execute atomically.
- You need read/write distinction (`ReadWriteLock`).
- You need a timed or interruptible lock attempt (`ReentrantLock.tryLock(timeout)`).

### Correct approach

```java
// small, focused critical section
private final Object lock = new Object();
private List<String> items = new ArrayList<>();

public void addItem(String item) {
    synchronized (lock) {
        items.add(item);
    }
}

public List<String> snapshot() {
    synchronized (lock) {
        return List.copyOf(items); // return a copy, not the live list
    }
}
```

### Pitfalls

- **Locking on `this`.** Callers can also `synchronized(service)` from outside, causing unexpected contention or deadlock. Prefer a private `final Object lock`.
- **Holding a lock during I/O or JCR calls.** A lock held while doing a JCR query or an HTTP call blocks all other threads waiting for it. Move I/O outside the critical section; only protect the state mutation.
- **Inconsistent lock object.** Two methods protecting the same state must use the same lock.
- **Deadlock.** Two threads each holding lock A and waiting for lock B. Always acquire multiple locks in the same fixed order. Prefer `tryLock(timeout)` and fail gracefully rather than block indefinitely.

### `ReadWriteLock` for read-heavy state

```java
private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
private Map<String, String> cache = new HashMap<>();

public String get(String key) {
    rwLock.readLock().lock();
    try { return cache.get(key); }
    finally { rwLock.readLock().unlock(); }
}

public void put(String key, String value) {
    rwLock.writeLock().lock();
    try { cache.put(key, value); }
    finally { rwLock.writeLock().unlock(); }
}
```

Multiple readers proceed concurrently; a writer gets exclusive access. Worth the complexity only when reads heavily outnumber writes.

---

## Thread-safe collections

| Use case | Correct type | What NOT to use |
|---|---|---|
| Concurrent map (read-heavy or write-heavy) | `ConcurrentHashMap` | `HashMap` (not thread-safe), `Collections.synchronizedMap` (full lock on every op) |
| Concurrent list, infrequent writes | `CopyOnWriteArrayList` | `ArrayList`, `Collections.synchronizedList` |
| Concurrent queue / work queue | `LinkedBlockingQueue`, `ArrayBlockingQueue` | `LinkedList` |
| Set | `ConcurrentHashMap.newKeySet()` | `HashSet` |
| Cache with eviction | `Caffeine` or `Guava Cache` | `HashMap` with manual cleanup |

### Pitfall — compound actions on `ConcurrentHashMap`

```java
// WRONG — check-then-put is not atomic
if (!map.containsKey(key)) {
    map.put(key, value);
}
// CORRECT
map.putIfAbsent(key, value);
// or for a more complex compute:
map.computeIfAbsent(key, k -> expensiveCreate(k));
```

Even `ConcurrentHashMap` does not make compound actions atomic unless you use the atomic methods (`putIfAbsent`, `computeIfAbsent`, `merge`, `compute`).

---

## Static fields

### Pitfall

Static fields are shared across all class loader instances — effectively global state in a webapp. A static mutable field is the most dangerous form of shared state: it is not scoped to a component lifecycle, so it outlives bundle reactivations and can carry stale state.

```java
// dangerous — static mutable state in a webapp
private static Map<String, Object> cache = new HashMap<>();
```

**Rule:** static fields in a Jahia module must be either:
- `final` and truly immutable (constants, loggers), or
- `volatile` / concurrent-typed with documented thread-safety, or
- `ThreadLocal` (thread-scoped, not shared).

If you need a cache or shared service state, use an OSGi `@Component` instance field — the OSGi lifecycle manages it correctly.

---

## `ThreadLocal`

`ThreadLocal` gives each thread its own isolated copy of a variable. Correct for per-request state (locale, user context, transaction context).

### Pitfall — thread pool reuse

Jahia uses thread pools. A `ThreadLocal` set during request A and not cleared will be visible during a later request B handled by the same thread:

```java
// always clean up in a finally block
threadLocal.set(value);
try {
    doWork();
} finally {
    threadLocal.remove(); // mandatory
}
```

Failing to call `remove()` is a P1 finding — stale user context or locale leaked to subsequent requests.

---

## JCR sessions are NOT thread-safe

A `JCRSessionWrapper` must never be shared across threads. Do not store a session as an instance field of an OSGi service and reuse it across requests.

```java
// WRONG — shared session across threads
@Component
public class MyService {
    private JCRSessionWrapper session; // one session, all threads — crash under concurrency
}
```

Always obtain a fresh session per-thread (and per-locale where i18n matters) and close it in a `finally` block or via `JCRTemplate`.

---

## Lazy initialization

### Correct approach — `volatile` + double-checked locking

```java
private volatile ExpensiveObject instance;

public ExpensiveObject get() {
    if (instance == null) {                    // first check (no lock)
        synchronized (this) {
            if (instance == null) {            // second check (with lock)
                instance = new ExpensiveObject();
            }
        }
    }
    return instance;
}
```

Without `volatile`, the JVM may publish a partially-constructed object due to instruction reordering. **`volatile` on the field is mandatory for double-checked locking to be correct.**

### Simpler alternative — holder idiom

```java
// no synchronization needed — class loading is inherently thread-safe
private static class Holder {
    static final ExpensiveObject INSTANCE = new ExpensiveObject();
}
public static ExpensiveObject get() { return Holder.INSTANCE; }
```

---

## Review checklist

When reviewing any class in a Jahia module, check:

1. **Instance fields of `@Component` services** — are mutable ones `volatile`, atomic, or synchronized?
2. **Static mutable fields** — flag immediately; require justification and correct synchronization.
3. **Compound actions** — every check-then-act or read-modify-write on a shared field needs a lock or atomic CAS.
4. **Collections returned from getters** — are they copies or unmodifiable views?
5. **JCR sessions** — never stored as instance fields; always obtained and closed per-thread.
6. **`ThreadLocal`** — always cleaned up in a `finally` block.
7. **Locks** — held for the minimum possible time; no I/O inside a critical section.
8. **Undocumented thread-safety contract** — if the class is not internally thread-safe, its Javadoc must say so and name the required external synchronization.
