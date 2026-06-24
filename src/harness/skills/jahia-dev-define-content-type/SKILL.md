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

## Step 2b — Validate the CND

After `@jahia-cnd-author` reports back, invoke `/jahia-dev-review-cnd` on the written file:

```
/jahia-dev-review-cnd <module-path>/src/components/<Category>/<Name>/definition.cnd
```

If the review reports errors, send them back to `@jahia-cnd-author` to fix. Do not proceed until the review is clean.

---

## Step 3 — Continue with deployment

After the CND review is PASS, proceed with:
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
