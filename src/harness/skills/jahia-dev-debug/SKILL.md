---
name: jahia-dev-debug
description: Debugs a Jahia JavaScript module end-to-end — build, deploy, and runtime errors. Finds the first error after deployment using live Docker logs. Use as soon as `yarn jahia-deploy` prints `{}` or `Jahia installed nothing`, or a CND change does not show in `content.type`.
---

# Skill: jahia-dev-debug

Diagnoses why a Jahia JavaScript module fails to load. Follows the deployment pipeline from source to runtime.

---

## Step 1 — Build

From the module directory (where `package.json` is):

```bash
yarn build
```

- **Build fails** → fix the TypeScript / bundling error shown and stop here. Do not proceed to deploy until the build is clean.
- **Build succeeds** → proceed to Step 2.

---

## Step 2 — Deploy

```bash
yarn jahia-deploy
```

Interpret the output:
- `"Operation successful"` in the response → deployment was accepted. Proceed to Step 3 — the module may still fail at runtime.
- `{}`, or `Jahia installed nothing` (since `@jahia/vite-plugin` 1.3, the script also exits with code 1) → **nothing was installed**, and the previous version of the module is still running. The provisioning API answers `200` in that case. See "CND: a change is not applied" below before you look anywhere else.
- Any other error → fix the connection issue (is Docker running?) then retry.

---

## Step 3 — Watch live Docker logs

> Do NOT analyse logs that already exist — an old error is not necessarily the cause of the current issue. Start a fresh log stream, then deploy again to capture only what happens as a result of this deployment.

### 3a — Start watching logs in the background

Find the Jahia container name:

```bash
docker ps --format '{{.Names}}' | grep -i jahia | head -1
```

Then start tailing:

```bash
docker logs -f <container-name> 2>&1 | grep -v "^\s*$" &
LOG_PID=$!
```

### 3b — Deploy again while logs are streaming

```bash
yarn jahia-deploy
```

### 3c — Wait ~15 seconds, then stop the log stream

```bash
sleep 15 && kill $LOG_PID 2>/dev/null
```

### 3d — Verify component registration

```bash
docker logs <container-name> 2>&1 | grep "Registered Jahia component"
```

Expected: one line per view registered, e.g.:
```
Registered Jahia component: mymodule_view_ns:hero_default
Registered Jahia component: mymodule_view_ns:hero_small
```

If a component you just deployed is **absent** from this list, its `jahiaComponent` call was never reached — usually a syntax/import error in the view file that prevented the module from fully loading.

---

## Step 4 — Find the first error

Scan the captured log output for the **first** error that appears **after** the deploy timestamp. Common patterns to look for:

| Pattern | Likely cause |
|---|---|
| `CND parse error` / `invalid node type` | CND syntax error or illegal field declaration |
| `Cannot install package.tgz = java.io.IOException` | Jahia could not read a CND (ignore the hint about Maven repositories): see "CND: a change is not applied" |
| `Bundle package.tgz already installed, skip` | The same version without `-SNAPSHOT` is already installed: see "CND: a change is not applied" |
| `Skipping installation of package.tgz, a more recent version is already installed` | The installed version is higher than `package.json`'s, for instance after you switched branches: see "CND: a change is not applied" |
| `NoSuchNodeTypeException` | A referenced type doesn't exist (wrong namespace, typo, missing dependency) |
| `ClassNotFoundException` / `NoClassDefFoundError` | Java dependency missing |
| `Cannot set property` / `TypeError` in JS stack | View runtime error |
| `Module ... failed to start` | Any of the above |
| `Unresolved requirement` | OSGi dependency not satisfied |
| Missing `Registered Jahia component` for a specific type | View file has a syntax/import error, or `jahiaComponent` not reached |

**Focus on the first error, not the last.** Later errors are often cascading failures caused by the first one.

---

## Step 5 — Fix and retry

Once the root cause is identified:

1. Fix the issue in the source files
2. Run `yarn build` again
3. Go back to Step 2

Repeat until `yarn jahia-deploy` succeeds and the module loads cleanly (no errors in the 15-second window after deploy).

---

## Common fixes by error type

### CND: a change is not applied after `yarn jahia-deploy`

**Symptom:** the build succeeds, `yarn jahia-deploy` prints `{}` (or `Jahia installed nothing`), `content.type` still shows the previous definition, and `content.create` under the changed type answers `Constraint violation: No child node definition` for a child the new CND allows.

**Cause:** the package was not installed, and the provisioning API still answers `200`, with an empty `install` list. During development, the cause is almost always a CND that Jahia's reader refuses. `yarn build` does not parse the CND, but Jahia parses it at install. When the CND is the cause, raising the version, uninstalling the module, or redeploying the same package changes nothing.

Tell the causes apart in the Jahia log (Step 3a gives `<container-name>`):

```bash
docker logs <container-name> --since 5m 2>&1 | grep -E "Cannot install package.tgz|Skipping installation|already installed, skip"
```

