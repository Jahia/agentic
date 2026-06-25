---
name: jahia-dev-ui-extension
description: Conventions and patterns for building Jahia OSGi UI extensions — modules that extend the jcontent back-office (actions, panels, dialogs) using React 18, Webpack/Module Federation, and the @jahia/ui-extender registry. Distinct from JS template sets (React 19, Vite).
---

# SKILL — Jahia OSGi UI Extension

## When this skill applies

You are extending the **jcontent back-office** — adding toolbar actions, admin panels, dialogs, or sidebar panels that editors see inside jcontent / Page Builder. This is **not** about rendering the public-facing site (that is the JS template set track).

Key indicators:
- `@jahia/ui-extender` in `package.json`
- `@jahia/webpack-config` / `webpack.config.js` (not Vite)
- Output to `src/main/resources/javascript/apps/`
- React 18, not React 19

---

## React version distinction — critical

| Module type | React version | Build tool | Library |
|---|---|---|---|
| **JS template set** (public site) | React **19** | Vite | `@jahia/javascript-modules-library` |
| **OSGi UI extension** (back-office) | React **18** | Webpack + Module Federation | `@jahia/ui-extender` |

Never mix them. A UI extension that imports React 19 APIs will silently break in jcontent. A template set that uses `@jahia/ui-extender` won't work in the page renderer.

---

## Scaffold a new UI extension module

Use archetype **4** (`jahia-reactjs-admin-module-archetype`) which scaffolds the Webpack/Module Federation wiring automatically.

```bash
mvn archetype:generate -Dfilter=org.jahia.archetypes:
```

At the prompts:
1. Enter `4` → `jahia-reactjs-admin-module-archetype` (Jahia DXP >= 8)
2. Enter the latest version
3. Fill in the properties, then confirm with `Y`

| Property | Example | Notes |
|---|---|---|
| `artifactId` | `my-ui-extension` | Maven artifact ID and folder name |
| `moduleName` | `My UI Extension` | Human-readable name shown in Jahia UI |
| `groupId` | `org.example.modules` | Java package root |
| `jahiaVersion` | `8.2.0.0` | **Always `8.2.0.0`** — the archetype default is outdated |
| `version` | `1.0.0-SNAPSHOT` | Module version |
| `package` | `org.example.modules` | Java package |

> ⚠️ After generation, update `react` and `react-dom` in `package.json` to `^18.3.1`. The archetype may scaffold an older React 18 minor — always pin to the latest React 18.x.

Build to verify:

```bash
cd <artifactId>
mvn clean install   # runs yarn build:production via frontend-maven-plugin
```

---

## Module structure

```
<module>/
├── pom.xml                                   # Maven OSGi bundle
├── package.json                              # Webpack/JS config
├── webpack.config.js
├── babel.config.js
├── src/
│   ├── javascript/                           # React / JS sources
│   │   ├── index.js                          # Entry point — registers jahiaApp-init callback
│   │   ├── init.js                           # Async init — loads i18n, calls register functions
│   │   ├── <Feature>/
│   │   │   ├── <Feature>.jsx                 # React component
│   │   │   ├── register<Feature>.js          # registry.add() call
│   │   │   ├── dialogManager.js              # Portal pattern (if feature has a dialog)
│   │   │   └── gql/
│   │   │       └── <Feature>.mutations.js    # Apollo mutations
│   │   └── AdminPanel/                       # Optional admin panel
│   │       ├── AdminPanel.jsx
│   │       └── AdminPanel.routes.jsx
│   └── main/
│       ├── java/org/jahia/<org>/<module>/
│       │   ├── actions/                      # Java Actions (@Component service = Action.class)
│       │   └── services/                     # OSGi services (@Component)
│       └── resources/
│           ├── META-INF/configurations/      # OSGi .cfg files
│           └── javascript/
│               ├── apps/                     # Webpack output (do not edit)
│               └── locales/                  # i18n JSON files
│                   ├── en.json
│                   └── fr.json
```

---

## Build stack

### package.json key fields

```json
{
  "jahia": {
    "remotes": {
      "jahia": "javascript/apps/remoteEntry.js"
    }
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@jahia/ui-extender": "^1.x",
    "@jahia/moonstone": "^2.x",
    "@jahia/data-helper": "^1.x",
    "@apollo/client": "^3.x"
  },
  "devDependencies": {
    "@jahia/webpack-config": "^1.x"
  }
}
```

### webpack.config.js

