---
name: jahia-dev-migrate-jsp
description: Migrates an existing JSP/Java template set or module to a Jahia JavaScript module (React/JSX). Use when asked to migrate, port, convert or modernize a JSP template set, or to assess how much of one can move to JavaScript modules. Audits what is portable before writing code, weights that audit by a real content export, then ASKS you three scope questions — CSS as-is or CSS Modules, keep jQuery or port to React islands, keep the Java module or rewrite its hooks — before porting views tag-by-tag and naming what must stay in Java. Closes by offering a linter/formatter (oxlint/oxfmt) and a runnable docker-compose dev environment, since the developer inheriting the module is often new to TypeScript and React.
argument-hint: "[path to the JSP module]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Migrating a JSP template set to a JavaScript module

Most of a JSP template set ports mechanically. A minority cannot port at all, and that minority is
what sinks migrations that start by converting files. **Audit first, then port, and be explicit
about what stays in Java.**

Jahia's official position is coexistence, not replacement: a JavaScript module and a Java module
run on the same site, which is the supported path for exactly this situation. A migration that
leaves a slim Java bundle behind is a success, not a failure.

## Step 1 — Audit before you write anything

Run this over the JSP module and read the result before touching a view.

```bash
SRC=<module>/src/main/resources; CND="$SRC/META-INF/definitions.cnd"

# Views, by kind. META-INF is pruned: groovyConsole holds admin scripts, not views —
# counting them inflates the estimate (62% on the reference set) and hides the real Groovy views.
echo "== views by kind =="
find "$SRC" -path "$SRC/META-INF" -prune -o \( -name '*.jsp' -o -name '*.jspf' -o -name '*.groovy' \) -print \
  | sed 's/.*\.//' | sort | uniq -c

echo "== scriptlets ==";     grep -rl '<%[^@-]' "$SRC" --include='*.jsp'
echo "== taglibs ==";        grep -rhoE '<%@ *taglib[^%]*uri="[^"]*"' "$SRC" | grep -oE 'uri="[^"]*"' | sort | uniq -c | sort -rn
echo "== moduleMap ==";      grep -rl 'moduleMap' "$SRC"
echo "== wrappedContent =="; grep -rl 'wrappedContent' "$SRC"
echo "== jqom/query ==";     grep -rlE '<jcr:jqom|<query:' "$SRC"
echo "== java hooks ==";     find <module>/src/main/java -name '*.java' 2>/dev/null
echo "== other runtimes =="; grep -rlE 'ng-[a-z]+=|v-(if|for|bind)=|\{\{' "$SRC" --include='*.jsp'
echo "== cache props ==";    find "$SRC" -name '*.properties' -path '*/html/*' -exec grep -l . {} +

# Node types the CND references but does not define. These become hard OSGi requirements.
# Match every prefix:name token and subtract the defined ones — a supertype list like
# `> jnt:content, jacademix:component, mix:title, bootstrap5mix:text` only exposes its LAST
# entries to a `>`-anchored pattern, and the last entry is usually the one that breaks the build.
echo "== foreign types =="
comm -23 \
  <(grep -oE '[a-z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9]*' "$CND" | sort -u) \
  <(grep -oE '^\[[^]]+\]' "$CND" | tr -d '[]' | sort -u) \
  | grep -vE '^(jcr|nt|mix|jnt|jmix|j):'

# Choicelist initializers — Java, and named from the CND. A bracket body can hold several
# comma-separated directives, so match the whole body and drop the non-initializer ones.
echo "== initializers =="
grep -oE 'choicelist\[[^]]*\]' "$CND" | sed 's/choicelist\[//;s/\]//' | tr ',' '\n' \
  | grep -vE "^(resourceBundle|sort|nodes=|moduleImage=|image=)" | sort -u
```

Then classify every view into one of three tiers. **Report the tiers to the user before porting** —
a template set that is 40% tier 3 may not be worth migrating at all, and the tier-3 share is what
Step 2's third question is about.

### Weight the audit by real content, not by source files

