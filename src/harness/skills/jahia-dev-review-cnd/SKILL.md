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
