# CND Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic CND skill with a sub-agent architecture that produces higher-quality CND files and self-validates its own output.

**Architecture:** A new `jahia-cnd-author` APM agent handles CND authoring in an isolated context window (no MCP tools, no content-creation noise). It loads CND syntax reference files on demand and calls a new `jahia-dev-review-cnd` skill for self-correction. The root `jahia-dev-define-content-type` skill becomes a thin orchestrator: capture spec → delegate to agent → deploy. The benchmark gains a static CND checker that scores runs on content model quality.

**Tech Stack:** APM `.agent.md` (sub-agent), APM `SKILL.md` (skill + references/), TypeScript (benchmark checker), Node.js fs/regex.

## Global Constraints

- All new harness files live under `src/harness/` — the build script treats this as `.apm/`
- SKILL.md files must stay under 500 lines / 5000 tokens (APM agent-skills spec)
- Agent `tools:` field must be a YAML mapping (`Read: true`), not a list
- `yarn lint && yarn build` must pass after every task
- No changes to `.claude/`, `.agents/`, or `dist/` — those are build outputs

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/harness/agents/jahia-cnd-author/jahia-cnd-author.agent.md` | Sub-agent that writes CND files in isolated context |
| Create | `src/harness/agents/jahia-cnd-author/references/cnd-string-selectors.md` | All string/choicelist/link property types |
| Create | `src/harness/agents/jahia-cnd-author/references/cnd-child-nodes.md` | Child node syntax and patterns |
| Create | `src/harness/agents/jahia-cnd-author/references/cnd-numbers-dates.md` | Numeric, date, boolean types + constraints |
| Create | `src/harness/agents/jahia-cnd-author/references/cnd-jahia-mixins.md` | Jahia-provided native mixins catalog |
| Create | `src/harness/skills/jahia-dev-review-cnd/SKILL.md` | Deterministic CND antipattern checker skill |
| Modify | `src/harness/skills/jahia-dev-define-content-type/SKILL.md` | Shorten to orchestrator; delegate to `@jahia-cnd-author` |
| Create | `src/harness/skills/jahia-dev-define-content-type/references/modeling-decisions.md` | Extracted modeling guidance (moved from SKILL.md) |
| Modify | `src/harness/instructions/jahia.instructions.md` | Add `jahia-dev-review-cnd` to skill map |
| Create | `src/benchmark/cnd-checker.ts` | Static CND antipattern analysis for benchmark scoring |
| Modify | `src/benchmark/types.ts` | Add `cndQualityScore` and `cndIssues` to `BenchmarkRun` |
| Modify | `src/benchmark/index.ts` | Call checker after agent run, store results |
| Modify | `src/benchmark/build-website.ts` | Display CND quality badge on run cards |

---

### Task 1: CND reference files for the author agent

Creates four focused reference files that the `jahia-cnd-author` agent loads on demand. Each covers exactly one syntactic domain. No narrative — just tables, examples, and rules.

**Files:**
- Create: `src/harness/agents/jahia-cnd-author/references/cnd-string-selectors.md`
- Create: `src/harness/agents/jahia-cnd-author/references/cnd-child-nodes.md`
- Create: `src/harness/agents/jahia-cnd-author/references/cnd-numbers-dates.md`
- Create: `src/harness/agents/jahia-cnd-author/references/cnd-jahia-mixins.md`

**Interfaces:**
- Produces: four `.md` files under `src/harness/agents/jahia-cnd-author/references/`
- Consumed by: `jahia-cnd-author.agent.md` (Task 2)

- [ ] **Step 1: Create `cnd-string-selectors.md`**

```markdown
# CND String & Selector Properties

## String type variants

| Type declaration | Editor widget | When to use |
|---|---|---|
| `(string)` | Single-line text input | Short labels, IDs, slugs |
| `(string, textarea)` | Multi-line text area | Paragraphs, descriptions |
| `(string, richtext)` | Rich text editor (TinyMCE) | Body content, formatted text |
| `(string) multiple` | Tag input / list | Lists of plain strings |

## Fixed-choice dropdowns

Use `(string, choicelist)` + `< 'val1', 'val2'` for a dropdown with a hard-coded list.
**Never use `choicelist[val1,val2]`** — the bracket syntax is for initializer keywords, not values.

```cnd
- difficulty (string, choicelist) i18n < 'beginner', 'intermediate', 'advanced'
- variant (string, choicelist) < 'primary', 'secondary', 'ghost'
```

## `mix:title` instead of a title string property

**NEVER write `- title (string) i18n mandatory`.**
Extend `mix:title` instead — it adds `jcr:title`, which Jahia's UI, breadcrumbs, and search use natively.

```cnd
// ✅ Correct
[ns:heroSection] > jnt:content, nsmix:component, mix:title

// ❌ Wrong — duplicates what mix:title already provides
[ns:heroSection] > jnt:content, nsmix:component
 - title (string) i18n mandatory
```

Access in the view as `props["jcr:title"]`.

## Link picker — `choicelist[linkTypeInitializer]`

**NEVER use `(string)` for a link, URL, href, or path.**
Use `choicelist[linkTypeInitializer]` — it renders an internal/external/none picker in the editor.

**Declare ONLY `j:linkType` in the CND. Do NOT add `j:linknode` or `j:url` — Jahia injects them automatically.**

```cnd
// ✅ Correct — bare minimum
[ns:callToAction] > jnt:content, nsmix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory

// ❌ Wrong — do not declare companion fields
 - j:linknode (weakreference)   // injected by Jahia — remove this
 - j:url (string)               // injected by Jahia — remove this
```

