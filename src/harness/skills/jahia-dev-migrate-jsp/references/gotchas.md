# Packaging and build gotchas

Every entry below was reproduced on Jahia 8.2.4 while migrating a real JSP template set. They are
collected because **the error Jahia reports usually names the wrong cause** — do not debug these
from the message.

## The module installs but never becomes ACTIVE

Always check the real state; an accepted deploy is not a running module.

```bash
curl -s -u root:root1234 "$JAHIA/modules/api/bundles/<groupId>/<name>/<version>/_localState"
```

`INSTALLED` or `RESOLVED` means it did not start. Work down this list.

### A numeric `jahia.module-priority` (reports a Maven failure)

```
ERROR [InstallModule] - Cannot install package.tgz = org.ops4j.lang.Ops4jException.
Please make sure the artifact is reachable within the registered maven repositories (network, credentials ...)
```

Nothing is being fetched from Maven. `JavascriptProtocolConnection.setIfPresent` copies the raw JSON
value into a `java.util.Properties`, so an `Integer` reaches BND where a `String` is required.

**Fix:** quote it — `"module-priority": "10"`. Same for every `jahia.*` key routed through
`setIfPresent`: `module-signature`, `module-priority`, `deploy-on-site`, `private-app-store`.

### A root `icons/` or `images/` directory (reports a ZipException)

```
ERROR [InstallModule] - Cannot install package.tgz = java.util.zip.ZipException.
Please make sure the artifact is reachable within the registered maven repositories (network, credentials ...)
```

The engine **relocates** three things while assembling the bundle: `settings/content-types-icons/*` → `icons/`,
`settings/template-thumbnail.png` → `images/template-preview/`, and every `components/**/*.png` →
`icons/<ns>_<type>.png` (for a `<type>.icon.png`) or a **flattened** `images/<filename>`. A file already sitting at
one of those generated names produces a duplicate zip entry. This is easy to hit migrating a Java module, which
legitimately serves both directories from the bundle root.

**Fix:** never ship a root `icons/` or `images/`. Route them through
`settings/content-types-icons/` and `static/`. A root `css/` and `javascript/` are fine, and
`AddResources` resolves them.

### Where the images a JSP served at runtime actually go

The rule above is about *packaging*, but a Java template set also serves images to the browser from that same root
`images/`, and those references have to keep working. Two cases, and they resolve differently — check which one
you have before moving a file.

**Runtime URLs built in a view.** `template.hidden.mainnav.jsp` builds
`${url.currentModule}/images/logo-academy.svg`. Move the file to `static/images/` and write
`buildModuleFileUrl("static/images/logo-academy.svg")`. The engine appends `/static` to `Jahia-Static-Resources`
unconditionally, so this is served whatever the package declares. Do **not** keep the file at the root to preserve
the URL — the URL is not the contract, the rendered `<img>` is.

**A `moduleImage` choicelist in the CND.** `[jacademy:textBox] - hx (string,
choicelist[resourceBundle,moduleImage='png'])` looks like it contradicts the rule. It does not:
`ModuleImageChoiceListInitializerImpl` resolves `/img/<value>.<ext>` — a root **`img/`**, not `images/`. The engine
never generates into `img/`, so a root `img/` is safe to ship and the CND ports verbatim with nothing to change.

Two consequences worth knowing before you go looking for files to move:

- If you do ship a root `img/`, add `/img` to `jahia.static-resources` in `package.json`. The built-in default
  (`/css,/icons,/images,/img,/javascript`) includes it, but the scaffold **overrides** that default with
  `/dist/client,/dist/assets,/locales,/images,/icons`, which does not.
- A `moduleImage` choicelist with no matching file is a silent no-op, not an error — the initializer logs at debug
  and the choice simply renders without a thumbnail. The reference module is exactly this case: it declares
  `moduleImage='png'` for `h1`…`h6` and ships no `img/` at all, so the key is decorative and there is nothing to
  migrate. Check for the files before treating this as work.