```javascript
const { getModuleFederationConfig } = require('@jahia/webpack-config');
const packageJson = require('./package.json');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = (env, argv) => ({
    entry: { main: './src/javascript/index' },
    output: {
        path: path.join(__dirname, 'src/main/resources/javascript/apps/'),
        publicPath: 'auto',
        filename: 'jahia.bundle.js',
        chunkFilename: '[name].jahia.[chunkhash:6].js',
    },
    module: {
        rules: [
            { test: /\.(js|jsx)$/, use: 'babel-loader', exclude: /node_modules/ },
            { test: /\.module\.css$/, use: ['style-loader', { loader: 'css-loader', options: { modules: true } }] },
            { test: /\.css$/, exclude: /\.module\.css$/, use: ['style-loader', 'css-loader'] },
        ],
    },
    plugins: [
        new ModuleFederationPlugin(getModuleFederationConfig(packageJson)),
    ],
});
```

`@jahia/webpack-config/getModuleFederationConfig` reads the `jahia.remotes` field from `package.json` and configures shared dependencies (React, MUI, Apollo) as singletons — this is what prevents version conflicts with jcontent's own React 18 instance.

### Maven — frontend-maven-plugin

```xml
<plugin>
    <groupId>com.github.eirslett</groupId>
    <artifactId>frontend-maven-plugin</artifactId>
    <executions>
        <execution>
            <id>install-node-and-yarn</id>
            <goals><goal>install-node-and-yarn</goal></goals>
            <configuration>
                <nodeVersion>v20.x.x</nodeVersion>
                <yarnVersion>v1.22.x</yarnVersion>
            </configuration>
        </execution>
        <execution>
            <id>yarn-install</id>
            <goals><goal>yarn</goal></goals>
        </execution>
        <execution>
            <id>yarn-build</id>
            <goals><goal>yarn</goal></goals>
            <configuration>
                <arguments>build:production</arguments>
            </configuration>
        </execution>
    </executions>
</plugin>
```

Build scripts in `package.json`:
- `build`: `yarn lint && webpack` (dev — fast, no minification)
- `build:production`: `webpack --mode=production` (for Maven/CI)
- `dev`: `webpack --watch` (interactive dev only — never run from an agent)

### Deploy

```bash
# Always use this for agentic builds
mvn clean install -pl .

# Or if a deployer script is configured:
yarn build && mvn install -DskipTests
```

---

## Registering UI extensions (JavaScript side)

### Entry point pattern

```javascript
// src/javascript/index.js
import { registry } from '@jahia/ui-extender';

export default function () {
    registry.add('callback', 'my-module', {
        targets: ['jahiaApp-init:50'],   // runs early in jcontent lifecycle
        callback: async () => {
            const { default: register } = await import('./init');
            register();
        }
    });
}
```

```javascript
// src/javascript/init.js
import i18next from 'i18next';
import { registerMyAction } from './MyAction';

export default async function () {
    await i18next.loadNamespaces('my-module');   // load translations before registering UI
    registerMyAction();
}
```

The `jahiaApp-init:N` priority controls load order. Use 50 for normal modules; use lower numbers only if another module must see your registry entries at init time.

> **SelectorType registration** uses the same `registry.add` mechanism — `registry.add('selectorType', 'MyKey', { cmp, dataType, adaptValue, initValue })` — wired to a CND property via a JSON fieldset override in `settings/content-editor-forms/fieldsets/`.

### Action registration

```javascript
// src/javascript/MyAction/registerMyAction.js
import React from 'react';
import { registry } from '@jahia/ui-extender';
import { Download } from '@jahia/moonstone';
import { MyAction } from './MyAction';

export const registerMyAction = () => {
    registry.addOrReplace('action', 'myActionName', {
        targets: ['contentActions:900'],    // toolbar position (higher number = lower priority)
        buttonIcon: <Download />,
        buttonLabel: 'my-module:action.myAction.label',
        showOnNodeTypes: ['jnt:page'],      // visibility filter
        component: MyAction,
    });
};
```

Common targets:
- `contentActions:N` — jcontent content toolbar
- `headerPrimaryActions:N` — jcontent header
- `publishMenu:N` — publish menu
- `contextualMenu:N` — right-click menu

### Action component pattern

