---
"@jahia/agentic": minor
---

Added the `jahia-dev-setup-environment` skill: writing the development environment of a Jahia project into its repository, so that every developer and the continuous integration start the same Jahia with one command. It reads what the project already has, pins the toolchain in a `mise.toml`, writes the Compose file and the provisioning manifest, and adds Elasticsearch, Augmented Search, jExperience and jCustomer as blocks to merge, each with the check that proves it works. The reference files were run end to end against Jahia 8.2.3.2, jCustomer 3.0.0 and jExperience 4.2.1. `jahia-dev-run-module` now hands the writing of an environment to it.

`jahia-dev-jexperience` no longer writes its own jCustomer stack, which pinned jCustomer 2.6 and Elasticsearch 7.17, a stack jExperience 4.2 refuses. It takes the stack from `jahia-dev-setup-environment` and keeps what is its own: Kibana on the same Elasticsearch, the events, the dashboards and their packaging. It also states that the published dashboards modules accept jExperience 3.x only, and how to read the store for the release that accepts 4.x.