TypeScript discriminated union for the view:

```ts
import type { JCRNodeWrapper } from "org.jahia.services.content";
export type Props =
  | { label?: string; "j:linkType": "none" }
  | { label?: string; "j:linkType": "internal"; "j:linknode"?: JCRNodeWrapper }
  | { label?: string; "j:linkType": "external"; "j:url"?: string; "j:linkTitle"?: string };
```

In the view, switch on `props["j:linkType"]`.

## Other `choicelist[...]` initializers

| Initializer | What it renders |
|---|---|
| `choicelist[country]` | Country selector (ISO codes, localized labels) |
| `choicelist[resourceBundle]` | Labels from `.properties` file keys |
| `choicelist[nodes=/path;type=jnt:content]` | Nodes under a JCR path |
| `choicelist[componentTypes=jnt:page]` | Registered views of a node type |
| `choicelist[menus]` | Site menus |

## Regex constraints on strings

```cnd
- contactEmail (string) < '^$|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
- slug (string) < '^[a-z0-9-]+$'
- externalUrl (string) < '^https?://'
```

## Common attributes

| Attribute | Meaning |
|---|---|
| `i18n` | Translatable per language — **default to always on user-facing fields** |
| `mandatory` | Required |
| `multiple` | List of values |
| `primary` | Highlighted field in editor (one per type) |
| `autocreated` | Auto-created on node creation — always combine with `= 'defaultValue'` |
```

- [ ] **Step 2: Create `cnd-child-nodes.md`**

```markdown
# CND Child Nodes

## Syntax

```cnd
+ childName (ns:type)            // named child — exactly one
+ childName (ns:type) multiple   // named child — list
+ * (ns:type)                    // any-name child of a specific type
+ * (jmix:droppableContent)      // open container — any droppable component
```

## When to use child nodes vs `weakreference multiple`

| Use child nodes when… | Use `weakreference multiple` when… |
|---|---|
| Each item has multiple properties (label + link) | Each item is just a reference (a page, an image) |
| Items have no life outside the parent | Items are managed elsewhere and reused |
| You always create them together | Editors need to pick from existing content |

## Repeatable CTA pattern

**NEVER put `ctaText + ctaLink/ctaUrl` on the parent type as flat properties.**
Model CTAs as child nodes — editors can then add multiple CTAs.

```cnd
// ✅ Correct — supports multiple CTAs
[ns:heroSection] > jnt:content, nsmix:component, mix:title
 - subtitle (string, richtext) i18n
 - backgroundImage (weakreference, picker[type='image']) < jmix:image
 + * (ns:heroCallToAction)

[ns:heroCallToAction] > jnt:content, nsmix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory

// ❌ Wrong — forces exactly one CTA, editors can't add more
[ns:heroSection] > jnt:content, nsmix:component
 - ctaText (string) i18n
 - ctaLink (string) i18n       // also wrong type for links
```

## Ordering

Add `orderable` to the parent type when editors need to reorder children:

```cnd
[ns:featureList] > jnt:content, nsmix:component orderable
 + * (ns:featureItem)
```

## Hidden structural nodes

Child nodes that editors should never add manually (structural containers, auto-created nodes):

```cnd
[ns:heroSection] > jnt:content, nsmix:component, mix:title
 + ctaContainer (ns:ctaContainer) autocreated

[ns:ctaContainer] > jnt:content, jmix:hiddenType orderable
 + * (ns:callToAction)
```

`jmix:hiddenType` hides a type from the Page Builder component picker.
**Never use `jmix:studioOnly`** — it causes silent rendering issues.

## Open container (accept any droppable)

```cnd
[ns:gridRow] > jnt:content, nsmix:component
 - columns (long) = '3' autocreated mandatory < '1', '2', '3', '4'
 + * (jmix:droppableContent)
```

`+ * (jmix:droppableContent)` accepts any component the editor can drop.
```

- [ ] **Step 3: Create `cnd-numbers-dates.md`**

```markdown
# CND Numeric, Date & Boolean Properties

## Types

| Type | Editor widget | Notes |
|---|---|---|
| `long` | Integer number input | Counts, limits, columns |
| `double` | Decimal number input | Coordinates, prices, ratios |
| `boolean` | Checkbox | Feature flags, toggles |
| `date` | Date picker | ISO 8601 stored, string in TypeScript |
| `date, datepicker` | Date + time picker | Same storage, richer widget |

## Default values with `autocreated`

Always combine `autocreated` with `= 'value'`:

```cnd
- columns (long) = '3' autocreated mandatory < '1', '2', '3', '4'
- isHighlighted (boolean) = 'false' autocreated
- country (string, choicelist[country]) = 'US' autocreated mandatory
```

## Range constraints

```cnd
// Numeric range — inclusive brackets
- latitude (double) mandatory < "[-90,90]"
- longitude (double) mandatory < "[-180,180]"
- rating (long) mandatory < "[1,5]"
```

## Date range constraints

Parentheses = exclusive bound, brackets = inclusive. Leave a side empty for open-ended:

```cnd
// Any date after 2020-01-01 (exclusive)
- eventDate (date, datepicker) < '(2020-01-01T00:00:00.000,)'

// Bounded campaign window
- campaignDate (date, datepicker) < '(2020-01-01T00:00:00.000,2030-12-31T00:00:00.000)'
```

## TypeScript mapping