```jsx
// src/javascript/MyAction/MyAction.jsx
import React from 'react';
import { Language } from '@jahia/moonstone';
import { useNodeChecks } from '@jahia/data-helper';

export const MyAction = ({ path, render: Render, ...otherProps }) => {
    const { checksResult } = useNodeChecks({ path, Language }, {
        showOnNodeTypes: ['jnt:page'],
        hideOnNodeTypes: ['jmix:someExcludedMixin'],
        hideForPaths: ['^/sites/((?!/).)+/SomeFolder/?$'],  // regex supported
        requiredPermission: ['myPermission'],                // always an array
        requireModuleInstalledOnSite: ['my-module'],
    });

    if (Render && checksResult) {
        return <Render {...otherProps} onClick={handleClick} />;
    }

    return null;
};
```

`useNodeChecks` returns `checksResult: true` only when all declared conditions pass. When `false`, the action is hidden from the UI.

> ⚠️ **Always include `requireModuleInstalledOnSite`** — without it, the action appears on every Jahia site regardless of whether the module is installed there. This is the primary guard that scopes a UI extension to sites where it is relevant.

### `useNodeChecks` — full options

All options are optional. An action is visible only when all provided conditions pass.

```jsx
const { checksResult } = useNodeChecks({ path, Language }, {
  showOnNodeTypes: ['jnt:page', 'jnt:file'],
  hideOnNodeTypes: ['jmix:externalLink'],
  requiredPermission: ['jcr:write'],               // always use arrays
  requiredSitePermission: 'adminTemplates',
  requireModuleInstalledOnSite: ['my-module'],     // always include — scopes to active sites
  showForPaths: ['/sites/mySite/home'],
  hideForPaths: ['^/sites/((?!/).)+/Drafts/?$'],   // regex supported
  hideOnExternal: true,
});
```

---

## Dialog pattern

When an action opens a dialog, use a portal manager — the dialog must be rendered outside the jcontent component tree to avoid focus-trap and z-index issues.

```javascript
// dialogManager.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { MyDialog } from './MyDialog';

class DialogManager {
    _init() {
        if (!this.root) {
            const container = document.createElement('div');
            container.id = 'my-module-dialog-root';
            document.body.appendChild(container);
            this.root = ReactDOM.createRoot(container);
        }
    }

    open({ path, language, apolloClient }) {
        this._init();
        this.root.render(
            <ApolloProvider client={apolloClient}>
                <I18nextProvider i18n={i18next}>
                    <MyDialog path={path} language={language} onClose={() => this.close()} />
                </I18nextProvider>
            </ApolloProvider>
        );
    }

    close() {
        this.root?.render(null);
    }
}

export default new DialogManager();
```

> ⚠️ **Always use `<Dialog disableEnforceFocus>`** when rendering in a portal. Without it, MUI's FocusTrap fights with jcontent's own focus management and causes an infinite loop.

```jsx
// MyDialog.jsx
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

export const MyDialog = ({ path, language, onClose }) => (
    <Dialog open fullWidth maxWidth="sm" disableEnforceFocus onClose={onClose}>
        <DialogTitle>...</DialogTitle>
        <DialogContent>...</DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleAction}>Confirm</Button>
        </DialogActions>
    </Dialog>
);
```

---

## Runtime APIs (window.jahia.*)

These are injected by jcontent at runtime. Always check for existence before calling.

```javascript
// Toast notification
if (window.jahia?.toastDispatcher) {
    window.jahia.toastDispatcher.add({
        message: t('myMessage'),
        variant: 'success'   // 'success' | 'error' | 'warning' | 'info'
    });
}

// JCR node/folder picker
if (window.CE_API?.openPicker) {
    window.CE_API.openPicker({
        type: 'folder',           // 'folder' | 'image' | 'file' | 'page' | 'content'
        isMultiple: false,
        site: window.contextJsParameters?.siteKey,
        lang: window.contextJsParameters?.uilang,
        initialSelectedItem: [],
        setValue: ([selected]) => {
            if (selected?.path) setPath(selected.path);
        }
    });
}

// Runtime context
const { siteKey, uilang, currentUser } = window.contextJsParameters ?? {};
```

---

## i18n conventions

Locale files live at `src/main/resources/javascript/locales/<lang>.json`. The top-level key is the module namespace. Always load the namespace before registering UI:

```json
{
  "my-module": { "label": "My Module" },
  "action": { "myAction": { "label": "Do Something" } },
  "dialog": {
    "title": "...",
    "button": { "cancel": "Cancel", "confirm": "Confirm" }
  }
}
```

Use `useTranslation('my-module')` in components.

---

## Java Action pattern

