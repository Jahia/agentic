# `@jahia/agentic`

## 0.7.0

### New Features

* Added the `jahia-dev-run-module` skill: running a Jahia module that already exists, on a local Jahia, when nobody documented how. It reads the repository to tell a Java module from a JavaScript module and to find the Jahia version, the dependencies and the JDK it needs, deploys one module or a monorepo in dependency order, and verifies every bundle reached `ACTIVE` before it reports success. It carries the recovery steps for a broken local environment, and the five differences that explain a build that passes locally and fails in the continuous integration. It also pushes the project towards an environment that lives in the repository: a Docker Compose file, a provisioning manifest and a `mise.toml`, offered back to the developer instead of a `docker run` command in one shell history. `jahia-dev-start-local` now states its scope, which is a project you just scaffolded, and points at the new skill for anything else.

* Added the `jahia-dev-setup-environment` skill: writing the development environment of a Jahia project into its repository, so that every developer and the continuous integration start the same Jahia with one command. It reads what the project already has, pins the toolchain in a `mise.toml`, writes the Compose file and the provisioning manifest, and adds Elasticsearch, Augmented Search, jExperience and jCustomer as blocks to merge, each with the check that proves it works. The reference files were run end to end against Jahia 8.2.3.2, jCustomer 3.0.0 and jExperience 4.2.1. `jahia-dev-run-module` now hands the writing of an environment to it.

  `jahia-dev-jexperience` no longer writes its own jCustomer stack, which pinned jCustomer 2.6 and Elasticsearch 7.17, a stack jExperience 4.2 refuses. It takes the stack from `jahia-dev-setup-environment` and keeps what is its own: Kibana on the same Elasticsearch, the events, the dashboards and their packaging. It also states that the published dashboards modules accept jExperience 3.x only, and how to read the store for the release that accepts 4.x.

### Bug Fixes

* The harness now carries three lessons from the benchmark run of 2026-09-30, which spent 22 minutes rediscovering them. A sectioning component whose items editors drop inside it is modelled with a hidden list child type and rendered with `AbsoluteArea`, not with `+ *` on the component and `RenderChildren`, and `jahia-cnd-author`, `jahia-dev-build-component` and `jahia-dev-debug` say so, with the refusal that names the wrong model. A namespace is declared once, in `settings/definitions.cnd`, because the engine merges every CND file into one and a second declaration breaks the module. And content is created as subtrees, with the `children` of `content.create`, not one call per node.

## 0.6.0

* Added the `jahia-dev-migrate-jsp` skill: migrating an existing JSP/Java template set to a Jahia JavaScript module. It audits what is portable before any code is written, carries a tag-by-tag translation table, and names the parts that must stay in a companion Java bundle (skins, `moduleMap`-based list views, JQOM queries, choicelist initializers, render filters).

## 0.5.1

* Improved SEO and review skills.

## 0.5.0

* Added support for Antigravity and Kiro agents.

* Register MCP server on install.

## 0.4.1

* Added all Jahia mixins to the harness.

## 0.4.0

* Specialized content modeling agent.

## 0.3.0

* Replaced GraphQL with MCP for content operations. (#6)

## 0.2.0

* Added Java reviewer and Jahia-specific skills with concurrency pattern. (#4)

## 0.1.1

* Fixed execution error because of a missing shebang in the JS binary. (#2)

## 0.1.0

Initial release! 🎉
