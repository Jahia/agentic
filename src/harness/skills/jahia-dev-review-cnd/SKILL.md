---
name: jahia-dev-review-cnd
description: Use after writing any CND file to validate it against Jahia best practices. Runs the deterministic cnd-checker script and reports PASS / FAIL with file:line citations and fixes. Run /jahia-dev-review-cnd <path> to check a specific file or directory, or without arguments to check all CND files in the current module.
allowed-tools: Bash
---

## Step 1 — Run the checker

```bash
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CND_SCRIPT=$(find .claude .agents .kiro "$ROOT/.claude" "$ROOT/.agents" "$ROOT/.kiro" -name "check-cnd.mjs" -print -quit 2>/dev/null)
node "${CND_SCRIPT:?check-cnd.mjs not found}" <path-to-file-or-directory>
# or, to check all CND files in the module:
node "${CND_SCRIPT:?check-cnd.mjs not found}" src/
```

The script exits with code 0 for PASS and code 1 for FAIL. Run it from the module root. When the script is not found, the command fails: that is not a PASS.

## Step 2 — Fix and repeat until clean

This is a loop. Run the checker, fix every issue reported, run it again. Repeat until the result is `PASS`.

- **FAIL** — fix every issue, re-run. Do not proceed until exit code is 0.
- **PASS** — clean. Continue.

On a type that is already released to production, a fix that changes an existing property (its type, its name, `internationalized`, a weakreference constraint) is refused by Jahia at the next production deployment. Apply such a fix with `jahia-dev-change-cnd`, or report the issue without fixing it. A type that never left development can be fixed directly.

---

## Antipattern reference

The checker enforces these patterns. Use this as a guide when interpreting output or fixing issues manually.

### `rawStringLink`
Property whose name ends with `link`, `url`, or `href` declared as `(string)`.
**Fix**: Use the link picker:
```cnd
- j:linkType (string, choicelist[linkTypeInitializer]) mandatory
```

### `singleHardcodedCta`
A type with both a CTA label (`ctaText`, `ctaLabel`, `buttonText`, `buttonLabel`) and a CTA link (`ctaLink`, `ctaUrl`, `ctaHref`, `buttonLink`, `buttonUrl`) as flat properties, with no child node.
**Fix**: Replace with a child node:
```cnd
+ * (ns:cta)

[ns:cta] > jnt:content, nsmix:component
 - label (string) i18n mandatory
 - j:linkType (string, choicelist[linkTypeInitializer]) mandatory
```

### `directDroppable`
A concrete type extending `jmix:droppableContent` directly, also when the supertypes continue on the next line.
**Fix**: Extend the module mixin: `[ns:hero] > jnt:content, nsmix:component`

### `missingRatingConstraint`
`rating (long)` without a range constraint — unconstrained ratings cause data integrity issues.
**Fix**: Add `< "[1,5]"`

### `redundantImageAlt`
`imageAlt (string)` alongside an image weakreference. The image node already has `jcr:title`.
**Fix**: Remove `imageAlt`. In the view: `<JImage src={image} />`, whose alt text defaults to the image's `jcr:title`. On JavaScript Modules 1.2 and earlier: `server.render.addCacheDependency({ node: image }, renderContext)`, then `image.getPropertyAsString("jcr:title") ?? ""`

### `rawTitleProp`
Property named `title`, `heroTitle`, `pageTitle`, or `sectionTitle` typed as `(string)`.
**Fix**: Remove it, extend `mix:title`. Access as `props["jcr:title"]`.

### `weakrefNoConstraint`
`(weakreference)` with no `< ` type constraint.
**Fix**: Add constraint — `< jmix:image` for images, `< jnt:file` for files.

### `weakrefWrongConstraint`
An image picker (`picker[type='image']`) constrained to `jnt:file`, quoted or not: it accepts any file.
**Fix**: `< jmix:image`.

### `missingI18n`
String property whose name contains `title`, `text`, `label`, `description`, `subtitle`, `caption`, `alt`, `heading`, `summary`, `excerpt` or `body`, without `i18n` (or `internationalized`).
**Fix**: Add `i18n` after the type declaration.

### `childNodeOrderable`
`orderable` (or its short forms `ord` and `o`) on a `+` child node line. `orderable` is an option of
the type, after its supertypes.
The build accepts it, but Jahia cannot parse the CND at install, and `yarn jahia-deploy` installs
nothing.
**Fix**: Move `orderable` to the type line.
```cnd
// ❌
[ns:sectionItems] > jnt:content, jmix:list, jmix:hiddenType
 + * (ns:textCard) orderable
// ✅
[ns:sectionItems] > jnt:content, jmix:list, jmix:hiddenType orderable
 + * (ns:textCard)
```

### `studioOnly`
Any use of `jmix:studioOnly`.
**Fix**: Replace with `jmix:hiddenType`.
