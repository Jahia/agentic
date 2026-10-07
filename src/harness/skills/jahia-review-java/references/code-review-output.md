# Output format of a Java review

Read this file just before you write the report, not during the passes.

## File

`code-review-<artifactId>-<YYYY-MM-DD>.md` at the module root. Take the artifactId from `pom.xml`.
If a review of the same date exists, add `-v2`, `-v3`. Never overwrite a review without being asked.

## Sections, in this order

```
# Code review — <artifactId>

- Date: YYYY-MM-DD
- Scope: <what was reviewed>
- Out of scope: <what was not>

<One short paragraph: the overall state. Start with what is right. The findings list what is wrong.>

## 1. Security
## 2. API and backend design
## 3. Bugs and rough edges
## 4. Documentation
## 5. Build, Maven and OSGi packaging
## 6. OSGi and concurrency
## 7. Tests
## 8. Prioritised summary
## 9. Closing note
```

Leave out a section with no finding. The closing note is one paragraph: the single biggest risk and
the single biggest strength.

## A finding

```markdown
### <N.M> <Short title> — <emoji> P<0-3>

<One sentence: the problem.>

<Two to six sentences: why it matters, where, and what triggers it. Quote the code when it is shorter than prose.>

**Fix:** <A concrete action: a class or method change, a library and its method, or "accept and document".>

**Effort:** <XS | S | M | L>
```

- The heading carries the emoji and the level together.
- Quote the code; do not paraphrase it.
- The **Fix** and **Effort** lines are mandatory.
- Number findings within their section: §1.1, §1.2, §3.1.

## Prioritised summary

| Priority | Item | Effort |
| --- | --- | --- |
| 🔴 P0 | <one line> (§1.2) | S |

Sort by priority, then by section. Every row links back to its finding (`§X.Y`). More than five P0
rows usually means the severities are inflated: check them again.

## Follow-up mode

Keep the structure of the previous file. Under each finding, add a line
`**Status (YYYY-MM-DD):** fixed | deferred | still open`, and add the new findings at the end of
their section.

## Do not

- write a "tl;dr": the first paragraph is the summary;
- describe your process ("during pass 2 I noticed…");
- recommend what the author cannot do alone: name the decision that someone else must take.