| CND type | TypeScript |
|---|---|
| `long` | `number` |
| `double` | `number` |
| `boolean` | `boolean` |
| `date` | `string` (ISO 8601) |
```

- [ ] **Step 4: Create `cnd-jahia-mixins.md`**

```markdown
# Jahia Native Mixins & Types

Source: https://github.com/Jahia/jahia/tree/master/war/src/main/webapp/WEB-INF/etc/repository/nodetypes
Fetch this URL to verify before using any mixin not listed here.

## Base types — always extend these

| Type | Purpose |
|---|---|
| `jnt:content` | Base for all user content nodes — **always include** |
| `jnt:page` | Page node — only for `jmix:mainResource` full-page types |
| `jnt:file` | File node — for file references |

## Mixins by use case

### `mix:title` — preferred over a raw title property

Adds `jcr:title` (string). Jahia's UI, breadcrumbs, SEO, and sitemap generation all read `jcr:title`.
**Extend this instead of declaring `- title (string) i18n mandatory`.**

```cnd
[ns:article] > jnt:content, nsmix:component, mix:title
```

Access in view: `props["jcr:title"]`

### `jmix:mainResource` — full-page content types only

Makes a node accessible at its own URL. Use **only** for content that needs both a listing card AND a detail page (e.g. blog posts, team members, events). Do not add to navigation or visual composition types.

```cnd
[ns:blogPost] > jnt:content, mix:title, jmix:mainResource, nsmix:component
```

### `jmix:image` — image constraint for weakreference

Use as the type constraint on image weakreference properties:

```cnd
- backgroundImage (weakreference, picker[type='image']) < jmix:image
```

**Never use `< 'jnt:file'`** (quoted string form) — it does not enforce image type correctly.

### `jmix:droppableContent` — never extend directly

Always define a module-level component mixin and extend that:

```cnd
// In settings/definitions.cnd
[nsmix:component] > jmix:droppableContent, jmix:accessControllableContent mixin
```

Then all component types extend `nsmix:component`.

### `jmix:hiddenType` — hide from Page Builder picker

Structural/container types editors should not add manually:

```cnd
[ns:ctaContainer] > jnt:content, jmix:hiddenType orderable
```

**Never use `jmix:studioOnly`** — it causes silent rendering issues in some contexts.

### `jmix:accessControllableContent` — per-component access control

Add to your base module mixin so all components support it:

```cnd
[nsmix:component] > jmix:droppableContent, jmix:accessControllableContent mixin
```

### `jmix:link` — built-in link type

Provides `j:linkType`, `j:linknode`, `j:url`, `j:linkTitle`. Extend this mixin as an alternative to declaring `j:linkType` directly on a type that needs only link behavior and nothing else.

## picker[] selector

| Selector | Use |
|---|---|
| `picker[type='image']` | Image assets only |
| `picker[type='file']` | Any file asset |

```cnd
- backgroundImage (weakreference, picker[type='image']) < jmix:image
- attachment (weakreference, picker[type='file']) < jnt:file
```

## Two-tier component mixin system

If the module uses custom area types (see `jahia-dev-create-page-template`):

```cnd
[nsmix:component]     > jmix:droppableContent, jmix:accessControllableContent mixin
[nsmix:pageComponent] > nsmix:component mixin
```

| Component will be… | Extend |
|---|---|
| Dropped in page areas | `nsmix:pageComponent` |
| Child of another component | `nsmix:component` |
| Listed programmatically | `nsmix:component` |

A component extending only `nsmix:component` **cannot** be dropped in areas that use `nsmix:pageComponent`.
```

- [ ] **Step 5: Verify files exist**

```bash
ls src/harness/agents/jahia-cnd-author/references/
# Expected: cnd-string-selectors.md  cnd-child-nodes.md  cnd-numbers-dates.md  cnd-jahia-mixins.md
```

- [ ] **Step 6: Commit**

```bash
git add src/harness/agents/jahia-cnd-author/references/
git commit -m "feat: add CND reference files for jahia-cnd-author agent"
```

---

### Task 2: Create the `jahia-cnd-author` sub-agent

The agent that owns CND authoring. Runs in an isolated context window with no MCP tools. Receives a structured spec, loads the reference files it needs, writes the CND + types.ts, then self-validates.

**Files:**
- Create: `src/harness/agents/jahia-cnd-author/jahia-cnd-author.agent.md`

**Interfaces:**
- Consumes: structured spec from root skill (component name, fields, usage, namespace prefix, module path)
- Produces: `definition.cnd` + `types.ts` written to disk, then `/jahia-dev-review-cnd` result

- [ ] **Step 1: Write the agent file**

```markdown
---
name: jahia-cnd-author
description: Use when you need to write a Jahia CND content type definition and its TypeScript props interface. Receives a component spec and produces definition.cnd + types.ts with correct Jahia-specific syntax. Loads syntax references on demand, self-validates output with /jahia-dev-review-cnd before returning.
tools:
  Read: true
  Write: true
  Edit: true
  Bash: true
---

You are a Jahia CND specialist. Your sole job is to write correct `definition.cnd` and `types.ts` files for a single component type. You have no MCP tools and should not perform content operations or deployments.

## Your inputs

You will receive a structured spec:

```
Component: <name>
Namespace prefix: <ns>
Module path: <path to module root>
Fields:
  - <field name>: <type description> [mandatory] [i18n] [multiple]
Usage: <where this component appears>
Children: <repeatable sub-items if any>
```

## Step 1 — Load reference files

