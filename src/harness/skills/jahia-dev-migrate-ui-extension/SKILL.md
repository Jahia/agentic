---
name: jahia-dev-migrate-ui-extension
description: Migrates a Jahia UI extension (a webpack.config.js with ModuleFederationPlugin) to Vite and @jahia/vite-federation-plugin, for app-shell 4 and 5. Use when asked to migrate a UI extension, a jContent or administration extension, to Vite, or to check that one is ready for app-shell 5.
argument-hint: "[path to the UI extension module]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Migrating a UI extension from webpack to Vite

A UI extension is a Module Federation remote: the Jahia app-shell loads its `remoteEntry.js`,
calls its `init`, and the module registers its screens and actions in the `@jahia/ui-extender`
registry. Until app-shell 4 every UI extension is built with webpack. From app-shell 4 Jahia also
loads UI extensions built with Vite, and from app-shell 5 it loads only those.

| app-shell | webpack build | Vite build |
|---|---|---|
| 4 | loads | loads |
| 5 | ignored | loads |

The app-shell loads its own copy of the shared libraries (React, i18next, redux…) before any
module. Your module always gets the app-shell's version, whatever it declares. A declared range
that excludes it only logs "Unsatisfied version" in the browser console.

## Step 1 — Read the module before you change it

Collect these facts, and write them down:

- The `exposes` of `webpack.config.js` (usually only `./init`).
- The `remotes` it imports (for example `@jahia/jcontent`).
- Every runtime library in `package.json`, and whether the source imports it (`grep -r "from '<lib>'" src`).
- The `.js` files that contain JSX.
- The stylesheets imported as an object (`import styles from './X.scss'`).
- The imports from `react-router`, `react-router-dom` and `react-router-dom-v5-compat`, and any
  `CompatRouter` or `CompatRoute`.
- The locale files under `src/main/resources/javascript/locales/` that contain `_plural` keys, and
  the `<Trans>` elements without `i18nKey`.

Then remove from `package.json` every library the source never imports. This includes the
libraries of the table in step 4: that table says how to declare a library the source imports, not
which libraries to declare. A module whose code imports `react` and `react-i18next` but never
`react-dom` or `i18next` declares `react` and `react-i18next` only. A library used for types only
goes in `devDependencies`.

## Step 2 — Toolchain

- Node 22.12 or later and Yarn 4.
- `yarn add -D vite @jahia/vite-federation-plugin`. The plugin must read `peerDependencies` (step
  4). To check the installed version, put `react` in `dependencies` and run `yarn vite build`: a
  correct plugin stops with "must be declared in `peerDependencies`". A plugin that builds anyway
  is too old: upgrade it.

## Step 3 — `vite.config.ts`

```ts
import {defineConfig} from 'vite';
import jahiaFederationPlugin from '@jahia/vite-federation-plugin';

export default defineConfig({
    build: {
        outDir: 'src/main/resources/javascript/apps' // the output directory of webpack.config.js
    },
    plugins: [
        jahiaFederationPlugin({
            exposes: {
                './init': './src/javascript/init.js' // every entry of the webpack exposes
            }
        })
    ]
});
```

- `@jahia/jcontent`, `@jahia/jahia-ui-root` and `ckeditor5` are configured as remotes already.
  Declare other remotes in `remotes`.
- If no other module imports anything from yours, set no `name`: the build then registers the
  module under its `package.json` name (`@acme/brand-checker`), and Jahia loads it whatever the
  name.
- If another module imports one of its entries (`.`, `./rules`…), set `name` to the name the other
  module uses today. Its `remotes` gives it (`'appShell.remotes.brandChecker'` → `brandChecker`).
  Otherwise open a page that loads the module and run `Object.keys(window.appShell.remotes)` in
  the browser console.
- Replace `@cyclonedx/webpack-plugin` with `rollup-plugin-sbom` if the module produces an SBOM.

## Step 4 — `package.json`

