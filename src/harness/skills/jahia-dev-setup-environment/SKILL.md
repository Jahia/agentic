---
name: jahia-dev-setup-environment
description: Writes the development environment of a Jahia project into its repository, so that every developer and the continuous integration start the same Jahia with one command. Use when a project has no docker-compose.yml, when its Jahia lives in a docker run command or a README of manual steps, when a developer asks to add a database, Elasticsearch, Augmented Search, jExperience or jCustomer to a local stack, when the toolchain (JDK, Maven, Node.js, Yarn) must be pinned with mise, or when modules installed by hand must become a provisioning manifest. Produces mise.toml, the Compose file, the provisioning manifest and the CI wait snippet. Use jahia-dev-run-module to run or repair an environment that already exists, and jahia-dev-start-local for a project just scaffolded.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Setting up the environment of a Jahia project

The environment is a set of files in the repository: a `mise.toml` for the toolchain, a Compose file
for the containers, a provisioning manifest that puts Jahia in the state the project needs, and a
short README that states the start command. Once those files exist, `docker compose up --wait` is
the whole onboarding, on a laptop and in a pipeline alike.

The reference blocks under `references/` were run end to end against Jahia 8.2.3.2, jCustomer 3.0.0
and jExperience 4.2.1. Copy them, then change the versions and the names to the project's.

> Ask the developer before you delete a container or a volume. `docker compose down --volumes`
> destroys the site on their machine, and a running instance often carries content nobody exported.

## Step 1 — Read the project before you write

```bash
ls
cat docker-compose.yml compose.yml 2>/dev/null
ls docker/ provisioning/ 2>/dev/null
cat mise.toml .tool-versions .nvmrc 2>/dev/null
ls .github/workflows/ 2>/dev/null
find . -maxdepth 3 -name pom.xml -o -maxdepth 3 -name package.json | grep -v node_modules
```

Decide three things and report them in one line before you write anything:

- **Which files already exist.** A project scaffolded with `@jahia/create-module` carries a
  `docker-compose.yml` and a `docker/provisioning.yml`. Extend those and keep their paths. Write the
  layout of the references (`docker-compose.yml` at the root, `provisioning/bootstrap.yaml`) only
  when the project has none.
- **What the modules need.** Read the Jahia version, the JDK and the module dependencies out of the
  repository, as `jahia-dev-run-module` step 2 does. Every dependency the project does not build
  goes in the manifest, pinned.
- **Where the environment lives.** One repository per module leaves the project with no home for
  these files. Recommend the monorepo, one repository for all modules with the environment at the
  root. When the repositories cannot merge now, propose a `<project>-meta` repository that holds the
  environment, the manifest, the developer documentation and optionally the module repositories as
  git submodules.

## Step 2 — Pin the toolchain

Tools installed at the machine level give every developer a different version, and the pipeline a
third one. Write `mise.toml` at the root (see `references/mise.toml`), with the JDK the POM names
(`maven.compiler.release`) and the Node.js and Yarn `package.json` names. Everyone then runs
`mise install`. On GitHub Actions, `jdx/mise-action` installs the same set.

## Step 3 — Choose the image and the database

- **Image.** `jahia/jahia-ee` for a template set or a back-end module, `jahia/jahia-discovery` when
  a UI extension needs a demo site. Pin the tag to the version deployed in production. The images
  run 30 days without a license. `JAHIA_LICENSE` takes the base64 content of the license file, and
  that value belongs in the developer's shell or the CI secrets, never in the repository.
- **Database.** Run the engine and the version of production. The reference Compose file runs
  MariaDB. For another engine, replace the `db` service with the official image and change
  `DB_VENDOR`, `DB_HOST` and `DB_PORT`:

| Engine               | `DB_VENDOR`  | Default `DB_PORT` |
| -------------------- | ------------ | ----------------- |
| MariaDB              | `mariadb`    | 3306              |
| MySQL                | `mysql`      | 3306              |
| PostgreSQL           | `postgresql` | 5432              |
| Microsoft SQL Server | `mssql`      | 1433              |
| Oracle               | `oracle`     | 1521              |

The image builds the JDBC URL from those variables when `DB_URL` is empty. No database service at
all means an embedded Derby in the data volume, acceptable for a throwaway instance only.

## Step 4 — Write the Compose file and the manifest

Copy `references/docker-compose.yml` and `references/provisioning/bootstrap.yaml`, then edit:

- The image tag, the database credentials and `SUPER_USER_PASSWORD`.
- `EXECUTE_PROVISIONING_SCRIPT` keeps the `file:` scheme. Jahia does not resolve a bare path.
- The manifest lists, in order: a private Maven repository if the project has one, every module
  the project depends on and does not build (pinned), and the site, imported from an export or
  created from a template set. The rest of the manifest is what a colleague would otherwise do by
  hand in the administration UI.

The manifest runs once, when the container is created, and again when the container is recreated.
A restart does not run it, and neither does an edit of the file. To apply a manifest change, ask
the developer, then `docker compose down --volumes && docker compose up --wait`.

## Step 5 — Start, then verify before you report

```bash
docker compose up --wait
```

Jahia answers on the HTTP port before it runs the manifest. The image installs the manifest under
the name `999-docker-provisioning.yaml`, and one log line closes it:

```bash
docker compose logs jahia | grep "999-docker-provisioning.yaml : "   # ".installed" when done
docker compose logs jahia | grep " : .failed"                        # one line per failed operation
```

