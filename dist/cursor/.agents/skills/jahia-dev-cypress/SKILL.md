---
name: jahia-dev-cypress
description: Write and scaffold Cypress e2e tests for a Jahia JS template set. Covers test-package structure, site seeding, isolation, content setup, rendering assertions, and stable selector strategy.
---

# Skill: jahia-dev-cypress

Use this skill when a Jahia JS template set needs Cypress end-to-end coverage.
Tests should ship with the component or page template, not weeks later.

---

## Test directory layout

Tests live in a separate `tests/` directory at the module root.

```
<module>/
├── src/
├── settings/
├── tests/
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
│   │   ├── plugins/
│   │   │   └── index.js
│   │   └── support/
│   │       ├── commands.ts
│   │       ├── constants.ts
│   │       └── e2e.ts
│   └── results/
└── package.json
```

---

## Step 1 — Scaffold the Cypress package

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

Install with:

```bash
cd tests && yarn install
```

---

## Step 2 — Configure Cypress

```typescript
import { defineConfig } from 'cypress';
import * as fs from 'node:fs';

export default defineConfig({
  chromeWebSecurity: false,
  defaultCommandTimeout: 10000,
  requestTimeout: 300000,
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
      require('@jahia/cypress/dist/plugins/registerPlugins').registerPlugins(on, config);
      require('cypress-terminal-report/src/installLogsPrinter')(on, {
        printLogsToConsole: 'onFail',
        outputRoot: config.projectRoot + '/results/',
      });
      on('task', {
        readFileMaybe(filename) {
          if (fs.existsSync(filename)) return fs.readFileSync(filename, 'utf8');
          return null;
        },
      });
      return config;
    },
  },
});
```

---

## Step 3 — Keep tests isolated

### Site-per-suite isolation

Every suite should create its own site in `before()` and delete it in `after()`.
Do not rely on pre-existing sites.

```typescript
import { createSite, deleteSite } from '@jahia/cypress';

describe('Hero banner', () => {
  const SITE_KEY = 'hero-banner-tests';

  before(() => {
    cy.login();
    createSite(SITE_KEY, {
      templateSet: 'my-module',
      locale: 'en',
      languages: 'en,fr',
      serverName: 'localhost',
    });
    cy.logout();
  });

  after(() => {
    cy.login();
    deleteSite(SITE_KEY);
    cy.logout();
  });
});
```

### Session hygiene

Use `beforeEach` / `afterEach` for login boundaries when the scenario needs authentication.

---

## Step 4 — Keep the three mandatory spec files

Every component test folder should contain:

- `happy-path.cy.ts`
- `authorization.cy.ts`
- `edge-cases.cy.ts`

### Happy path

Validate the component renders correctly in live, preview, and at least one secondary locale.

### Authorization

Validate anonymous versus authenticated access where relevant.

### Edge cases

Seed only mandatory fields and verify missing optional values do not cause broken renders or 500s.

---

## Step 5 — Seed content predictably

Use `createSite`, `addNode`, and `publishAndWaitJobEnding` from `@jahia/cypress`.

```typescript
import { addNode, createSite, deleteSite, publishAndWaitJobEnding } from '@jahia/cypress';

addNode({
  parentPathOrId: `/sites/${SITE_KEY}/home/testPage/pagecontent`,
  name: 'myComponent',
  primaryNodeType: 'ns:myComponentType',
  properties: [
    { name: 'title', value: 'Hello World', language: 'en' },
  ],
});

publishAndWaitJobEnding(`/sites/${SITE_KEY}`, ['en']);
```

Prefer fixture files over long inline GraphQL strings when seeding becomes complex.

```typescript
cy.apollo({
  mutationFile: 'graphql/mutation/seedMyComponent.graphql',
  variables: { parentPath: `/sites/${SITE_KEY}/home/testPage/pagecontent` },
});
```

---

## Step 6 — Use stable selectors

CSS Modules hash class names, so do not target final generated class names directly.

```typescript
// Better: add data-testid in the component
cy.get('[data-testid="hero-banner"]').should('be.visible');

// Acceptable fallback for CSS Modules
cy.get('[class*="_card_"]').first().click();
```

Preferred approach in production views:

```tsx
<section data-testid="hero-banner" className={styles.hero}>
```

---

## Step 7 — Organize support code cleanly

- Keep `cypress/support/commands.ts` focused on command registration.
- Move larger helper implementations into small modules under `cypress/support/`.
- Put run-level cleanup in `support/e2e.ts` so repeated runs stay idempotent.
- Avoid large copy-pasted setup blocks across spec files.

---

## Guardrails

1. Never test against production data — always create isolated sites and fixtures.
2. Always clean up created sites and users in `after()` hooks.
3. Publish seeded content before asserting live renders.
4. Prefer `data-testid` selectors over CSS classes.
5. Avoid flaky `cy.wait(ms)` calls — use polling helpers or explicit conditions instead.
6. Test both the happy path and the main failure/empty-state paths.
7. Verify at least one secondary locale such as FR when the component is localized.

---

## Running tests

```bash
# From the module root
yarn build && yarn jahia-deploy

# Then run Cypress
cd tests && yarn e2e:ci
```

Use `yarn e2e:debug` locally when you need the interactive runner.

---

## Related skills

- `/jahia-dev-build-component` — build the component being tested
- `/jahia-dev-accessibility` — catch semantic and keyboard issues before or after writing e2e tests
- `/jahia-dev-create-page-template` — create the page templates that Cypress will exercise

