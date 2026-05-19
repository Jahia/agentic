---
name: jahia-dev-create-template-set
description: Scaffolds a new Jahia JavaScript template set (React). Use this when asked to create a new Jahia module, website, or project.
---

## About Jahia JavaScript Modules

This skill only covers **JavaScript Modules** — React-based template sets for Jahia 8+. This is the recommended approach for all new Jahia projects.

---

## Step 1 — Check prerequisites

Before scaffolding, verify Node.js and Yarn 4+ are available:

```bash
node --version   # must be 18+
yarn --version   # must be 4+
```

If either is missing or outdated, use **mise** to install them. Fetch the latest installation instructions for the user's platform from:

> https://mise.jdx.dev/installing-mise.html

Then install Node and Yarn via mise (do not use corepack or other version managers):

```bash
mise use node@lts
mise use yarn@latest
```

Do not proceed until both `node --version` (18+) and `yarn --version` (4+) pass.

---

## Step 2 — Scaffold the module

Run the interactive CLI and **show the user its full output**:

```bash
npx @jahia/create-module@latest <project-name>
```

The CLI will prompt interactively for:

| Prompt | Guidance |
|--------|----------|
| Module name | kebab-case, e.g. `my-site` |
| Output directory | accept the default (`./<module-name>`) |
| Module type | see below |

**Module type — always choose a template set:**
- `A minimal Hello World template set` ✅ — best starting point, includes working components
- `An empty template set` — blank canvas, for experienced developers

---

## Step 3 — After generation

1. `cd <project-name>`
2. `yarn install` — install dependencies

To run the module locally, use the `/jahia-dev-start-local` skill next.

---

## Step 4 — Read and summarize the README

After scaffolding, read the generated `README.md`:

```bash
cat <project-name>/README.md
```

Summarize its contents for the user — key commands, how to start Jahia, how to deploy — and tell them: **"Make sure to read the full README.md in your module — it has everything you need to get started."**

---

## Generated structure (Hello World template set)

```
<module-name>/
├── src/
│   ├── components/        # React content type components
│   └── templates/         # Page layouts and CSS
├── settings/
│   ├── definitions.cnd    # Content type definitions
│   ├── locales/           # i18n (en.json, fr.json)
│   └── resources/         # .properties label files
├── docker-compose.yml     # Local Jahia instance
├── docker/provisioning.yml
├── package.json
├── vite.config.mjs
└── tsconfig.json
```

---

## References
- https://github.com/Jahia/javascript-modules (monorepo — includes the `create-module` archetype)

## Troubleshooting

If anything goes wrong during setup or scaffolding, refer to the official Jahia front-end developer setup guide:

> https://academy.jahia.com/tutorials-get-started/front-end-developer/setting-up-your-dev-environment

---

## Validation checklist
- [ ] `node --version` reports 18+
- [ ] `yarn --version` reports 4+
- [ ] Module directory created with expected structure
- [ ] `yarn install` completes without errors
- [ ] README.md summarized for the user