A failed operation writes its own `.failed` line and leaves the verdict of the manifest at
`.installed`, so read both. Then ask the module manager for the state of every module the manifest
installed, exactly as `jahia-dev-run-module` step 6 does. `ACTIVE` is the only answer that means
the module runs, and that skill carries the table that names each other state.

## Step 6 — Optional services

Each service is a block to merge into the Compose file, and a block to append to the manifest.
Elasticsearch serves both Augmented Search and jCustomer, so the stack carries one, not two.

### Elasticsearch

- Augmented Search needs analyzers that live in Elasticsearch plugins. Build the image from
  `references/elasticsearch/Dockerfile` (`analysis-icu` is always required). Stock Elasticsearch
  fails index creation with `failed to find tokenizer under name [icu_tokenizer]`.
- Version floor: `elasticsearch-connector` 4.x ships the `elasticsearch-java` 9.1.3 client, which
  talks to a server of its version or later, never earlier. jCustomer 3.0 asks for Elasticsearch 9
  or above. `references/compose-elasticsearch.yml` pins a later 9.x.
- Keep the `es-data` volume. Without it, recreating the container empties the search index, and
  a running jCustomer does not rebuild its indices until it restarts.

### Augmented Search

Append `references/provisioning/augmented-search.yaml` and copy
`references/provisioning/index-site.graphql`. The order matters: the connector configuration goes
BEFORE the connector installs, because Jahia keeps configuration independently of the bundle, so
the connector starts already pointed at Elasticsearch. Indexation is asynchronous, and the mutation
answers with a job id even when the job then fails. The indices are the end state to check:

```bash
curl 'http://localhost:9200/_cat/indices/jahia_as*?v&h=index,docs.count'
```

No index, or a count of zero, means the indexation did not run. Augmented Search is licensed
separately. Without that entitlement, the bundle installs and never starts, which reads like a
deployment failure in the logs.

### jExperience and jCustomer

Merge `references/compose-jcustomer.yml` and append `references/provisioning/jexperience.yaml`.
Three things hold the two sides together:

- **A fixed address for Jahia.** jCustomer accepts privileged events by IP address, so the `jahia`
  service gets `ipv4_address` on a subnet the Compose file declares, and
  `UNOMI_THIRDPARTY_PROVIDER1_IPADDRESSES` names that address.
- **One shared key.** `UNOMI_THIRDPARTY_PROVIDER1_KEY` and `jexperience.jCustomerKey` must hold
  the same value. Change them together. The value in the reference is the default of the jCustomer
  image, and it belongs on a developer's machine and nowhere else, as do the `karaf` credentials.
- **Versions.** jExperience 4.2 requires Jahia 8.2.2.0, jCustomer 3.0.0 and jContent 3.7.0 or
  later, so the manifest installs jContent first.

jExperience works on the sites it is enabled on, and on no others, so the manifest ends with
`enable: 'jexperience'` per site. Verify the wiring from outside the browser:

```bash
curl -s -X POST "http://localhost:8080/modules/jexperience/proxy/<siteKey>/context.json?sessionId=check" \
  -H 'Content-Type: application/json' -d '{"source":{"itemId":"home","itemType":"page","scope":"<siteKey>"}}'
```

A `profileId` in the answer means Jahia reached jCustomer with the key. A 403 with
`No access rules found` in the Jahia log means the path is not a public proxy entry:
`/context.json` and `/eventcollector` are the two the tracker uses, and the `/cxs/...` paths
require a logged-in user with a jExperience permission. Events, personalization and dashboards
come after this stack: `jahia-dev-jexperience` covers them.

## Step 7 — The same files in the pipeline

The environment is a file in the repository, so the pipeline runs the same Compose file and the
same manifest. Wait for the manifest before the tests start, otherwise they run against an instance
with neither the modules nor the site. `references/ci-wait.sh` is the snippet; note that the check
on `.failed` is written as `grep ... && exit 1`, because a negated pipeline (`! grep`) is exempt from
`set -e` and would let the job go green.

A build that passes locally and fails in the pipeline is a difference between two environments.
`jahia-dev-run-module` step 8 lists the five to compare.

## Step 8 — Hand the environment over

- Write or update `README.md` with the start command, the URL, the credentials and the one command
  that resets the instance. Keep it short: the files answer the rest.
- Commit `mise.toml`, the Compose file, the `elasticsearch/` directory when present, the manifest and
  its GraphQL scripts. Never commit a license, a site export with customer data, or a real key.
- Anything you had to do by hand during this task is one more manifest operation or Compose line.
  Move it there before you report.

## The human-facing reference

The same ground, written for a developer, including the repository layout of a multi-module project
and the repair recipes for a broken environment:

> https://academy.jahia.com/documentation/jahia-cms/jahia-8.2/developer/introducing-jahia-technical-concepts/setting-up-your-local-dev-environment-and-starting-jahia

## Validation checklist

- [ ] The existing layout (`docker/provisioning.yml` of a scaffolded project, for one) was kept
      rather than replaced.
- [ ] `mise.toml` pins the JDK the POM names, and the Node.js and Yarn `package.json` names.
- [ ] The image tag and the database engine match production, and every module version is pinned.
- [ ] `docker compose up --wait` returned, the manifest logged `.installed`, and no `.failed` line
      follows it.
- [ ] Every module the manifest installed answers `ACTIVE`.
- [ ] With Augmented Search: `jahia_as*` indices exist with a non-zero document count.
- [ ] With jExperience: the `context.json` check answers a `profileId`.
- [ ] No container and no volume was deleted without the developer's agreement.
- [ ] `README.md` states the start command and the credentials, and no secret is in the commit.
