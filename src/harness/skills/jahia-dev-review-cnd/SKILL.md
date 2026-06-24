---
name: jahia-dev-review-cnd
description: Use after writing any CND file to validate it against Jahia best practices. Runs the deterministic cnd-checker script and reports PASS / PASS (with warnings) / FAIL with file:line citations and fixes. Run /jahia-dev-review-cnd <path> to check a specific file or directory, or without arguments to check all CND files in the current module.
allowed-tools: Bash
---

## Step 1 — Run the checker

```bash
node scripts/check-cnd.mjs <path-to-file-or-directory>
# or, to check all CND files in the module:
node scripts/check-cnd.mjs .
```

The script exits with code 0 for PASS/PASS (with warnings) and code 1 for FAIL.

## Step 2 — Act on the result

- **FAIL** — fix every ERROR before proceeding. Send errors back to `@jahia-cnd-author` with the exact message and fix.
- **PASS (with warnings)** — fix obvious warnings; note the rest for the editor.
- **PASS** — continue to the next step.

---

## Antipattern reference

The checker enforces these patterns. Use this as a guide when interpreting output or fixing issues manually.

### Error: `rawStringLink`
Property whose name contains `link`, `url`, `href`, or `path` declared as `(string)`.
**Fix**: Use the link picker:
```cnd
- j:linkType (string, choicelist[linkTypeInitializer]) mandatory
```

### Error: `singleHardcodedCta`
A type with both a CTA label (`ctaText`, `ctaLabel`, `buttonText`, `buttonLabel`) and a CTA link (`ctaLink`, `ctaUrl`, `ctaHref`, `buttonLink`) as flat properties, with no child node.
**Fix**: Replace with a child node:
```cnd
+ * (ns:cta)

[ns:cta] > jnt:content, nsmix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory
```

### Error: `directDroppable`
A concrete type extending `jmix:droppableContent` directly.
**Fix**: Extend the module mixin: `[ns:hero] > jnt:content, nsmix:component`

### Warning: `redundantImageAlt`
`imageAlt (string)` alongside an image weakreference. The image node already has `jcr:title`.
**Fix**: Remove `imageAlt`. In the view: `image.getPropertyAsString("jcr:title") ?? ""`

### Warning: `missingRatingConstraint`
`rating (long)` without a range constraint.
**Fix**: Add `< "[1,5]"`

### Warning: `rawTitleProp`
Property named `title`, `heroTitle`, `pageTitle`, or `sectionTitle` typed as `(string)`.
**Fix**: Remove it, extend `mix:title`. Access as `props["jcr:title"]`.

### Warning: `weakrefNoConstraint`
`(weakreference)` with no `< ` type constraint.
**Fix**: Add constraint — `< jmix:image` for images, `< jnt:file` for files.

### Warning: `weakrefWrongConstraint`
`< 'jnt:file'` (quoted form).
**Fix**: `< jmix:image` (unquoted).

### Warning: `missingI18n`
User-visible string (`title`, `text`, `label`, `description`, `subtitle`, `caption`, `alt`, `heading`, `summary`, `excerpt`, `body`) without `i18n`.
**Fix**: Add `i18n` after the type declaration.

### Warning: `studioOnly`
Any use of `jmix:studioOnly`.
**Fix**: Replace with `jmix:hiddenType`.