Before writing any CND, load the reference files for the property types you need:

- **Always load**: `LOAD references/cnd-jahia-mixins.md` (you always need to know which native mixins to extend)
- **If any text, link, or choice properties**: `LOAD references/cnd-string-selectors.md`
- **If any repeatable child items**: `LOAD references/cnd-child-nodes.md`
- **If any numbers, dates, or booleans**: `LOAD references/cnd-numbers-dates.md`

## Step 2 — Resolve namespace and location

```bash
grep -h "^<" <module-path>/settings/definitions.cnd | head -1
```

This shows the namespace declaration (e.g. `<forsure = 'http://www.forsure.com/...'>` → prefix is `forsure`).

Check whether the module uses a two-tier mixin (`namespacemix:pageComponent` vs `namespacemix:component`):

```bash
grep "pageComponent" <module-path>/settings/definitions.cnd
```

If `pageComponent` exists, components dropped in page areas extend `namespacemix:pageComponent`. Children of other components extend `namespacemix:component`.

Component file location: `<module-path>/src/components/<Category>/<Name>/definition.cnd`
Types file location: `<module-path>/src/components/<Category>/<Name>/types.ts`

## Step 3 — Write the CND

Rules you MUST follow:
1. **Links**: use `j:linkType (string, choicelist[linkTypeInitializer]) mandatory` — never `(string)` for a link/url/href
2. **Titles**: extend `mix:title` — never `- title (string) i18n mandatory`
3. **Repeatable CTAs**: model as child nodes `+ * (ns:ctaType)` — never `ctaText + ctaLink` on the parent
4. **Image references**: `(weakreference, picker[type='image']) < jmix:image` — never `< 'jnt:file'`
5. **i18n**: add `i18n` to every user-facing string/textarea/richtext property
6. **Component mixin**: extend `namespacemix:component` or `namespacemix:pageComponent` — never `jmix:droppableContent` directly
7. **No studioOnly**: use `jmix:hiddenType` for hidden structural types

## Step 4 — Write types.ts

Map each CND property to a TypeScript type. All fields use `?:` (optional) even if mandatory in CND.

```ts
import type { JCRNodeWrapper } from "org.jahia.services.content";

export interface Props {
  // list each property
  fieldName?: TypeScriptType;
}
```

For `j:linkType` properties, use the discriminated union from `references/cnd-string-selectors.md`.

## Step 5 — Self-validate

After writing both files, invoke `/jahia-dev-review-cnd` passing the path to `definition.cnd`.

If the review reports errors: fix them and re-run until PASS.
If the review reports only warnings: fix them if the fix is obvious, otherwise note them in your output.

## Step 6 — Report

Output a summary:
- Files written: paths
- Type name(s) defined
- Review result (PASS / PASS with warnings / issues fixed)
- Any warnings not fixed and why
```

- [ ] **Step 2: Verify the agent file path**

```bash
ls src/harness/agents/jahia-cnd-author/
# Expected: jahia-cnd-author.agent.md  references/
```

- [ ] **Step 3: Commit**

```bash
git add src/harness/agents/jahia-cnd-author/jahia-cnd-author.agent.md
git commit -m "feat: add jahia-cnd-author sub-agent for isolated CND authoring"
```

---

### Task 3: Create `jahia-dev-review-cnd` skill

A deterministic CND quality checker. Scans CND files for known antipatterns, reports findings with specific fixes. Used by the `jahia-cnd-author` agent for self-correction and available as a standalone skill.

**Files:**
- Create: `src/harness/skills/jahia-dev-review-cnd/SKILL.md`

**Interfaces:**
- Consumes: path to a `definition.cnd` file (or the current module root to find all CND files)
- Produces: PASS / FAIL report with file:line, pattern name, message, and fix

- [ ] **Step 1: Write the skill**

```markdown
---
name: jahia-dev-review-cnd
description: Use after writing any CND file to validate it against Jahia best practices. Checks for known antipatterns and reports file:line citations with specific fixes. Run /jahia-dev-review-cnd <path-to-definition.cnd> to check a specific file, or without arguments to check all CND files in the current module.
allowed-tools: Read, Bash
---

## Overview

Scans CND files for antipatterns that produce broken or low-quality content models. Reports findings as PASS, WARN, or FAIL with a concrete fix for each issue.

## Step 1 — Locate CND files

If a specific file was given, check only that file.
Otherwise, find all definition.cnd files in the module:

```bash
find . -name "definition.cnd" -not -path "*/node_modules/*" -not -path "*/.git/*"
```

## Step 2 — Check each file against the antipattern list

Read each file and apply every check below. For each issue found, record:
- `file`: relative file path
- `line`: line number
- `pattern`: antipattern name (from the list below)
- `message`: what's wrong
- `fix`: exact correction

---

### Error: `rawStringLink`

**Trigger**: A property whose name contains `link`, `url`, `href`, or `path` declared as `(string)` or `(string, textarea)`.

```
- ctaLink (string) i18n         ← ERROR
- externalUrl (string)          ← ERROR
- redirectPath (string)         ← ERROR
```

**Fix**: Replace with the link picker pattern:
```cnd
- j:linkType (string, choicelist[linkTypeInitializer]) mandatory
// Do NOT add j:linknode or j:url — Jahia injects them
```

---

### Error: `singleHardcodedCta`

