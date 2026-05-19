---
name: jahia-dev-cypress
description: Write and scaffold Cypress e2e tests for a Jahia JS template set. Covers directory setup, cypress.config.ts, @jahia/cypress commands, site creation/teardown, content seeding via addNode, component rendering assertions, CSS Module class selectors, and the three mandatory spec files per component.
---

# SKILL — Jahia Cypress E2E Tests

## When this skill applies

A new component, content type, or page template has been built in a JS template set and needs Cypress coverage. Per the CTO guidelines, tests ship alongside the component — not retroactively.

---

## Test directory layout

Tests live in a **separate `tests/` directory** at the module root — never inside `src/`.

```
<module>/
├── src/                         ← component code
├── settings/
├── tests/                       ← Cypress project (separate package)
│   ├── package.json
│   ├── cypress.config.ts
│   ├── .env.example
│   ├── cypress/
│   │   ├── e2e/
│   │   │   └── <component-name>/
│   │   │       ├── happy-path.cy.ts
│   │   │       ├── authorization.cy.ts
│   │   │       └── edge-cases.cy.ts
│   │   ├── fixtures/
│   │   │   └── graphql/
│   │   │       └── mutation/
│   │   │           └── *.graphql
│   │   ├── plugins/
│   │   │   └── index.js
│   │   └── support/
│   │       ├── commands.ts
│   │       └── constants.ts
│   └── results/
│       └── .gitignore
└── package.json
```

---

## Step 1 — Scaffold the test package

Create `tests/package.json`:

```json
{
    "name": "<module-name>-cypress",
    "private": true,
    "scripts": {
        "e2e:ci": "cypress run",
        "e2e:debug": "cypress open"
    },
    "devDependencies": {
        "@jahia/cypress": "^7.1.0",
        "cypress": "^14.0.0",
        "cypress-terminal-report": "^5.3.12",
        "typescript": "^5.0.0"
    },
    "packageManager": "yarn@4.12.0"
}
```

Install:

```bash
cd tests && yarn install
```

---

## Step 2 — cypress.config.ts

```typescript
// tests/cypress.config.ts
import { defineConfig } from 'cypress'
import * as fs from 'node:fs'

export default defineConfig({
    chromeWebSecurity: false,
    defaultCommandTimeout: 10000,
    requestTimeout: 300000,   // 5 min — site provisioning is slow
    responseTimeout: 300000,
    viewportWidth: 1366,
    viewportHeight: 768,
    watchForFileChanges: false,
    screenshotsFolder: './results/screenshots',
    videosFolder: './results/videos',
    e2e: {
        baseUrl: 'http://localhost:8080',
        specPattern: ['**/**.cy.ts'],
        setupNodeEvents(on, config) {
            require('@jahia/cypress/dist/plugins/registerPlugins').registerPlugins(on, config)
            require('cypress-terminal-report/src/installLogsPrinter')(on, {
                printLogsToConsole: 'onFail',
                outputRoot: config.projectRoot + '/results/',
            })
            on('task', {
                readFileMaybe(filename) {
                    if (fs.existsSync(filename)) return fs.readFileSync(filename, 'utf8')
                    return null
                },
            })
            return config
        },
    },
})
```

---

## Step 3 — constants.ts

```typescript
// tests/cypress/support/constants.ts
export const SITE_KEY = '<module-name>-tests'
export const TEMPLATE_SET = '<module-name>'   // matches module name in package.json
```

---

## Step 4 — The three mandatory spec files

Every component ships exactly these three files. Adapt to the component under test.

### `happy-path.cy.ts` — component renders correctly with valid content

