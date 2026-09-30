---
"@jahia/agentic": minor
---

Added the `jahia-dev-run-module` skill: running a Jahia module that already exists, on a local Jahia, when nobody documented how. It reads the repository to tell a Java module from a JavaScript module and to find the Jahia version, the dependencies and the JDK it needs, deploys one module or a monorepo in dependency order, and verifies every bundle reached `ACTIVE` before it reports success. It carries the recovery steps for a broken local environment, and the five differences that explain a build that passes locally and fails in the continuous integration. It also pushes the project towards an environment that lives in the repository: a Docker Compose file, a provisioning manifest and a `mise.toml`, offered back to the developer instead of a `docker run` command in one shell history. `jahia-dev-start-local` now states its scope, which is a project you just scaffolded, and points at the new skill for anything else.