**Trigger**: A type that declares both a CTA label property (`ctaText`, `ctaLabel`, `buttonText`, `buttonLabel`) AND a CTA link property (`ctaLink`, `ctaUrl`, `ctaHref`, `buttonLink`) as flat properties, with no child node definition (`+ ...`) on the type.

**Fix**: Remove both properties from the parent. Add a child node definition and a separate CTA child type:
```cnd
+ * (ns:cta)

[ns:cta] > jnt:content, nsmix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory
```

---

### Error: `directDroppable`

**Trigger**: A concrete type declaration (not a `mixin`) that extends `jmix:droppableContent` directly.

```
[ns:hero] > jnt:content, jmix:droppableContent   ← ERROR
```

**Fix**: Extend the module's component mixin instead:
```cnd
[ns:hero] > jnt:content, nsmix:component
```

---

### Warning: `rawTitleProp`

**Trigger**: A property named `title`, `heroTitle`, `pageTitle`, `sectionTitle`, or `name` typed as `(string)`.

**Fix**: Remove the property and extend `mix:title` on the type declaration. Access as `props["jcr:title"]` in the view.

---

### Warning: `weakrefNoConstraint`

**Trigger**: A `(weakreference)` property with no `< ` type constraint.

**Fix**: Add the appropriate constraint:
- For images: `(weakreference, picker[type='image']) < jmix:image`
- For files: `(weakreference, picker[type='file']) < jnt:file`
- For pages: `(weakreference) < jnt:page`

---

### Warning: `weakrefWrongConstraint`

**Trigger**: A weakreference with `< 'jnt:file'` (value in quotes).

```
- image (weakreference) < 'jnt:file'   ← WARNING
```

**Fix**: Use unquoted type constraint for images:
```cnd
- image (weakreference, picker[type='image']) < jmix:image
```

---

### Warning: `missingI18n`

**Trigger**: A `(string)`, `(string, textarea)`, or `(string, richtext)` property whose name contains `title`, `text`, `label`, `description`, `subtitle`, `caption`, `alt`, `heading`, `summary`, `excerpt`, or `body` — but does not have `i18n` declared.

**Fix**: Add `i18n` after the type declaration:
```cnd
- heroSubtitle (string, richtext) i18n   ← correct
```

---

### Warning: `studioOnly`

**Trigger**: Any reference to `jmix:studioOnly`.

**Fix**: Replace with `jmix:hiddenType`.

---

## Step 3 — Report

After checking all files, output:

```
CND Review: <N> files checked

ERRORS (<count>):
  [rawStringLink] src/components/Hero/definition.cnd:8
    Property "ctaLink" uses (string) for a link
    Fix: - j:linkType (string, choicelist[linkTypeInitializer]) mandatory

WARNINGS (<count>):
  ...

Result: PASS | PASS (with warnings) | FAIL
```

- **FAIL** = any errors. Do not proceed until errors are fixed.
- **PASS (with warnings)** = no errors, some warnings. Fix obvious ones; note the rest.
- **PASS** = no issues found.
```

- [ ] **Step 2: Verify file**

```bash
ls src/harness/skills/jahia-dev-review-cnd/
# Expected: SKILL.md
```

- [ ] **Step 3: Commit**

```bash
git add src/harness/skills/jahia-dev-review-cnd/SKILL.md
git commit -m "feat: add jahia-dev-review-cnd skill for CND self-validation"
```

---

### Task 4: Refactor `jahia-dev-define-content-type`

Shorten the skill to an orchestrator. Remove all CND syntax content (it moves to the agent's references). Add delegation to `@jahia-cnd-author`. Move modeling guidance to a references file.

**Files:**
- Modify: `src/harness/skills/jahia-dev-define-content-type/SKILL.md`
- Create: `src/harness/skills/jahia-dev-define-content-type/references/modeling-decisions.md`

**Interfaces:**
- Consumes: user request (natural language description of a component)
- Produces: structured spec → delegates to `@jahia-cnd-author`

- [ ] **Step 1: Create `references/modeling-decisions.md`**

Extract the modeling guidance from the current SKILL.md (sections "Semantic vs generic types", "Children vs weakreference", "Mixins are the primary reuse mechanism", "Two-tier mixin system"):

```markdown
# CND Modeling Decisions

## Semantic vs generic types

| Use **semantic types** for… | Use **generic types** for… |
|---|---|
| Business entities: articles, team members, events | Visual composition: banners, feature rows |
| Items that appear in listings | One-off sections, layout containers |
| Anything reused across pages | Unique per-page UI blocks |

## Children vs weakreference

| Use **child nodes** when… | Use **weakreference** when… |
|---|---|
| Parent is the visual container (e.g. CTA buttons inside a hero) | Linking to content managed elsewhere |
| Children have no life outside the parent | Many-to-many relationships |
| You always create the children together | Content editors need to reuse the referenced item |
| Each item has multiple properties (label + link) | Each item is just a reference (a page, an image) |

## Mixins are the primary reuse mechanism

Whenever a set of properties appears on more than one type, extract them into a mixin in `settings/definitions.cnd`.

Common reusable mixin patterns:

| Mixin | Properties it adds | When to use |
|---|---|---|
| `nsmix:cta` | `ctaLabel`, `j:linkType` | Any type with a button or link |
| `nsmix:badge` | `badgeText`, `badgeColor` | Cards, teasers, labelled content |
| `nsmix:seo` | `metaTitle`, `metaDescription` | Any `jmix:mainResource` type |
| `nsmix:media` | `image` (weakreference), `imageAltText` | Any type with a visual asset |

Example reusable CTA mixin:

```cnd
[nsmix:cta] mixin
 - ctaLabel (string) i18n
 - j:linkType (string, choicelist[linkTypeInitializer]) = 'none' autocreated mandatory
 // j:linknode and j:url are injected automatically
```

Any component that needs a CTA extends `nsmix:cta` — no property duplication.

## `jmix:mainResource` — when NOT to use it

Only for content that needs **both** a listing card AND a full detail page (e.g. blog posts, events).
Do NOT add to: navigation-only types, visual composition components, containers.

## Component location

- **Component-level** (preferred): `src/components/<Category>/<Name>/definition.cnd`
- **Module-level**: `settings/definitions.cnd` (for mixins and shared base types only)
```

- [ ] **Step 2: Rewrite `SKILL.md` as a thin orchestrator**

Replace the entire file with:

```markdown
---
name: jahia-dev-define-content-type
description: Creates a Jahia CND content type definition from a natural language description. Use when asked to model content, create a new content type, or define node types.
allowed-tools: Bash, Read
---

## Overview

Orchestrates CND authoring by delegating to the `@jahia-cnd-author` sub-agent, which handles all CND syntax in an isolated context window. Your job here is to capture the spec and assemble the delegation call.

---

## Step 0 — Capture the spec

Confirm with the user (or infer from context):

| Field | Answer |
|---|---|
| **Component name** | e.g. `HeroSection` |
| **Description** | What is this type for? |
| **Fields** | name / type / i18n? / mandatory? |
| **Repeatable children?** | CTA buttons, feature items, testimonials? |
| **Views** | default only, or also: card / fullPage |
| **Used where** | In a page area? Child of another component? |

For modeling decisions (semantic vs generic, children vs weakreference, mixin extraction), LOAD references/modeling-decisions.md.

---

## Step 1 — Resolve module context

```bash
# Get namespace prefix
grep -h "^<" settings/definitions.cnd | head -1

# Check for two-tier mixin (pageComponent)
grep "pageComponent" settings/definitions.cnd
```

---

## Step 2 — Delegate to `@jahia-cnd-author`

Invoke the sub-agent with the complete structured spec:

```
@jahia-cnd-author

Component: <PascalCase name>
Namespace prefix: <ns>
Module path: <absolute path to module root>
Fields:
  - <fieldName>: <type description> [mandatory] [i18n] [multiple]
  - ... (one line per field)
Children: <describe any repeatable sub-items, e.g. "CTA buttons with label + link">
Usage: <where this component appears, e.g. "dropped in page areas">
```

Wait for the agent to report back before proceeding.

---

## Step 3 — Continue with deployment

After `@jahia-cnd-author` reports PASS, proceed with:
- Add UI translations (`/jahia-dev-build-component` handles this if invoked from there)
- `yarn build && yarn jahia-deploy`
- Verify the type appears in Jahia's content editor

---

## Validation checklist

- [ ] Spec confirmed before delegation
- [ ] `@jahia-cnd-author` reported PASS (no errors)
- [ ] Translation keys added to `.properties` files
- [ ] Icon created at `settings/content-types-icons/<ns>_<typeName>.png`
- [ ] `yarn build && yarn jahia-deploy` succeeded
- [ ] Type appears in Jahia content editor with correct label and icon
```

- [ ] **Step 3: Verify line count stays under 500**

```bash
wc -l src/harness/skills/jahia-dev-define-content-type/SKILL.md
# Expected: < 80 lines
```

- [ ] **Step 4: Commit**

```bash
git add src/harness/skills/jahia-dev-define-content-type/
git commit -m "refactor: slim down jahia-dev-define-content-type, delegate CND authoring to sub-agent"
```

---

### Task 5: Update global instructions

Add `jahia-dev-review-cnd` to the skill map in `jahia.instructions.md`.

**Files:**
- Modify: `src/harness/instructions/jahia.instructions.md`

**Interfaces:**
- Consumes: existing skill map table
- Produces: `jahia-dev-review-cnd` visible to agents that read the instructions

- [ ] **Step 1: Add the skill to the Development table**

In the Development skill map table, add a row after `/jahia-dev-define-content-type`:

```
| `/jahia-dev-review-cnd` | Validate a CND file for antipatterns — run after writing any CND |
```

- [ ] **Step 2: Commit**

```bash
git add src/harness/instructions/jahia.instructions.md
git commit -m "feat: add jahia-dev-review-cnd to skill map in global instructions"
```

---

### Task 6: Benchmark CND quality assessment

Adds static CND analysis to the benchmark. Scores CND quality using the same antipatterns as the review skill. Results stored in `BenchmarkRun` and displayed in the website generator.

**Files:**
- Create: `src/benchmark/cnd-checker.ts`
- Modify: `src/benchmark/types.ts`
- Modify: `src/benchmark/index.ts`
- Modify: `src/benchmark/build-website.ts`

**Interfaces:**
- `checkCndFiles(projectDir: string): CndCheckResult` — called from `index.ts`
- `CndCheckResult` stored in `BenchmarkRun.cndQualityScore` + `BenchmarkRun.cndIssues`

- [ ] **Step 1: Create `src/benchmark/cnd-checker.ts`**

```typescript
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface CndIssue {
  severity: "error" | "warning";
  file: string;
  line?: number;
  pattern: string;
  message: string;
  fix: string;
}

export interface CndCheckResult {
  score: number; // 0–1, same exponential decay formula as accessibility
  issues: CndIssue[];
  filesChecked: number;
}

function findCndFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    try {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
          walk(join(current, entry.name));
        } else if (entry.isFile() && entry.name.endsWith(".cnd")) {
          results.push(join(current, entry.name));
        }
      }
    } catch {
      // skip unreadable directories
    }
  }
  walk(dir);
  return results;
}

function checkFile(filePath: string, content: string): CndIssue[] {
  const issues: CndIssue[] = [];
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("<")) return;

    // rawStringLink
    if (/^-\s+\w*(link|url|href|path)\w*\s+\(string[,)]/i.test(trimmed)) {
      const propName = trimmed.match(/^-\s+(\w+)/)?.[1] ?? "unknown";
      issues.push({
        severity: "error",
        file: filePath,
        line: lineNum,
        pattern: "rawStringLink",
        message: `"${propName}" uses (string) for a link/url — use choicelist[linkTypeInitializer]`,
        fix: "Replace with: - j:linkType (string, choicelist[linkTypeInitializer]) mandatory",
      });
    }

    // rawTitleProp
    if (/^-\s+(title|heroTitle|pageTitle|sectionTitle)\s+\(string[,)]/i.test(trimmed)) {
      const propName = trimmed.match(/^-\s+(\w+)/)?.[1] ?? "unknown";
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "rawTitleProp",
        message: `"${propName}" is a plain string — extend mix:title instead`,
        fix: "Add mix:title to the type declaration and remove this property",
      });
    }

    // weakrefNoConstraint: (weakreference) with no < constraint on same line
    if (/\(weakreference[,)]/.test(trimmed) && !/<\s/.test(trimmed)) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "weakrefNoConstraint",
        message: "Unconstrained weakreference — add a type constraint",
        fix: "Add e.g. (weakreference, picker[type='image']) < jmix:image",
      });
    }

    // weakrefWrongConstraint
    if (/< ['"]jnt:file['"]/.test(trimmed)) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "weakrefWrongConstraint",
        message: "< 'jnt:file' (quoted) does not enforce image type",
        fix: "Replace with < jmix:image for images",
      });
    }

    // missingI18n: user-visible string without i18n
    if (
      /^-\s+\w+\s+\(string(,\s*(textarea|richtext))?[,)]/.test(trimmed) &&
      !/ i18n/.test(trimmed) &&
      !/^-\s+j:/.test(trimmed) &&
      /(title|text|label|description|subtitle|caption|alt|heading|summary|excerpt|body)/i.test(trimmed)
    ) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "missingI18n",
        message: "User-visible string property missing i18n",
        fix: "Add i18n keyword after the type declaration",
      });
    }

    // directDroppable: concrete type (not mixin) extending jmix:droppableContent
    if (/^\[/.test(trimmed) && /jmix:droppableContent/.test(trimmed) && !/\bmixin\b/.test(trimmed)) {
      issues.push({
        severity: "error",
        file: filePath,
        line: lineNum,
        pattern: "directDroppable",
        message: "Extends jmix:droppableContent directly — always extend the module component mixin",
        fix: "Replace jmix:droppableContent with nsmix:component (or your module's equivalent)",
      });
    }

    // studioOnly
    if (/jmix:studioOnly/.test(trimmed)) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "studioOnly",
        message: "jmix:studioOnly causes silent rendering issues",
        fix: "Replace with jmix:hiddenType",
      });
    }
  });

  // singleHardcodedCta: check whole-file type blocks
  const typeBlocks = content.split(/(?=^\[)/m);
  for (const block of typeBlocks) {
    if (!/^\[/.test(block.trim())) continue;
    const hasCtaLabel = /^\s*-\s+cta(Text|Label|ButtonText|ButtonLabel)\s+\(/im.test(block);
    const hasCtaLink = /^\s*-\s+cta(Link|Url|Href|ButtonLink|ButtonUrl)\s+\(/im.test(block);
    const hasChildNodes = /^\s*\+\s+/.test(block);
    if (hasCtaLabel && hasCtaLink && !hasChildNodes) {
      const typeName = block.match(/^\[(\S+)\]/m)?.[1] ?? "unknown";
      const typeLineIdx = lines.findIndex((l) => l.includes(`[${typeName}]`));
      issues.push({
        severity: "error",
        file: filePath,
        line: typeLineIdx >= 0 ? typeLineIdx + 1 : undefined,
        pattern: "singleHardcodedCta",
        message: `${typeName}: flat ctaText+ctaLink forces a single CTA — model as child nodes`,
        fix: "Remove ctaText and ctaLink. Add: + * (ns:cta). Create a [ns:cta] type with label + j:linkType",
      });
    }
  }

  return issues;
}

export function checkCndFiles(projectDir: string): CndCheckResult {
  const files = findCndFiles(projectDir);
  const allIssues: CndIssue[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      allIssues.push(...checkFile(file, content));
    } catch {
      // skip unreadable files
    }
  }

  const penalty = allIssues.reduce(
    (t, { severity }) => t + (severity === "error" ? 0.5 : 0.2),
    0,
  );
  const score = Math.exp(-penalty);

  return { score, issues: allIssues, filesChecked: files.length };
}
```

- [ ] **Step 2: Update `src/benchmark/types.ts`**

Replace the file contents with:

```typescript
export interface CndIssue {
  severity: "error" | "warning";
  file: string;
  line?: number;
  pattern: string;
  message: string;
  fix: string;
}

export interface PageResult {
  url: string;
  title: string;
  screenshot: string | null; // filename relative to run dir in results/
  accessibilityScore: number | null; // 0–1
  seoScore: number | null; // 0–1
}

export interface BenchmarkRun {
  id: string;
  date: string; // ISO 8601
  durationSeconds: number;
  tokens: {
    input: number;
    output: number;
    cached: number;
  };
  githubRunUrl?: string | undefined;
  branch?: string | undefined; // defaults to "main" for backward compatibility
  pages: PageResult[];
  cndQualityScore: number | null; // 0–1, null if no CND files found
  cndIssues?: CndIssue[] | undefined;
}
```

- [ ] **Step 3: Add CND check to `src/benchmark/index.ts`**

Read `src/benchmark/index.ts` first to find the exact insertion point.

After the agent run completes and `root` (the temp project dir) is known but before `docker compose down`, add the following import at the top of the file:

```typescript
import { checkCndFiles } from "./cnd-checker.ts";
```

Then, after the `for (const [i, rawUrl] of urls.entries()) { ... }` loop (after `await browser.close()`), add:

```typescript
console.log("Checking CND quality...");
const cndResult = checkCndFiles(root);
console.log(
  `CND quality: score=${cndResult.score.toFixed(2)}, files=${cndResult.filesChecked}, issues=${cndResult.issues.length}`,
);
```

Then, in the `BenchmarkRun` object that gets written to the results JSON, add:

```typescript
cndQualityScore: cndResult.score,
cndIssues: cndResult.issues,
```

The exact line to find for insertion before the BenchmarkRun object construction:

```typescript
// Find the existing pages: pages, line and add cndQualityScore after it
```

(Read the file to find exact line numbers before editing.)

- [ ] **Step 4: Add CND quality badge to `src/benchmark/build-website.ts`**

Read `src/benchmark/build-website.ts` first to find where accessibility and SEO badges are rendered.

Find the pattern that renders the score badges (look for `accessibilityScore` in the file). Add a parallel badge for `cndQualityScore`:

```typescript
// After the seoScore badge, add:
${run.cndQualityScore !== null && run.cndQualityScore !== undefined
  ? `<span class="badge ${run.cndQualityScore >= 0.9 ? "green" : run.cndQualityScore >= 0.6 ? "amber" : "red"}">
      CND ${Math.round(run.cndQualityScore * 100)}%
    </span>`
  : ""}
```

- [ ] **Step 5: Commit**

```bash
git add src/benchmark/cnd-checker.ts src/benchmark/types.ts src/benchmark/index.ts src/benchmark/build-website.ts
git commit -m "feat: add CND quality scoring to benchmark (static antipattern analysis)"
```

---

### Task 7: Build and lint validation

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

```bash
yarn lint
# Expected: no errors (tsc --noEmit + oxlint both pass)
```

If lint fails on the new TypeScript files, fix type errors before proceeding.

- [ ] **Step 2: Run build**

```bash
yarn build
# Expected: compiles harness for all 7 targets + bundles CLI
# Look for: "apm compile" succeeds for each target
```

If `apm compile` warns about the new `.agent.md` file, investigate and fix.

- [ ] **Step 3: Verify agent deploys to Claude target**

```bash
ls dist/claude/.claude/agents/
# Expected: jahia-cnd-author.md present
```

- [ ] **Step 4: Verify review skill deploys**

```bash
ls dist/claude/.claude/skills/jahia-dev-review-cnd/
# Expected: SKILL.md present
```

- [ ] **Step 5: Verify shortened define-content-type skill**

```bash
wc -l dist/claude/.claude/skills/jahia-dev-define-content-type/SKILL.md
# Expected: < 100 lines
cat dist/claude/.claude/skills/jahia-dev-define-content-type/SKILL.md | grep "jahia-cnd-author"
# Expected: at least one match (the delegation instruction)
```

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/plans/2026-06-24-cnd-quality.md
git commit -m "chore: add CND quality plan document"
```

---

## Self-review

**Spec coverage:**
- ✅ CND skill split into reference files — Task 1 (4 reference files by domain)
- ✅ CND evaluator as self-review skill — Task 3 (`jahia-dev-review-cnd`)
- ✅ Sub-agent for CND production — Task 2 (`jahia-cnd-author` agent, APM `.agent.md`)
- ✅ Isolated context window — agent has no MCP tools in `tools:` mapping
- ✅ Review skill referenced in top skill — Task 5 (instructions skill map)
- ✅ Benchmark CND assessment — Task 6 (static checker + score in BenchmarkRun)
- ✅ SKILL.md refactored as thin orchestrator — Task 4

**Placeholder check:**
- Task 6 Step 3 says "read the file to find exact line numbers" — this is intentional because `index.ts` is 400+ lines and the exact insertion point must be found at execution time, not hardcoded in the plan. The plan provides the surrounding context string to grep for.

**Type consistency:**
- `CndIssue` defined in `types.ts` (Task 6 Step 2) and imported in `cnd-checker.ts` — wait, actually `CndCheckResult` in `cnd-checker.ts` uses its own local `CndIssue` definition. To avoid duplication, `cnd-checker.ts` should import `CndIssue` from `types.ts`.

**Fix:** In Task 6 Step 1, `cnd-checker.ts` should import `CndIssue` from `./types.ts`:

```typescript
import type { CndIssue } from "./types.ts";

export interface CndCheckResult {
  score: number;
  issues: CndIssue[];
  filesChecked: number;
}
```

And remove the `CndIssue` interface definition from `cnd-checker.ts` — it lives in `types.ts` only.
