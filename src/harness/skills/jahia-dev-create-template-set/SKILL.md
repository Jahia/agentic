---
name: jahia-dev-create-template-set
description: Scaffolds a new Jahia JavaScript template set (React). Use this when asked to create a new Jahia module, website, or project.
---

## About Jahia JavaScript Modules

This skill only covers **JavaScript Modules** — React-based template sets for Jahia 8+. This is the recommended approach for all new Jahia projects.

### JS modules vs Java modules vs Next.js

| | Java Modules | JS Modules | Next.js (Headless) |
|---|---|---|---|
| Availability | All versions | 8.2+ | Depends on setup |
| Separate runtime | No | No | Yes |
| GraphQL required | No | No | Yes |
| CMS navigation/cache/auth | Yes | Yes | No |
| Packaging | Maven/jar | NPM/tgz | NPM/tgz |
| Templating | JSP | JSX | JSX |
| Module descriptor | pom.xml | package.json | Separate module |

Jahia recommends JS or Java modules for most projects. Next.js should only be chosen when integrating with an existing Next.js codebase.

### How JS modules run: GraalVM + GraalJS

Jahia JS modules run inside **GraalJS** (part of GraalVM) — a fully ECMAScript-2019-compliant JS engine on the JVM. GraalVM Native Image is **not** used (incompatible with OSGi). Official Jahia Docker images ship with GraalVM pre-configured.

**Build pipeline:** Yarn 4 + Vite. The `npm init @jahia/module@latest` scaffolder generates `vite.config.mjs` handling TypeScript, CSS Modules, and client-side JS bundles.

**tgz → OSGi transformation:** On install, Jahia converts the NPM tgz into an OSGi bundle. Key `package.json` → `MANIFEST.MF` mappings:

| package.json field | MANIFEST.MF clause |
|---|---|
| `jahia.module-dependencies` | `Jahia-Depends` |
| `jahia.server` | `Jahia-NPM-InitScript` |
| `jahia.required-version` | `Jahia-Required-Version` |
| `jahia.module-type` | `Jahia-Module-Type` |
| `jahia.static-resources` | `Jahia-Static-Resources` |

**Request flow:**
1. Browser request → Jahia servlet
2. `TemplateNodeFilter` resolves the template identifier
3. `ViewsRegistrar` resolves the JS script for the template
4. `GraalVMEngine` pulls a `ContextProvider` from its pool, renders via GraalJS
5. `<Area>` / `<Render>` components may call `RenderService` to render child views
6. Final HTML assembled and returned

The engine maintains a pool of polyglot contexts (one per thread). Each context runs all init scripts (`dist/server/index.js`) on creation. A version counter invalidates stale contexts when modules are added or removed.

---

## Step 1 — Check prerequisites

Before scaffolding, verify Node.js and Yarn are available:

```bash
node --version   # must be 22.14+
yarn --version   # must be 4.9+
```

Node 22.14+ is required. Yarn is managed by **Corepack** (bundled with Node) — no global install needed:

```bash
corepack enable yarn
```

If Node is missing or outdated, install it from [nodejs.org/en/download](https://nodejs.org/en/download) — select **for your platform** and **with Yarn**. Alternatively use mise:

```bash
mise use node@lts && corepack enable yarn
```

Do not proceed until both `node --version` (22.14+) and `yarn --version` (4.9+) pass.

---

## Step 2 — Scaffold the module

Run the interactive CLI and **show the user its full output**:

```bash
npm init @jahia/module@latest <project-name>
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

Once the project is created, the CLI will suggest commands to start it. Run them in order — they start Docker (Jahia) and push the module.

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

## Step 5 — Create a new site in Jahia

After the module is deployed (via `yarn dev` or `yarn build && yarn jahia-deploy`), create a site:

1. Open [localhost:8080](http://localhost:8080) and login with `root` / `root1234`
2. Click **My projects** → **Create New** → **Create**
3. Fill the form (site name, server name, default language)
4. Select the template set you just deployed
5. Click **Next** and **Save**
6. Open **Page Builder** to start building

---

## Generated structure (Hello World template set)

```
<module-name>/
├── .github/               # GitHub Actions (builds on push)
├── .vscode/               # VSCode config — install recommended extensions!
├── src/
│   ├── components/        # React content type components
│   └── templates/         # Page layouts
├── settings/
│   ├── content-types-icons/   # 32×32 PNG icons per content type
│   ├── definitions.cnd        # Module-level CND (mixins, base types)
│   ├── import.xml             # Content/pages provisioned on site creation
│   ├── locales/               # i18n (en.json, fr.json, ...)
│   ├── resources/             # Editor UI labels (.properties files)
│   └── template-thumbnail.png # Shown in the Jahia template picker
├── static/                # Static files (images, fonts, vendor CSS/JS)
├── docker-compose.yml     # Local Jahia instance
├── docker/provisioning.yml
├── .env                   # Environment variables for build tools
├── .node-version          # Node version pin (used by GitHub Actions)
├── package.json
├── vite.config.mjs
└── tsconfig.json
```

`static/` is served at `/modules/<name>/` — reference files there with `buildModuleFileUrl("image.png")`.

---

## References
- https://github.com/Jahia/javascript-modules (monorepo — includes the `create-module` archetype)

## Troubleshooting

If anything goes wrong during setup or scaffolding, refer to the official Jahia front-end developer setup guide:

> https://academy.jahia.com/tutorials-get-started/front-end-developer/setting-up-your-dev-environment

---

## Validation checklist
- [ ] `node --version` reports 22.14+
- [ ] `yarn --version` reports 4.9+ (via Corepack)
- [ ] Module directory created with expected structure
- [ ] `yarn install` completes without errors
- [ ] README.md summarized for the user