```typescript
import { addNode, createSite, deleteSite, publishAndWaitJobEnding } from '@jahia/cypress'
import { SITE_KEY, TEMPLATE_SET } from '../../support/constants'

describe('<ComponentName> — happy path', () => {
    before(() => {
        cy.login()
        createSite(SITE_KEY, {
            templateSet: TEMPLATE_SET,
            locale: 'en',
            languages: 'en,fr',
            serverName: 'localhost',
        })

        // Seed a page with a test component
        addNode({
            parentPathOrId: `/sites/${SITE_KEY}/home`,
            name: 'testPage',
            primaryNodeType: 'jnt:page',
            properties: [
                { name: 'jcr:title', value: 'Test Page', language: 'en' },
                { name: 'j:templateName', value: 'simple' },
            ],
        }).then(() => {
            addNode({
                parentPathOrId: `/sites/${SITE_KEY}/home/testPage/pagecontent`,
                name: 'myComponent',
                primaryNodeType: 'ns:myComponentType',
                properties: [
                    { name: 'title', value: 'Hello World', language: 'en' },
                    { name: 'subtitle', value: 'A subtitle', language: 'en' },
                ],
            })
        })

        publishAndWaitJobEnding(`/sites/${SITE_KEY}`, ['en', 'fr'])
        cy.logout()
    })

    after(() => {
        cy.login()
        deleteSite(SITE_KEY)
        cy.logout()
    })

    beforeEach(() => cy.login())
    afterEach(() => cy.logout())

    it('renders the component in live mode', () => {
        cy.visit(`/sites/${SITE_KEY}/home/testPage.html`)
        cy.get('[data-testid="my-component"]').should('be.visible')
        cy.contains('Hello World')
    })

    it('renders the component in FR locale', () => {
        cy.visit(`/fr/sites/${SITE_KEY}/home/testPage.html`)
        cy.get('[data-testid="my-component"]').should('be.visible')
    })

    it('renders the component in preview mode', () => {
        cy.visit(`/cms/render/default/en/sites/${SITE_KEY}/home/testPage.html`)
        cy.get('[data-testid="my-component"]').should('be.visible')
    })
})
```

### `authorization.cy.ts` — access control

```typescript
import { addNode, createSite, deleteSite, publishAndWaitJobEnding } from '@jahia/cypress'
import { SITE_KEY, TEMPLATE_SET } from '../../support/constants'

describe('<ComponentName> — authorization', () => {
    before(() => {
        cy.login()
        createSite(SITE_KEY, {
            templateSet: TEMPLATE_SET,
            locale: 'en',
            serverName: 'localhost',
        })
        publishAndWaitJobEnding(`/sites/${SITE_KEY}`, ['en'])
        cy.logout()
    })

    after(() => {
        cy.login()
        deleteSite(SITE_KEY)
        cy.logout()
    })

    it('live page is publicly accessible without login', () => {
        // No cy.login() — verify anonymous access
        cy.visit(`/sites/${SITE_KEY}/home.html`)
        cy.get('body').should('be.visible')
        // Should NOT redirect to login
        cy.url().should('not.include', '/login')
    })

    it('default workspace requires authentication', () => {
        cy.visit(`/cms/render/default/en/sites/${SITE_KEY}/home.html`)
        // Unauthenticated → redirected to login or 401
        cy.url().should('satisfy', (url: string) =>
            url.includes('/login') || url.includes('/logout')
        )
    })

    it('admin can access jcontent for the site', () => {
        cy.login()
        cy.visit(`/jahia/jcontent/${SITE_KEY}/en/pages`)
        cy.get('body').should('be.visible')
        cy.url().should('not.include', '/login')
        cy.logout()
    })
})
```

### `edge-cases.cy.ts` — empty values, missing optional fields, boundary conditions

```typescript
import { addNode, createSite, deleteSite, publishAndWaitJobEnding } from '@jahia/cypress'
import { SITE_KEY, TEMPLATE_SET } from '../../support/constants'

describe('<ComponentName> — edge cases', () => {
    before(() => {
        cy.login()
        createSite(SITE_KEY, {
            templateSet: TEMPLATE_SET,
            locale: 'en',
            serverName: 'localhost',
        })

        // Seed a component with only mandatory fields — all optionals missing
        addNode({
            parentPathOrId: `/sites/${SITE_KEY}/home`,
            name: 'testPage',
            primaryNodeType: 'jnt:page',
            properties: [
                { name: 'jcr:title', value: 'Edge Case Page', language: 'en' },
                { name: 'j:templateName', value: 'simple' },
            ],
        }).then(() => {
            addNode({
                parentPathOrId: `/sites/${SITE_KEY}/home/testPage/pagecontent`,
                name: 'emptyComponent',
                primaryNodeType: 'ns:myComponentType',
                // Only mandatory properties — no optional ones
                properties: [
                    { name: 'title', value: 'Minimal', language: 'en' },
                ],
            })
        })

        publishAndWaitJobEnding(`/sites/${SITE_KEY}`, ['en'])
        cy.logout()
    })

    after(() => {
        cy.login()
        deleteSite(SITE_KEY)
        cy.logout()
    })

    it('renders without errors when optional fields are empty', () => {
        cy.visit(`/sites/${SITE_KEY}/home/testPage.html`)
        // No JS errors
        cy.on('uncaught:exception', () => false) // log but don't fail on known framework noise
        cy.get('[data-testid="my-component"]').should('exist')
        // Optional subtitle should not render a broken element
        cy.get('[data-testid="subtitle"]').should('not.exist')
    })

    it('page does not return 500 for any seeded content', () => {
        cy.request(`/sites/${SITE_KEY}/home/testPage.html`).its('status').should('eq', 200)
    })
})
```

