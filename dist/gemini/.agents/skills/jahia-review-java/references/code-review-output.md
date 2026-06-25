# Skill: Code Review Output Format

Load this skill before writing the review output. It defines the section order, finding template, and summary table schema.

## When to load

Always, just before writing the deliverable. Do not load during analysis passes.

## Output mode selection

Detect from context:

| Signal | Mode |
|---|---|
| GitHub MCP tools available + a PR number in context | **PR mode**: inline comments + one summary comment |
| Local filesystem only, module checked out, no PR | **File mode**: single markdown at repo root |
| A prior `code-review-*.md` exists in the repo | **Follow-up mode**: see `skills/review-followup/SKILL.md` |

When unclear, default to **File mode**.

## File naming (File mode)

`code-review-{module-name}-{YYYY-MM-DD}.md` at the module root. The module name comes from `pom.xml` `<artifactId>`.

If a review already exists for the same date, append `-v2`, `-v3`, etc. Do not overwrite without explicit instruction.

## Section order (mandatory)

```
# Code review — {module-name} (backend|frontend|fullstack)

- Date: YYYY-MM-DD
- Scope: {one line — what was reviewed, what was not}
- Out of scope: {one line — explicit exclusions}

{One short paragraph: overall posture. Lead with what is right; the findings list is for what is wrong. Do not pad.}

## 1. Security
## 2. API and backend design
## 3. Bugs and rough edges
## 4. Documentation and harness drift
## 5. Build, Maven, and OSGi packaging
## 6. OSGi and concurrency
## 7. Tests
## {N}. Prioritised summary
## {N+1}. Closing note
```

Omit sections with no findings — write "No findings." inline only if the absence itself is worth noting (e.g. "No concurrency findings — all `@Component` services are stateless.").

The Closing note is one paragraph. It names the single biggest risk and the single biggest strength. No bullet lists.

## Finding template

Each finding has the same shape:

```markdown
### {N.M} {Short title} — {severity emoji} P{0|1|2|3}

{One sentence: the problem.}

{2-6 sentences: why it matters, where it manifests, what triggers it. Code snippet if it clarifies in fewer words than prose.}

**Fix:** {Concrete action. Library name + method, or class change, or "accept and document".}

**Effort:** {XS | S | M | L}
```

Rules:

- **Severity emoji + level** in the heading. Never one without the other.
- **The problem in one sentence.** If you need a paragraph, you have not understood it yet.
- **Code snippets are quoted, not paraphrased.** If the bug is in three lines of code, show those three lines.
- **The Fix line is mandatory.** No exceptions. If there is no fix, the finding is "accept and document" — say so explicitly.
- **Effort is mandatory.** Authors prioritise by effort × severity. Without effort, the table is half-useless.

## Anchors

Use `ClassName#methodName` as the anchor for code references. Line numbers go stale; method names survive refactors. When a finding spans multiple files, list them under "Affected sites" inline.

## Severity rules

See the parent `AGENTS.md` severity table. One reminder: **the prioritised summary table is your honesty check**. If P0 has more than 5 items, you have inflated severity. Re-evaluate.

## Prioritised summary table

The penultimate section. Schema:

| Priority | Item | Effort |
|---|---|---|
| 🔴 P0 | {one-line description with §X.Y backref} | XS/S/M/L |
| ... |

Sort by priority, then by section number. P3 items can be grouped if numerous.

The backref (`§X.Y`) is mandatory — the reader uses the table as an index into the full findings.

## PR mode specifics

When posting to a PR:

- **Inline comments** for findings that point to a specific file/line span. Use the same finding template, condensed.
- **One summary comment** at the PR level containing:
  - The opening paragraph (overall posture).
  - The prioritised summary table.
  - Links to the inline comments via their permalinks.
- **No giant markdown dump in the summary comment.** Inline comments carry the body of each finding.

If a finding cannot be anchored to a line (e.g. "the module has no tests"), it goes only in the summary comment.

## Follow-up mode handoff

If a prior review exists, hand off to `skills/review-followup/SKILL.md`. Do not write a fresh review.

## What not to do

- Do not number findings across the whole document (e.g. "Finding 47"). Number within sections: §1.1, §1.2, §3.1.
- Do not split a finding into a "problem" finding and a "fix" finding. One finding = one problem + its fix.
- Do not write a "tl;dr" at the top. The opening paragraph is the tl;dr.
- Do not include process meta-commentary in the output ("During Pass 2 I noticed..."). The doc is for the author, not a log of your work.
- Do not write recommendations the author cannot act on alone. If a fix requires a product decision, name the decision; do not pretend it is purely technical.