This is the step that is easiest to skip and most expensive to skip. A template set's file layout
tells you nothing about which views carry the site. **Get a content export from the live site and
count what it actually uses**, then port in that order.

```bash
unzip -o site-export.zip repository.xml
grep -o 'j:templateName="[^"]*"' repository.xml | sort | uniq -c | sort -rn   # which page templates
grep -o 'jcr:primaryType="[^"]*"' repository.xml | sort | uniq -c | sort -rn  # which content types
```

On the reference set this inverted the plan. Ported by source structure — starting from the file
that *looks* like the main page template — the result covered **3.7% of real pages**, because a
single template nobody had prioritized carried **96.3%** of them. The same export showed the
content views were already at 99.6% coverage by node count. A per-file tally would have reported
"18 of 47 views ported" and told you neither.

The export also names the modules you actually need: every namespace in it that your CND does not
define belongs to a module that must be installed, or its nodes are dropped on import.

**If no export is available**, ask for one — this is the highest-leverage input in the whole
migration. If it genuinely cannot be had, fall back to a stated order rather than an invented one:
page templates referenced by `import.xml`, then types with a `jnt:contentTemplate`, then types this
CND defines, then overrides of other modules' types. Say in the report that the order was
unweighted, so nobody mistakes it for a priority ranking.

| Tier | What it is | Action |
|---|---|---|
| 1 | Presentational: JSTL, EL, properties, `template:module/area/addResources` | Port mechanically |
| 2 | Needs a judgement call: dynamic includes, cache dependencies, i18n, queries | Port carefully, verify behaviour |
| 3 | No JSM equivalent (see `references/not-portable.md`) | Leave in Java, or drop |

**Check the dependency graph against the target Jahia version too.** A set whose `jahia-depends`
names a module with no release for your Jahia major cannot start at all, migrated or not — verify
each dependency resolves before blaming the migration.

## Step 2 — Ask the operator three scope questions

The audit tells you what the set contains. These three answers decide how big the job is, and they
are **not yours to assume** — each can double the work or halve it. Put them to the operator with
the audit numbers attached, and record the answers in the migration report.

Behind all three sits one rule: **do not run two migrations at once.** Carrying the styling and the
client-side code across unchanged is what makes the view port *verifiable* — with class names and
scripts identical, any rendering difference is a port bug, not a styling bug. Modernise afterwards,
once parity is proven, and you always know which change broke what.

### 1. CSS — carry it as-is, or port to CSS Modules?

| | Carry as-is | Port to CSS Modules |
|---|---|---|
| What it means | Ship the existing stylesheet from the package root; keep every class name | One `component.module.css` per component, class names hashed |
| Cost | Near zero | Proportional to the number of components, plus a full visual re-check |
| Buys you | A verifiable port | Scoping, dead-CSS detection, the Jahia-recommended layout |

**Default: carry as-is, then port per component afterwards.** Say plainly that CSS Modules are the
recommended JSM structure, so the operator is choosing when to pay, not whether.

If a SCSS build exists, it survives the migration untouched — keep it and point it at the package
root. Watch for stylesheets that reach into `node_modules` by relative path; those break when files
move.

### 2. Client-side JS — keep the existing libraries, or port to React islands?

| | Keep jQuery and friends | Port to islands |
|---|---|---|
| What it means | `<AddResources>` the same scripts; inline blocks stay inline strings | `*.client.tsx` rendered through `<Island>` |
| Cost | Near zero | Real: rewrite per behaviour, and props must be devalue-serializable |
| Buys you | A verifiable port | Typed, bundled, tree-shaken code; no global jQuery |

**Default: keep them, and use islands only where a JSP shipped genuine interactivity.** An inline
`<script>` that just wires up tooltips is glue and should stay glue; a real widget deserves an
island.

Two things to tell the operator up front: an inline script carried as `inlineResource` is a
**string**, so it gets no type-checking; and **a JCR node cannot be passed to a client component**,
so anything hydrated needs its data projected into plain values first. Count the vendored scripts
from the audit — a set carrying jQuery, a syntax highlighter, a date library and a dozen inline
blocks is a much larger island migration than the view port itself.

