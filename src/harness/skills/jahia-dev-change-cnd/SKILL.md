---
name: jahia-dev-change-cnd
description: Changes a content type definition (CND) that is already deployed on an instance whose content must be kept — production, or any environment you cannot wipe — without a refused deployment, and migrates that content. Covers changing a property's type (string to boolean, string to long), renaming it, making it internationalized, removing a property or a choicelist value, and making a property mandatory. Jahia refuses these changes at install time, even when no content uses the property, and the provisioning API reports the refusal as an empty install list, not as an error. During development, with content you can throw away, change the CND freely and skip this skill. Use before a release that changes a deployed CND, when a deploy without `ignoreChecks` returns `"install":[]` (for `{}` from `yarn jahia-deploy`, use jahia-dev-debug), or when the Jahia log says "Major change in definition … cancel module deployment". Gives the table of accepted and refused changes, the new-property-with-fallback procedure, and a tested Groovy migration script.
allowed-tools: Bash, Read, Edit, Grep
---

# Changing a content type that is already deployed

When a module is installed, Jahia compares each type in its CND with the definition already
registered. A **major** change cancels the whole module deployment. The check runs on the
definition, not the content: a property that no node uses is protected exactly like one used on
every page. The previous version of the module keeps running.

## Step 0 — Development or production?

**This skill is for production**: any instance whose content must survive the change, such as
production, a shared staging or a customer's environment. There, a refused change blocks the
release and the content cannot be thrown away.

**During development, breaking changes are fine.** Change the type, rename, remove: then make the
local instance accept it and recreate the content you need.

- **JavaScript modules** deployed with `yarn jahia-deploy` skip the breaking-change detection: the
  script sends `ignoreChecks: true` unless `JAHIA_IGNORE_CHECKS=false`, so the deploy goes through.
  Content already stored keeps its old values: update or recreate it.
- **Java and JSP modules** (a bundle with `META-INF/*.cnd`) are checked even in development mode:
  the refusals in the table below were all observed on an instance in development mode. Start again
  from an empty Jahia (`docker compose down --volumes && docker compose up --wait`, which **deletes
  every site of the instance**; ask the developer first), then reimport or recreate the content.

Then ask whether the change will ever reach an instance with content to keep. When the type was
already released, the development shortcut only moves the refusal to the production deployment:
follow this skill before the release.

The table and the procedure below were verified on Jahia 8.2.3.2 with a Java/JSP module.

## Step 1 — Look the change up

| Change on an existing type | Verdict | Content impact |
| --- | --- | --- |
| Add an optional property (with or without `autocreated` and a default) | Accepted | Existing nodes do not get it: autocreated applies to new nodes only |
| Add a `mandatory` property | **Refused** | |
| Change a property's type (`string` → `boolean`, …) | **Refused** | |
| Rename a property | **Refused** (it is a removal plus an addition) | |
| Remove a property, even unused by any node | **Refused** | |
| Add or remove `internationalized` | **Refused** | |
| Add `mandatory` to an existing property | **Refused** | |
| Add a value to a choicelist constraint (`< 'a', 'b', 'c'`) | Accepted | **One way**: removing that value later is refused |
| Remove a value from a constraint | **Refused** | |
| Change a default value | Accepted | Existing nodes keep their value |
| Add or remove `autocreated` | Accepted | |
| Add `hidden` | Accepted | Editors stop seeing the field; the value stays |
| Add or remove `indexed=no` | Accepted | Reindex the site afterwards (Jahia Tools > Search engine management) |

Read from the code of the 8.2.3.2 checker, not tested: changing `multiple` is also major, and
bumping the module version does not skip the check, which runs whenever the bundle carries the
newest definitions. On an instance whose content must be kept, no setting gets past a refusal.

Every accepted deploy becomes the new baseline. Try definition changes on a disposable local
instance, never on a shared one: a value you add to a choicelist there can never be removed again.

## Step 2 — Read the verdict of a deploy

The provisioning API answers `200` for a refused module. Read the body:

```text
[{"uninstall":[],"install":[],"start":[]}]                       ← nothing installed: refused or failed
[{"install":[{… "message":"Operation successful"}], "start":[…]}]  ← accepted
```

Then the log, which names the type, the property and the operation (`MODIFIED`, `REMOVED`, `ADDED`):

```bash
docker compose logs jahia --since 5m | grep -E "Major change in definition|Installation failed"
# Major change in definition : [nodeTypeName=jdmix:menuLimits,type=MAJOR,
#   propDefDiffs={[itemName=hideHome,type=MAJOR,operation=MODIFIED]}], cancel module deployment
```

`docker compose logs --since` takes a timestamp in UTC only with a trailing `Z`
(`2026-10-13T09:00:00Z`). Without it, the window shifts by your timezone and shows old refusals.

Confirm what is registered with the `content.type` MCP tool. It does not list `hidden` properties.