---

## Step 5 — Seeding content via GraphQL (alternative to `addNode`)

For complex mutations (adding mixins, setting weakreference properties, bulk batches), use `.graphql` fixture files:

```graphql
# tests/cypress/fixtures/graphql/mutation/seedMyComponent.graphql
mutation seedMyComponent($parentPath: String!, $imageUuid: String!) {
    jcr {
        mutateNode(pathOrId: $parentPath) {
            addChild(
                name: "myComponent"
                primaryNodeType: "ns:myComponentType"
                properties: [
                    { name: "title", value: "Test Title", language: "en" }
                    { name: "image", type: WEAKREFERENCE, value: $imageUuid }
                ]
            ) { uuid }
        }
    }
}
```

Call from a test:

```typescript
cy.apollo({
    mutationFile: 'graphql/mutation/seedMyComponent.graphql',
    variables: { parentPath: `/sites/${SITE_KEY}/home/testPage/pagecontent`, imageUuid },
})
```

---

## Step 6 — Targeting CSS Module classes

CSS Modules hash class names at build time. Never target `.myClass` directly — use the `[class*=]` attribute selector to match the unhashed portion:

```typescript
// ❌ Fragile — class name is hashed
cy.get('.card_abc123').should('exist')

// ✅ Stable — matches the un-hashed segment
cy.get('[class*="_card_"]').should('exist')
cy.get('[class*="_card_"]').first().click()

// ✅ Better — add data-testid to the component and target that
cy.get('[data-testid="hero-banner"]').should('be.visible')
```

**Preferred approach**: add `data-testid` attributes to component root elements in production views. They survive CSS Module renaming and minification:

```tsx
// In default.server.tsx
<section data-testid="hero-banner" className={styles.hero}>
```

---

## Step 7 — Locale assertions

Always test at least EN and FR. Use `cy.visit` with the locale prefix for FR:

```typescript
// EN (default)
cy.visit(`/sites/${SITE_KEY}/home/testPage.html`)

// FR
cy.visit(`/fr/sites/${SITE_KEY}/home/testPage.html`)

// Assert locale-specific content
cy.contains('Découvrir plus')  // FR CTA label
```

---

## `@jahia/cypress` API reference

| Function | Import | Purpose |
|---|---|---|
| `cy.login()` | built-in command | Log in as root (uses `SUPER_USER_PASSWORD` env var, default `root1234`) |
| `cy.logout()` | built-in command | Log out |
| `cy.apollo({ mutationFile, variables })` | built-in command | Execute a GraphQL mutation from a fixture file |
| `cy.runProvisioningScript({ script })` | built-in command | Run a Jahia provisioning YAML |
| `createSite(siteKey, options)` | `@jahia/cypress` | Create a site programmatically |
| `deleteSite(siteKey)` | `@jahia/cypress` | Delete a site (use in `after`) |
| `addNode(variables)` | `@jahia/cypress` | Create a JCR node via GraphQL |
| `publishAndWaitJobEnding(path, locales?)` | `@jahia/cypress` | Publish content and block until the job completes |
| `uploadFile(path, target, name, mimeType)` | `@jahia/cypress` | Upload a file to the JCR |

`createSite` options:

```typescript
createSite(SITE_KEY, {
    templateSet: 'my-module',      // module name
    locale: 'en',                  // default locale
    languages: 'en,fr',           // all activated locales (comma-separated)
    serverName: 'localhost',
})
```

---

## Common pitfalls

| Pitfall | Consequence |
|---|---|
| Missing `publishAndWaitJobEnding` after seeding | Tests run against unpublished content; live page returns stale or empty render |
| Targeting hashed CSS Module class names directly | Tests break on every rebuild |
| Skipping FR assertions | i18n regressions go undetected |
| No `after` hook to delete the site | Test sites accumulate on the Jahia instance and pollute subsequent runs |
| Running `createSite` without first deleting — no teardown in prior run | Site creation fails because the key already exists |
| Relying on a pre-existing site instead of seeding | Tests are not self-contained and fail on a clean Jahia instance |
| Not wrapping login/logout in `beforeEach`/`afterEach` | Session bleeds across tests; order-dependent failures |

---

## Running tests

```bash
# Against local Jahia (http://localhost:8080)
cd tests
yarn e2e:debug    # opens Cypress UI
yarn e2e:ci       # headless, for CI
```

Jahia must be running and the module deployed before running tests. Deploy first:

```bash
# From module root
yarn build && yarn jahia-deploy
# Then run tests
cd tests && yarn e2e:ci
```