### 3. The Java remainder — keep the existing module, or rewrite the hooks?

Tier 3 from the audit has to live somewhere (Step 5). Ask whether the operator wants the existing
Java module kept as a companion bundle (cheap, immediate) or its hooks rewritten and dropped
(expensive, and some cannot be — skins and `moduleMap` views have no JS form at all).

**Default: keep it.** And it stops being a choice at all if the audit found a
`choicelist[<x>Initializer]` in the CND or a `.drl` global — dropping the Java module then breaks the
*content model*, not just rendering, because the CND keeps naming those initializers. If the operator
is absent or defers, keep the companion bundle and say so in the report.

## Step 3 — Scaffold and preserve identity

```bash
npm init @jahia/module@latest -- <name> -t template-set --yes
```

If `--yes` prompts anyway, the published CLI predates non-interactive mode; scaffold interactively
or compose `templates/module` + `templates/template-set` by hand.

Two identity rules decide whether existing content still renders:

1. **Keep the module name** if this replaces the old set. The site's `j:installedModules` and
   template references then bind unchanged.
2. **Copy the CND verbatim** — `src/main/resources/META-INF/definitions.cnd` →
   `settings/definitions.cnd`. Same format, same namespaces. Renaming a namespace or type orphans
   every node the old module authored. This is the single most important step.

These also move across unchanged: `META-INF/jahia-content-editor-forms/` →
`settings/content-editor-forms/`, `resources/*.properties` → `settings/resources/` (they still
drive *edition UI* labels; only view-facing `<fmt:message>` text becomes i18next), and the SCSS/CSS
build.

**Port `src/main/import/repository.xml` to `settings/import.xml`, but only its site skeleton.**
The `jnt:template` nodes carrying `j:view`, and their `jnt:pageTemplate` children, do not port — in
JSM the `jahiaComponent({ componentType: "template" })` registration *is* the picker entry. Any
pre-built content inside those templates (grids, `jnt:area` nodes) is content and must be
re-authored. Skip this file and the site will be created with **no home page** and 404 everywhere.

## Step 4 — Port the views

One directory per component under `src/components/<Name>/`, one file per view. The engine resolves
views from the `jahiaComponent` call, not the path — but pick the filename by rule anyway, so two
people migrating the same module produce the same tree.

```tsx
jahiaComponent(
  {
    componentType: "view",           // "view" | "template"
    nodeType: "jacademy:textBox",    // the JSP directory, `_` → `:`
    name: "detail",                  // the view segment of the filename; omit for default
    properties: { "cache.perUser": "true" },  // the JSP .properties sidecar, verbatim
  },
  ({ "jcr:title": title }, { renderContext, currentNode }) => <h1>{title}</h1>,
);
```

### Naming and placement — follow these exactly

You are not free to choose here. Two agents migrating the same module must produce the same tree,
so apply these mechanically even where a nicer name suggests itself.

| Input | Output |
|---|---|
| view directory `<ns>_<type>` | `nodeType: "<ns>:<type>"` — always, even if this module's CND doesn't define it |
| component directory name | **namespace-qualified** PascalCase: `jacademy_textContent` → `src/components/JacademyTextContent/` |
| `componentType: "view"` | `src/components/<Name>/<name>.server.tsx`, or `default.server.tsx` when `name` is omitted |
| `componentType: "template"` | `src/templates/<Name>.server.tsx` — **not** under `components/` |
| a shared layout or fragment component | `src/templates/<Name>.tsx` (no `.server`, it is imported, not registered), `<Name>` = the JSP's `j:view` value PascalCased — `jahia-academy-template` → `JahiaAcademyTemplate` |
| an EL function from a module `.tld` | `src/lib/<functionName>.ts`, one file per function |

Namespace-qualifying the directory is not decoration: a set can define the same local name in two
namespaces (`jacademy:textContent` *and* `jacademix:textContent`), and the unqualified rule silently
merges them, dropping a registration.

