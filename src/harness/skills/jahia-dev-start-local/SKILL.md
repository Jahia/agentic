---
name: jahia-dev-start-local
description: Starts a local Jahia instance for a project you just scaffolded, and guides the user through creating their first site. Use this after @jahia/create-module produced a module, or after jahia-dev-create-template-set, to get a running Jahia and a site built with that template set. Do NOT use it for a repository somebody else wrote: an existing module needs its Jahia version, its dependencies and its JDK read out of the repository first, and a broken local environment needs repair rather than a first site. Use jahia-dev-run-module for both of those.
---

## Overview

**Scope.** This skill covers a module that was just scaffolded in this repository. For a module
somebody else wrote, and for a local environment that must be repaired (a port or a mounted
directory to change, a forgotten `root` password, an empty Jahia to start again from, a build that
passes here and fails in the continuous integration), use `jahia-dev-run-module` instead.

This skill starts a local Jahia instance for development. Two approaches are available depending on the environment. Try Docker first; fall back to bare metal only if Docker is not an option.

---

## Step 1 — Try Docker first (recommended)

Check if Docker is available:

```bash
docker info
```

- If the command **succeeds** → proceed with Docker (Step 2)
- If the command **fails with a connection error** → Docker Desktop is likely not running. Tell the user: **"Please start Docker Desktop and try again."** Then retry `docker info`.
- If Docker is **not installed** → skip to Step 3 (bare metal fallback)

---

## Step 2 — Start with Docker Compose

From the module directory (where `docker-compose.yml` lives):

```bash
docker compose up --wait
```

This will:
- Pull and start a local Jahia instance
- Wait until Jahia is fully ready before returning

Once up, Jahia will be available at **http://localhost:8080**.

**Tell the user the URL and credentials** (default: `root` / `root1234` — can only be changed in `docker-compose.yml`).

Then ask the user to run the following command **themselves in a separate terminal** — do NOT run it on their behalf, as it produces continuous feedback they need to see:

```
👉 In a new terminal, from the module directory, run:

    yarn dev

This watches for file changes and pushes the compiled template set to the running Jahia instance. Leave it running while you develop.
```

> **Agent note:** `yarn dev` is for interactive human development only. When building features programmatically, always use `yarn build && yarn jahia-deploy` for explicit one-shot deploys — never start `yarn dev` from an agent.

After `docker compose up --wait`, deploy the module immediately:

```bash
yarn build && yarn jahia-deploy
```

`yarn jahia-deploy` (from `@jahia/vite-plugin` 1.2.0+) always uses curl to `http://localhost:8080` with credentials `root:root1234` — no `.env` changes needed for standard local development.

---

## Step 3 — Bare metal fallback (no Docker)

If Docker is not available, Jahia can be run locally with a JVM.

Fetch the latest download and setup instructions from:

> https://academy.jahia.com/downloads

Key requirements:
- A working JVM (Java 11 or 17)
- The Jahia distribution ZIP or installer from the downloads page

Follow the instructions on that page for the user's platform, then return here to deploy with `yarn build && yarn jahia-deploy` once Jahia is started.

---

## Step 4 — Create a new site in Jahia

Once the module is deployed to Jahia, create the site via MCP:

```
tool: site.create
args: {
  "siteKey": "<module-name>",
  "title": "My Site",
  "templateSet": "<module-name>",
  "defaultLanguage": "en",
  "serverName": "localhost"
}
```

Replace `<module-name>` with the `name` from `package.json`. `templateSet` must exactly match the deployed module name.

Verify the site exists:

```
tool: site.list
```

The site key must appear in the response. If it does not, check that `templateSet` exactly matches the deployed module name.

Then open **Page Builder** at http://localhost:8080/jahia/page-builder to start building.

---

## Validation checklist
- [ ] `docker info` succeeds (or bare metal Jahia is running)
- [ ] `docker compose up --wait` completes without errors (Docker path)
- [ ] Jahia UI is reachable at http://localhost:8080
- [ ] Module deployed to Jahia (`yarn build && yarn jahia-deploy` run; or `yarn dev` in user terminal for interactive development)
- [ ] Site created via `site.create` MCP tool with correct `templateSet`
- [ ] `site.list` confirms site key exists

## Troubleshooting

A deployed module that does not appear is a bundle that did not reach `ACTIVE`. `jahia-dev-run-module`
carries the state check and the log lines that name each cause.

For the human-facing guides:

> https://academy.jahia.com/tutorials-get-started/front-end-developer/setting-up-your-dev-environment
>
> https://academy.jahia.com/documentation/jahia-cms/jahia-8.2/developer/introducing-jahia-technical-concepts/setting-up-your-local-dev-environment-and-starting-jahia