- `Cannot install package.tgz = java.io.IOException`: a CND that Jahia refuses. Fix it as below.
- `Bundle package.tgz already installed, skip`: the same version without `-SNAPSHOT` is already installed. Raise the version to a `-SNAPSHOT` version above it, such as `1.0.1-SNAPSHOT` after `1.0.0`, so that the next deploys install too.
- `Skipping installation of package.tgz, a more recent version is already installed`: raise the version to a `-SNAPSHOT` version above the installed one. The Modules page of Jahia's Administration shows the installed version, and the history of `package.json` the versions committed in this repository: `git log --all -p -- package.json | grep '"version"'`.
- No line: the deploy is older than 5 minutes. Deploy again, then run the command again.

**Fix the CND, then deploy again:**

1. Look for `orderable` on a child node line with the CND checker. Print only that pattern: the other patterns of the checker do not block the install. Do not run the fix loop of `jahia-dev-review-cnd` now, and never change a property of a type that is already released while you look for the parse error.

   ```bash
   ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   CND_SCRIPT=$(find .claude .agents .kiro "$ROOT/.claude" "$ROOT/.agents" "$ROOT/.kiro" -name "check-cnd.mjs" -print -quit 2>/dev/null)
   node "${CND_SCRIPT:?check-cnd.mjs not found}" . | grep -A2 childNodeOrderable
   ```

   No output means no `orderable` on a child node line.
2. Read every line you changed since the last deploy that worked. Known refusals:
   - `orderable` on a `+` child node line: `orderable` is an option of the type, after its supertypes (`[ns:list] > jnt:content, jmix:list orderable`), never of a child node.
   - A property type or selector that does not exist, such as `(richtext)` instead of `(string, richtext)`.
   - A namespace declared outside `settings/definitions.cnd` (see below).
3. `yarn build && yarn jahia-deploy`, then check the definition with `content.type` before you create content.

Do not work around a CND that Jahia refuses. Groovy console scripts, the JCR browser, uninstalling the module, deleting `/modules/<module>`, or `POST /modules/api/bundles` take an hour and fix nothing. `/modules/api/bundles` also runs the breaking-change check that `yarn jahia-deploy` skips, so it refuses every major change as `Major change in definition`.

### CND: `j:linknode` or `j:url` declared explicitly
These fields are injected by Jahia's `linkTypeInitializer` mixin. Remove them from the CND.

### CND: unknown mixin or type
Check that the namespace is declared at the top of `settings/definitions.cnd` and that all referenced types exist. A namespace declared a second time in a component `definition.cnd` breaks the merged CND file instead: every `<prefix = 'uri'>` line belongs in `settings/definitions.cnd` only.

### import.xml: reference to a non-existent type
Any `jcr:primaryType` or `jcr:mixinTypes` value in `import.xml` must exist in the deployed CND. Check for typos.

### import.xml: `jmix:nolive` used as `jcr:primaryType`
`jmix:nolive` is a mixin — it goes in `jcr:mixinTypes`, not `jcr:primaryType`.

### import.xml: OSGi fails with `missing requirement … (nodetypes=jmix:nolive)`
Every `jcr:mixinTypes` value in `import.xml` is scanned by the OSGi bundle resolver. If the mixin is not declared in the module's own CND and is not provided by a resolvable dependency, the bundle will not start. Correct spelling is `jmix:nolive` (all lowercase). Verify the mixin exists in your Jahia instance before using it in `import.xml`.

### View: module loads but page is blank
Stream the Docker logs (Step 3), redeploy with `yarn build && yarn jahia-deploy`, and load the page: a React render error is logged with the view that threw it. Never run `yarn dev` from an agent.

### View: translation keys displayed instead of text
The page shows raw keys such as `7l9zetMbU4cKpL4NxSOtL` where `settings/locales/<lang>.json` has a value. The view imports `t` from `i18next`: since JavaScript Modules 1.3, the global `t` no longer knows the module's namespace. Replace it with `const { t } = useTranslation();` from `react-i18next`, inside the component. If the view already uses `useTranslation()`, check that the key exists in the JSON file of the page language.

---

## GraalJS (server-side JS) debugging with Chrome DevTools

Use this when you need to step through server-side view code running inside GraalVM.

### Step 1 — Enable the inspector via GraphQL

In Jahia's Developer Tools > GraphQL editor, run:

```graphql
mutation {
  admin {
    jahia {
      configuration(pid: "org.jahia.modules.javascript.modules.engine.jsengine.GraalVMEngine") {
        polyGlotInspect: value(name: "polyglot.inspect", value: "0.0.0.0:9229")
        polyGlotInspectSuspend: value(name: "polyglot.inspect.Suspend", value: "false")
        polyGlotInspectSecure: value(name: "polyglot.inspect.Secure", value: "false")
      }
    }
  }
}
```

### Step 2 — Map the port

If running in Docker, ensure port `9229` is mapped in `docker-compose.yml`:

```yaml
ports:
  - "9229:9229"
```

### Step 3 — Connect Chrome

After the mutation, Jahia logs a `devtools://...` URL. Open it in Chrome (use latest; Chrome 117–118 had known debugger bugs).

### Step 4 — Set a breakpoint and debug

In Chrome DevTools Sources tab, open `<module>/dist/main.js`, set a breakpoint, then reload the page. The server-side render pauses at the breakpoint. Full scope inspection, step-over, and continue are supported.

The config file `org.jahia.modules.javascript.modules.engine.jsengine.GraalVMEngine.cfg` accepts any `polyglot.*` key as an engine option — you can persist these settings there instead of using the GraphQL mutation.