Set `"type": "module"`, `"build": "vite build"` and `"watch": "vite build --watch"`. Remove `"main"`
and every script that runs webpack. Then put every library the source imports in exactly one
section:

| Section | What the plugin does | Put here |
|---|---|---|
| `peerDependencies` | Never bundles it, and uses the app-shell's copy. | The imported libraries of the table below, and nothing else. |
| `dependencies` | Bundles it, and shares it with the other Vite modules. | Every other library the code imports at runtime (not a peer, and not one of the utilities of the next row): `@jahia/moonstone`, `@apollo/client`, `graphql-tag`, `@jahia/data-helper`, `dayjs`, `moment`, `react-router-dom`… |
| `devDependencies` | Bundles only what the code uses, and shares nothing. | Build tools, types, a copy of each peer, and the small stateless utilities `lodash` (and `lodash/*`), `clsx`, `classnames`, `prop-types`. |

The libraries the app-shell provides. Replace the module's own range with this one, even when the
module declared an older major, and copy the version into `devDependencies` so that the module
builds against the oldest version it supports:

| Library | `peerDependencies` | `devDependencies` |
|---|---|---|
| `react`, `react-dom` | `"^18.3.1 \|\| ^19.0.0"` | `"18.3.1"`, and `@types/react` / `@types/react-dom` `"~18.3"` if TypeScript |
| `react-router` | `"^5.3.4"` | `"5.3.4"` |
| `react-router-dom-v5-compat` | `"^6.30.6"` | `"6.30.6"` |
| `i18next` | `">=23.16.8 <27"` | `"23.16.8"` |
| `react-i18next` | `">=15.7.4 <18"` | `"15.7.4"` |
| `react-redux` | `"^9.3.0"` | `"9.3.0"` |
| `redux` | `"^5.0.1"` | `"5.0.1"` |
| `formik` | `"^2.4.9"` | `"2.4.9"` |
| `@jahia/ui-extender` | `"^2.0.0"` | `"2.0.0"` |
| `react-apollo`, `@apollo/react-components` | `"^3.1.5"` | `"3.1.5"` |

The build fails with a message that names the library when a library of this table is in
`dependencies`, or when `peerDependencies` holds a library the app-shell does not provide.

**`react-router-dom` v5.** Apply the router rules of step 6 first: they move every import that
`react-router` exports (`useHistory`, `useParams`, `Route`…) to `react-router`, and remove the
module's own router (`BrowserRouter`). Then:

- If the code still imports `Link` or `NavLink` from `react-router-dom`, keep it in
  `dependencies`, and put `react-router` in `peerDependencies` even if nothing imports it.
  `react-router-dom` imports `react-router` itself, and without the peer the build bundles a
  private copy of it that sees no router: every `Link` breaks.
- Otherwise remove `react-router-dom`, and put `react-router` in `peerDependencies` if the code
  imports it.

`react-apollo` and `@apollo/react-components` are removed in app-shell 5. Rewrite `<Query>`,
`<Mutation>` and `graphql()` with the `useQuery` / `useMutation` hooks of `@apollo/client`, then
remove both packages if nothing imports them any more.

Remove the webpack and Babel toolchain: `webpack`, `webpack-cli`, `webpack-bundle-analyzer`,
`@jahia/webpack-config`, `@cyclonedx/webpack-plugin`, `babel-loader`, the `@babel/*` and
`babel-plugin-*` packages that Jest does not need (next sentence), every `*-loader`, `clean-webpack-plugin`, `copy-webpack-plugin`,
`case-sensitive-paths-webpack-plugin`. If Jest still runs the tests, keep `babel-jest`, `@babel/core`
and the presets of the Babel config (usually `@babel/preset-react`) in `devDependencies`. Add `sass-embedded` if the module has `.scss` files.

## Step 5 — Files

- Delete `webpack.config.js`, and `webpack.shared.js`, `.babelrc` or `babel.config.js` when nothing
  else reads them.