**The `name` value, from the filename.** Split on `.`, discard the first segment (the type) and the
extension; join whatever is left with `.`. A bare `<type>.jsp` has no `name` — it is the default view.

| Filename | `name` |
|---|---|
| `kbEntry.jsp` | *(omitted — default view)* |
| `kbEntry.detail.jsp` | `"detail"` |
| `list.docCard.jsp` | `"docCard"` |
| `skinnable.skins.bluebg.jsp` | `"skins.bluebg"` |
| `textContent.textContent.jsp` | `"textContent"` — a repeated segment is still a view name |

**One JSP body, several consumers.** A `jnt_template` view is page chrome, and `import.xml` often
points more than one node at it — several `jnt:pageTemplate` entries plus a `jnt:contentTemplate` can
share a single `j:view`. Do not fold that into one registration, and do not leave it as chrome with
no registration. Split it:

1. the JSP body becomes an **unregistered shared layout**, `src/templates/<Name>.tsx`, `imported`;
2. **each** consumer gets its own thin registration that renders it —
   `src/templates/Page/<pageTemplateName>.server.tsx` per `jnt:pageTemplate`
   (`componentType: "template"`, `nodeType: "jnt:page"`, `name` = the pageTemplate's node name), and
   one per `jnt:contentTemplate` on its `j:applyOn` type.

Count the layout once as `imported` and each registration as `registered`. A `jnt_template` view is
therefore never itself `registered` — only the layouts it becomes are imported, and the consumers
are registered.

**Files that are not views.** A `.jspf` has no `<type>.<view>` name and reads variables its includer
set: port it as a plain React component inside the including component's directory, taking those
variables as explicit props, and never register it. **Unless its family is tier-3** — a fragment
whose including view cannot port has nothing to be imported by, so it inherits tier-3 and goes to the
companion bundle with its parent. Tier beats file type.

A `.groovy` view is a view — port it like a JSP, translating its JCR calls directly, since it has no
JSP-tag semantics to preserve.

**A view whose node type is defined nowhere** — not in this CND, not in a declared dependency — is
dead. Do not port it, do not invent a CND entry (that would violate the verbatim-CND rule), and list
it in the Step 7 report. A dead view is dropped from **both** modules: no node of that type can
exist, so keeping it in the companion bundle only ships code nothing can resolve.

Full tag-by-tag translation table: **`references/tag-mapping.md`**. Read it before porting.

The traps that cause silent wrong output rather than an error:

1. **Rich text needs `dangerouslySetInnerHTML`.** JSP EL emitted `${node.properties.text.string}`
   unescaped; React escapes it, so the field renders as visible HTML source. Check the CND for
   `(string, richtext)`. But if the JSP piped the value through `removeHtmlTags` first, it is plain
   text and the rule is inverted — read the JSP, don't pattern-match the type.
2. **Attribute renaming** — `class`→`className`, `for`→`htmlFor`, `style` becomes an object. A
   missed one is a no-op, not an error.
3. **A dynamic tag needs a capitalised variable**: `<${hx}>` → `const H = hx || "h2"` then `<H>`.
4. **Absent properties are `undefined`, not `""`** — `${empty x}` covered both.
5. **Dates arrive as strings.** Format them with `Intl.DateTimeFormat` and the locale from
   `currentResource.getLocale()`.
6. **`{{ … }}` in JSX is an object literal, not interpolation.** Some JSP views contain no Jahia
   logic at all — they are another runtime's templates passing through, typically a view override
   for a client-rendered module (Form Factory's `fcnt:*` widgets are AngularJS). Their `ng-*` /
   `v-` attributes survive React untouched, but every `{{expr}}` must be emitted as a literal
   string — `{"{{input.label}}"}` — or React parses it as an expression and the binding is lost.
   Spot them in the audit: a view with no taglib imports and mustache braces is one of these.

**Translate to the idiom, not to the API.** Where a taglib wrapped something the JS platform does
natively — `fmt:formatDate` → `Intl.DateTimeFormat`, `fmt:formatNumber` → `Intl.NumberFormat`,
`fn:*` → `String`/`Array` methods, `functions:abbreviate` → `slice`/`Intl.Segmenter` — use the
platform. Reproducing the Java API shape produces worse code that then has to be maintained, and it
mislabels a translation as a gap. A missing taglib is never a gap; a missing `moduleMap` is.

**But reproduce the output during the parity port.** `Intl` replaces the *mechanism*, not the
result: give it explicit options that match the JSP's pattern (`{ day:"numeric", month:"long",
year:"numeric" }` for `"MMMM d, yyyy"`), rather than a convenience preset like `dateStyle:"long"`
that renders differently. Otherwise this instruction manufactures exactly the rendering differences
Step 2 tells you to treat as port bugs. Simplify after parity is signed off, not before. And
normalise an invalid source value rather than passing it through — `<fmt:setTimeZone value="ETC"/>`
is not an IANA zone and would throw a `RangeError`; use `Etc/UTC` and report it.

Preserve every CSS class name exactly unless the operator chose CSS Modules in Step 2 — with the
stylesheet reused unchanged, a renamed class is a visual regression you will not see in a diff.

## Step 5 — Decide the Java remainder

Anything in tier 3 stays in a **companion Java bundle**. This is supported and normal — Jahia
documents a JS module and a Java module on the same site as the upgrade path. Do not fake it in JS.

Always Java: `ModuleChoiceListInitializer` (named from the CND, so the CND keeps working only if
the initializer still exists), render filters (`AbstractFilter`), Drools rules that call module
services, actions, servlets and workflow handlers.

**The companion bundle is the original Java module, stripped.** You do not write a new project:

1. Keep `pom.xml`, `src/main/java` and its OSGi wiring — this is what still provides the hooks.
2. Delete the view scripts (`src/main/resources/<ns>_<type>/**`) — **except everything the audit put
   in tier 3**, which keeps rendering from here. The exemption is the whole tier-3 set, not a short
   list: skins (`type = skin`), `moduleMap`-based views, a `jnt:facets` family and its `.jspf`
   fragments, Groovy views you chose not to port. Deleting any of them silently drops working
   behaviour, and the failure shows up as a blank region on a page, not as an error.
3. **Delete its `definitions.cnd` and its `src/main/import`.** Only one module may declare the CND;
   the JSM module now does. Two bundles declaring the same types conflict.
4. Rename it (e.g. `<name>-hooks`) if the JSM module took the original module name, and drop
   `Jahia-Module-Type: templatesSet` — it is a plain module now, not a template set.
5. Deploy both, and enable both on the site.

This works because these hooks resolve **by name through the OSGi service registry, not by module**.
A CND that says `choicelist[versionsInitializer]` finds the initializer wherever it is registered,
so the JSM module's verbatim CND keeps working with the Java bundle beside it.

To call your own service from a view, use `server.osgi.getService("fqcn")`. Everything else — the
initializers, filters and rules — is invoked by Jahia itself and needs no wiring from the JS side.

If the operator chose to rewrite rather than keep (Step 2), be direct about what cannot be rewritten
at all: skins and `moduleMap`-based views have no JS form, so the companion bundle is not optional
for those.

**Do not carry `rules.drl` over unless its globals still exist.** `settings/*.drl` is compiled at
startup, and a rule referencing a deleted class makes Jahia register every view and *then stop the
whole bundle* — the cause appears far above the symptom in the log.

## Step 6 — Build, deploy, verify

```bash
yarn build && yarn deploy
```

Then confirm it actually started — an accepted deploy is not a running module:

```bash
curl -s -u root:root1234 \
  "$JAHIA/modules/api/bundles/<groupId>/<name>/<version>/_localState"   # want ACTIVE
```

If it is `INSTALLED` or `RESOLVED`, read `references/gotchas.md` — the packaging errors Jahia
reports are actively misleading (a numeric `module-priority` reports a Maven-repo failure; a root
`icons/` directory reports a `ZipException`). Do not debug them from the message.

Verify a real render, not just the bundle state. The strongest check available is the client's own
content: import their export into the migrated instance and render a sample of pages, asserting
each returns HTTP 200 with a non-empty `<main>`. On the reference set this went from a synthetic
two-node page to **62 of 62 production pages rendering** in three seconds, which is the evidence a
migration sign-off actually needs.

```yaml
# provisioning script; POST with the zip as a `file` part
- import: "site-export.zip"
  rootPath: "/sites/<key>"
```

Import **degrades silently**: nodes whose type is missing are skipped with a warning
(`Cannot import "…" due to missing node type definition`) and the rest succeeds. Grep the log for
those warnings and reconcile them against the namespace list from the audit — a page that renders
may still be missing content.

Compare against the JSP output **semantically** — React emits `itemProp`/`frameBorder` in camelCase,
so the markup is never byte-identical.

## Step 7 — Report honestly

Close with what did not migrate and why, per view. A migration report that hides the Java remainder
is worse than no report: the gap surfaces in production instead.

**The completion criterion — do not stop before this.** Take the file list the Step 1 audit produced
and account for **every** entry. A migration is done when each `.jsp` / `.jspf` / `.groovy` under a
`<ns>_<type>/` directory is exactly one of:

1. registered by a `jahiaComponent` call, or
2. a plain component imported by one (a `.jspf`, a shared fragment), or
3. listed in the report with its tier-3 reason, or
4. listed in the report as dead (its node type is defined nowhere).

Nothing may be silently absent. Report the totals — *N files: A registered, B imported, C tier-3,
D dead* — and make them add up. Without this the migration has no defined end, and two agents can
stop at very different coverage and both claim they followed the skill.

Record alongside it: the operator's three Step 2 answers, the porting order and whether it was
weighted by a content export or unweighted, and the render sample from Step 6.

## Step 8 — Hand over something they can run

Whoever asked for this migration is very often a Java developer who now owns a TypeScript and React
codebase. Do not hand back source and assume the toolchain is obvious. Offer both of these
explicitly, and say what each command does rather than just adding it.

### 1. Linting and formatting — keep the scaffold's, or swap to oxlint and oxfmt?

The scaffold ships ESLint and Prettier (`lint` = `eslint .`, `format` = `prettier --write`), so this
is a swap, not a gap. Put the trade-off to them:

| | Keep ESLint + Prettier | Swap to oxlint + oxfmt |
|---|---|---|
| Speed | fine on a small module, slower as it grows | Rust-based, far faster |
| Rules | the React/TypeScript plugin ecosystem, incl. `@eslint-react` | a large built-in set, a smaller plugin ecosystem |
| Familiarity | what most JavaScript documentation assumes | what Jahia's own tooling uses |

Whichever they choose, put the type-check in `lint` as well — `tsc --noEmit && <linter>`. The
scaffold already runs it, but only inside `build`, so this is about moving it into the fast loop
rather than adding a check that is missing. It earns its place there: a migrated module's most
common defect is a prop that does not exist on the node, and no linter catches that — only the
type-checker does.

### 2. A dev environment they can actually start

The scaffold ships `docker-compose.yml` and `docker/provisioning.yml` — a migration done in place
loses them easily, so check they survived. They are also **not sufficient as shipped**: the
provisioning file installs only `javascript-modules-engine`, so a migrated module deploys and then
fails to resolve against node types its dependencies own. Offer to extend it with what the audit
found:

```yaml
- installOrUpgradeModule: "mvn:org.jahia.modules/javascript-modules-engine/$VERSION"
# one line per module owning a foreign node type from the Step 1 audit
- installOrUpgradeBundle: ["mvn:org.jahiacommunity.modules/bootstrap5-components/<version>"]
# the companion Java bundle, if the migration kept one
- installOrUpgradeBundle: ["mvn:<groupId>/<module>-hooks/<version>"]
```

Then hand over the four commands that matter, one line each on what they do: `docker compose up
--wait` (a Jahia on :8080, JPDA on 9229), `yarn dev` (rebuild and redeploy on every save),
`yarn build`, `yarn deploy`.

**Start it clean and load a page before saying it works.** "Should work" is not a handover, and this
is the artifact the client judges the migration by.