## Step 3 — Replace a property instead of changing it

For every refused change in the table, add a new property and keep the old one. Example: `hideHome`
was a `'Yes'`/`'No'` string that should be a boolean.

1. **Find where the type is used**, in both workspaces: `SELECT * FROM [jdmix:menuLimits]` (or the
   `content.search` MCP tool with that `nodeType`). Note values outside the expected ones, such as
   `yes` in lower case. Usage decides whether step 5 is needed. It does not change the CND:
   the change is refused either way.

2. **CND.** Leave the old property as it is, and mark it `hidden`. Add the new one, optional:

   ```cnd
   - hideHome (string, choicelist[resourceBundle]) = 'Yes' autocreated hidden < 'Yes', 'No'
   - hideHomePage (boolean) = true autocreated
   ```

   - Change nothing else on the old line except `hidden` and `autocreated`: its type, constraints and
     `internationalized` are frozen.
   - Never make the new property `mandatory`: that is refused. Enforce it in the view if needed.
   - Pick a new name that reads well for years: you cannot rename it later either.

3. **Labels.** The new property takes the old label, and the old one is marked as legacy:

   ```properties
   jdmix_menuLimits.hideHome=Hide the home page from the menu? (legacy)
   jdmix_menuLimits.hideHomePage=Hide the home page from the menu?
   ```

4. **View: read the new property, fall back to the old one** with exactly the logic the old view
   had. Nodes that were not migrated yet, live content until the next publication, and site exports
   made before the change all keep working:

   ```groovy
   /* hideHome is the legacy 'Yes'/'No' string, read only when hideHomePage is not set */
   def hideHomePage = renderContext.site.properties['hideHomePage']
   def hideHome = renderContext.site.properties['hideHome']
   hideHomeValue = hideHomePage ? hideHomePage.boolean : (hideHome ? hideHome.string == "Yes" : false)
   ```

   ```jsp
   <c:set var="hideHome" value="${not empty currentNode.properties.hideHomePage
       ? currentNode.properties.hideHomePage.boolean
       : currentNode.properties.hideHome.string eq 'Yes'}"/>
   ```

   ```tsx
   const hideHome = props.hideHomePage ?? props.hideHome === "Yes";
   ```

   The Groovy version was run; the JSP and TSX lines carry the same logic. Deploy, then check the verdict (Step 2) and render a page that uses the type.

5. **Migrate the values** when Step 1 found nodes. Copy
   [references/migrate-property.groovy](references/migrate-property.groovy) and set its five
   settings: `DRY_RUN`, `NODE_TYPE`, `OLD`, `NEW`, and `convert`, which must reproduce what the old
   view did (here, anything but `"Yes"` meant false). The script:
   - writes the **default** workspace only, with a system session as root, and does not publish. Live
     receives the value at the next publication, and the fallback covers it until then. Never write
     `live` directly to save a publication;
   - skips nodes that already have the new property, so it can run again safely;
   - logs one line per node and a summary, and warns about nodes locked by an editor in Content
     Editor (`j:lockTypes` = `root:engine`). The system session writes through that lock.

   Run it through the provisioning API, which keeps the script in the repository:

   ```bash
   printf -- "- executeScript: 'migrate-property.groovy'\n" > migrate.yaml
   curl -sS -u root:root1234 -F "script=@migrate.yaml;type=text/yaml" \
     -F "file=@migrate-property.groovy" http://localhost:8080/modules/api/provisioning
   docker compose logs jahia --since 2m | grep migrate-property
   ```

   or paste it into the Groovy console (Jahia Tools > Administration and Guidance > Groovy console).
   Run with `DRY_RUN = true`, read every line, run with `false`, then run again: the summary must
   show only `alreadyDone`. Render a page where the old value was `'Yes'` and one where it was
   `'No'`.

6. **Keep the old property.** Removing it from the CND is refused, even once no node holds a value.
   Jahia Academy suggests removing it after clearing every value; on 8.2.3.2 the deploy that removes
   it is cancelled. Leave it `hidden`, keep the fallback while old site exports may be imported, and
   state in the changelog that the property is legacy.

## Other changes

- **Make a property internationalized:** same procedure. The new property is `i18n`, and the
  migration writes `node.getOrCreateI18N(locale).setProperty(NEW, value)` for each language of the
  site instead of `node.setProperty`.
- **Narrow a choicelist:** refused. Replace the property (Step 3), or keep the value in the
  constraint and handle it in the view.
- **Rename a property:** Step 3 with the same type; `convert` returns the value unchanged
  (`{ value -> value.getString() }` for a string).

Source for the content side of this procedure: [Jahia Academy, migrating and modifying node
types](https://academy.jahia.com/documentation/jahia-cms/jahia-8.2/developer/creating-and-managing-content-types/managing-definitions/migrating-and-modifying-nodetypes).