- Rename each `.js` / `.ts` file that contains JSX to `.jsx` / `.tsx`, and update the imports.
- Rename each stylesheet imported as an object to `*.module.css` / `*.module.scss`, and update the
  imports. Leave the stylesheets imported for their side effect (`import './X.css'`).
- `pom.xml`: if the build runs `yarn ${yarn.arguments}`, set `<yarn.arguments>build</yarn.arguments>`.
- `pom.xml`: set `app-shell=4.0` in `<jahia-depends>` (add it, or raise the existing entry). A
  bare version is a minimum. Without it the module starts on app-shell 3, which cannot load a Vite
  remote.
- `.gitignore`: add `.__*`.

## Step 6 — Prepare for app-shell 5

- **Plural keys.** app-shell 4 reads the pair `key` / `key_plural`, and app-shell 5 reads the pair
  `key_one` / `key_other`. For each `key_plural` in a locale file, keep `key` and `key_plural`, and
  add `key_one` (the value of `key`) and `key_other` (the value of `key_plural`).
- **`<Trans>`.** Give every `<Trans>` an explicit `i18nKey`.
- **react-router.**
  - Never render a router in your module: no `CompatRouter`, `BrowserRouter` or `Router`. Jahia
    renders the router. A module that renders its own breaks the day Jahia renders
    `CompatRouter`, or inside another module that has one. When you remove it, keep the `Route` /
    `Switch` it wrapped, with absolute paths (`/brand/:id`): they match against the full URL.
  - Until Jahia announces that it renders `CompatRouter` for UI extensions, use the v5 APIs.
    Import from `react-router` everything it exports (`useHistory`, `useLocation`, `useParams`,
    `useRouteMatch`, `Route`, `Switch`, `Redirect`, `withRouter`), and from `react-router-dom`
    only `Link` and `NavLink`. The v6 APIs of `react-router-dom-v5-compat` (`useNavigate`,
    `Routes`, `element=`) throw until then: convert such code back to v5 (`useNavigate()(to)` →
    `useHistory().push(to)`, `<Routes>` → `<Switch>`, `element={<X/>}` → `render={() => <X/>}`,
    `<Navigate>` → `<Redirect>`).
  - After that announcement, convert with steps 1 to 5 of
    [react-router discussion 8753](https://github.com/remix-run/react-router/discussions/8753),
    skipping its "Setting up" step. Give the top-level `Routes` of the module absolute paths
    (`/jcontent/:siteKey/*`), because they match the full URL. The module is ready for app-shell 5
    when it imports only `react-router-dom-v5-compat` and has no `CompatRoute` left.

## Step 7 — Prove it

1. `yarn install && yarn build`. Then check under `src/main/resources/javascript/apps/`:
   - `remoteEntry.js` starts with `appShell.remotes["<name>"]=`, where `<name>` is the `name` of
     step 3 or the `package.json` name.
   - In `mf-manifest.json`, every peer has `"singleton": true` and no JS assets.
   - No file from the webpack build is left.
2. Deploy to a Jahia that runs app-shell 4 or later, open every screen and action the module adds,
   and read the browser console:
   - `Object.keys(window.appShell.remotes)` contains the module.
   - No "Unsatisfied version" mentions a library of the module, and no "doesn't exist in shared
     scope" appears.
3. Run the module's tests (Jest, Cypress).

Report the facts of step 1, the section chosen for each library, the renamed files, and what step
7 showed.

## If the module stays on webpack under app-shell 4

It keeps working, with one exception. A module built with `@jahia/webpack-config`'s default
`getModuleFederationConfig(packageJson)` bundles no copy of its shared libraries. The app-shell
stopped providing `@jahia/data-helper`, `react-router-dom`, `dayjs`, `rxjs`, `@apollo/react-hooks`
and `@apollo/react-common`, so such a module gets them from Jahia's own modules. If one of them is
missing, the console says "Shared module X doesn't exist in shared scope". Fix it by listing the
library in the third argument of `getModuleFederationConfig`, or by migrating to Vite.