### A ported `rules.drl` referencing classes that no longer exist

```
ERROR [Activator] - --- Error parsing rules for DX OSGi bundle <module>
java.lang.RuntimeException: Errors when compiling rules ... GlobalError: <x> : Unable to find class '<X>'
INFO  [Activator] - --- The DX OSGi bundle <module> will be stopped
```

`settings/*.drl` is packaged and compiled. The module installs, registers **every view**, and only
then stops — so the visible symptom is "not ACTIVE" with the cause many lines earlier.

**Fix:** only carry rules whose globals still exist. Rules calling a module's own OSGi service need
that service kept in a companion Java bundle.

### A node type the CND references but nothing provides

```
BundleException: Unable to resolve <module>: missing requirement
  com.jahia.services.content; (nodetypes=bootstrap5mix:text)
```

The engine derives a hard OSGi `Require-Capability` from **every** node type the CND references but
does not define. A supertype or mixin owned by another module therefore becomes a resolution
requirement — and this is **stricter than the Java module packaging tolerated**, so a CND that
worked for years can block the JSM bundle.

**Fix:** inventory foreign supertypes during the audit. Per type, either install the owning module
(declaring `jahia.module-dependencies` is not enough — the module must actually be installed) or
drop the inheritance and declare the properties locally.

### A `jahia-depends` module with no release for your Jahia version

Not a JSM problem, but it surfaces here and stops everything:

```
BundleException: missing requirement com.jahia.server; (&(version>=7.3)(!(version>=8)))
<module> has unresolved dependency <dep> and won't be started
```

A module built against Jahia 7.3 carries a manifest requirement excluding 8.x. **Check every
`jahia-depends` entry against the target Jahia version before migrating** — the set may be dead on
the target platform for reasons unrelated to JSP.

## The site is created but every page 404s

`settings/import.xml` is missing. It seeds the site skeleton — without it the site has no home page,
which reads as a broken template set. The JSP equivalent was `src/main/import/repository.xml`,
packaged to `META-INF/import.zip` by `jahia-maven-plugin`.

## Build failures when migrating in place

These come from the old module's files still sitting in the repo.

| Symptom | Cause | Fix |
|---|---|---|
| hundreds of `TS7005`/`TS2339` in vendored JS | scaffold `tsconfig` is `"include": ["src"]` with `allowJs` + `checkJs` | scope it: `"include": ["src/types.d.ts","src/templates","src/components"]`, `"exclude": ["src/main"]` |
| `module is not defined in ES module scope` | a legacy CommonJS `*.config.js` under the new `"type": "module"` | delete it, or rename to `.cjs` |
| every node type declared twice | `files: ["src/**/*.cnd"]` also matches the legacy `src/main/resources/META-INF/definitions.cnd`, and the engine merges **all** `.cnd` | narrow to `src/components/**/*.cnd` and `src/templates/**/*.cnd` |

## Tooling

- **`npm init @jahia/module` may not be scriptable.** Non-interactive `--yes` is recent; older
  published versions prompt regardless and die on an unsettled top-level await. Check before
  relying on it in an automated flow. `npm init` also swallows flags without a `--` separator.
- **A Jahia container may not reach Nexus.** `installBundle: mvn:…` then fails with
  `java.io.IOException`; fetch the jar host-side and push it through
  `POST /modules/api/provisioning` instead.
- **Community modules use a different groupId** — e.g. `bootstrap5-components` is under
  `org.jahiacommunity.modules`, not `org.jahia.modules`.
- **`autoStart` does not always start the bundle.** If it stays `INSTALLED` after a clean deploy,
  send an explicit `startBundle` provisioning script.
- **Output is never byte-identical to the JSP.** React SSR emits `itemProp`, `frameBorder`,
  `allowFullScreen` in camelCase. Browsers lowercase attribute names so behaviour matches, but a
  parity check must compare semantically, never textually.