```java
@Component(service = Action.class)
public class MyAction extends Action {

    @Override
    public String getName() {
        return "myActionName";   // matches CSRF whitelist key
    }

    @Override
    public ActionResult doExecute(
            HttpServletRequest request,
            RenderContext renderContext,
            Resource resource,
            JCRSessionWrapper session,
            Map<String, List<String>> parameters,
            URLResolver urlResolver) throws Exception {

        String param = readParameter(parameters, "paramName", null);

        // Return binary response
        HttpServletResponse response = renderContext.getResponse();
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/pdf");
        response.getOutputStream().write(bytes);
        return ActionResult.OK;

        // OR return JSON:
        // JSONObject result = new JSONObject();
        // result.put("key", "value");
        // return new ActionResult(HttpServletResponse.SC_OK, null, result);
    }
}
```

Action endpoint URL: `POST /cms/render/default/{language}{nodePath}.{actionName}.do`

### CSRF guard configuration

```properties
# src/main/resources/META-INF/configurations/org.jahia.modules.jahiacsrfguard-<moduleName>.cfg
whitelist = *.myActionName.do
```

---

## RenderContext setup

When an Action needs to render a page to HTML, the `RenderContext` fields must be set in this exact order:

```java
Resource htmlResource = new Resource(node, "html", null, Resource.CONFIGURATION_PAGE);
RenderContext ctx = new RenderContext(request, response, renderContext.getUser());
ctx.setSite(renderContext.getSite());          // 1. site first
ctx.setWorkspace("live");                      // 2. then workspace
ctx.setServletPath("/live");                   // 3. then servlet path (must match workspace)
ctx.setMainResource(htmlResource);             // 4. main resource last
String html = renderService.render(htmlResource, ctx);
```

> ⚠️ Order matters. Setting workspace before site or mainResource before workspace causes silent rendering errors.

---

## Embedding third-party libraries in the bundle

When a library is not provided by Jahia at runtime:

```xml
<dependency>
    <groupId>org.jsoup</groupId>
    <artifactId>jsoup</artifactId>
    <version>1.17.2</version>
</dependency>

<plugin>
    <groupId>org.apache.felix</groupId>
    <artifactId>maven-bundle-plugin</artifactId>
    <configuration>
        <instructions>
            <Embed-Dependency>jsoup;inline=false</Embed-Dependency>
            <DynamicImport-Package>*</DynamicImport-Package>
        </instructions>
    </configuration>
</plugin>
```

For libraries using the Java `ServiceLoader` SPI, instantiate their classes directly using the **bundle's own classloader** — not via global registries that become stale after bundle refresh.

Switch the Thread Context ClassLoader (TCCL) for any library that uses `Thread.currentThread().getContextClassLoader()` internally:

```java
ClassLoader original = Thread.currentThread().getContextClassLoader();
Thread.currentThread().setContextClassLoader(getClass().getClassLoader());
try {
    // ... call to embedded library
} finally {
    Thread.currentThread().setContextClassLoader(original);
}
```

---

## Validation checklist

### JavaScript side
- [ ] `package.json` lists React 18, not 19
- [ ] `@jahia/webpack-config` used for Module Federation
- [ ] Entry point registers at `jahiaApp-init:N` via `registry.add('callback', ...)`
- [ ] i18n namespace loaded (awaited) before registering UI
- [ ] Action component uses `useNodeChecks` for visibility
- [ ] `requireModuleInstalledOnSite` included in all `useNodeChecks` calls
- [ ] Dialog rendered via portal manager (outside jcontent tree)
- [ ] `<Dialog disableEnforceFocus>` on all MUI dialogs in portals
- [ ] `window.jahia.*` APIs guarded with optional chaining (`?.`)
- [ ] Webpack output goes to `src/main/resources/javascript/apps/`

### Java side
- [ ] Action class: `@Component(service = Action.class)`, `getName()` matches CSRF whitelist key
- [ ] CSRF Guard config file present and correctly named
- [ ] RenderContext set in order: site → workspace → servletPath → mainResource
- [ ] All JCR access runs as the calling user (no system session escalation)
- [ ] OSGi config `.cfg` file present for every configurable service
- [ ] `Embed-Dependency` declared in BND config for every embedded lib

---

## References

- jcontent UI extension API: https://academy.jahia.com/documentation/developer/jahia/8
- @jahia/ui-extender: https://github.com/Jahia/ui-extender
- @jahia/moonstone component library: https://moonstone.jahia.com
- @jahia/data-helper: https://github.com/Jahia/data-helper
- Module Federation docs: https://webpack.js.org/concepts/module-federation/
