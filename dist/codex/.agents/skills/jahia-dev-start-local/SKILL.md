---
name: jahia-dev-start-local
description: Starts a local Jahia instance for development and guides the user through creating their first site. Use this after creating a template set to get a running Jahia environment.
---

## Overview

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

Once the module is deployed to Jahia, create the site via the Provisioning API — **do not use the UI**.

> ⚠️ **CRITICAL: syntax is `- createSite: ""`** — the empty string `""` after the colon is **mandatory**. Without it, Jahia returns HTTP 200 but silently creates nothing. Using `- createSite:` with nested properties is **wrong and will fail silently**.

```bash
MODULE_NAME=<module-name>   # value of "name" in package.json

cat > /tmp/create-site.yaml <<EOF
- createSite: ""
  siteKey: ${MODULE_NAME}
  title: "My Site"
  defaultLanguage: en
  serverName: localhost
  templateSet: ${MODULE_NAME}
EOF

curl -u root:root1234 -X POST -H "Content-Type: application/yaml" \
  --data-binary @/tmp/create-site.yaml \
  http://localhost:8080/modules/api/provisioning
```

Verify the site exists:
```bash
curl -s -u root:root1234 \
  -H "Content-Type: application/json" -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d "{\"query\":\"{ jcr { nodeByPath(path:\\\"/sites/${MODULE_NAME}\\\") { name } } }\"}"
```

The response must contain `"name": "<module-name>"`. If it returns `null`, the site was not created — check that `templateSet` exactly matches the deployed module name.

Then open **Page Builder** at http://localhost:8080/jahia/page-builder to start building.

---

## Validation checklist
- [ ] `docker info` succeeds (or bare metal Jahia is running)
- [ ] `docker compose up --wait` completes without errors (Docker path)
- [ ] Jahia UI is reachable at http://localhost:8080
- [ ] Module deployed to Jahia (`yarn build && yarn jahia-deploy` run; or `yarn dev` in user terminal for interactive development)
- [ ] Site created via Provisioning API (`createSite: ""` with correct templateSet)
- [ ] GraphQL confirms `/sites/<site-key>` node exists

## Troubleshooting

If anything goes wrong during setup or startup, refer to the official Jahia front-end developer setup guide:

> https://academy.jahia.com/tutorials-get-started/front-end-developer/setting-up-your-dev-environment
