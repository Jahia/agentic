---
name: jahia-dev-jexperience
description: Integrate a Jahia JavaScript module with jExperience and jCustomer — push visitor events from client components, verify them in Kibana, build a dashboard and package it in the module for the jExperience tab. The stack itself (Elasticsearch, jCustomer, jExperience) comes from jahia-dev-setup-environment; this skill adds Kibana on top and the dashboards modules once a release accepts the installed jExperience.
allowed-tools: Bash, Read, Write, Edit
---

## What is jExperience / jCustomer?

**jCustomer** (built on Apache Unomi) collects and processes visitor events to create personalized digital experiences. **jExperience** is the Jahia module that bridges Jahia with jCustomer — it injects the `window.wem` tracker into every page and exposes dashboards inside jContent.

Together they form Jahia's **DXP** (Digital Experience Platform). You only need this skill when you want to track interactions, build personalization, or visualize visitor data.

---

## Step 1 — Get the stack running

### 1a — jCustomer and jExperience: use `jahia-dev-setup-environment`

The stack is one Elasticsearch, one jCustomer and jExperience installed and enabled on the site.
`jahia-dev-setup-environment` step 6 carries the Compose blocks and the manifest blocks, validated
against jCustomer 3.0.0 and jExperience 4.2.1, and the `context.json` check that proves Jahia
reaches jCustomer. Run it first, in the project's existing layout (`docker-compose.yml` and
`docker/provisioning.yml` for a scaffolded module). Do not write the stack by hand here: the two
skills would drift.

### 1b — Add Kibana on the same Elasticsearch

Kibana reads the jCustomer indices, and must run the same major version as the Elasticsearch of
the stack. Merge into `docker-compose.yml`:

```yaml
services:
  kibana:
    image: docker.elastic.co/kibana/kibana:9.5.3 # same version as the elasticsearch service
    depends_on:
      elasticsearch:
        condition: service_healthy
    ports:
      - '5601:5601'
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    healthcheck:
      test: ['CMD-SHELL', 'curl -sf http://localhost:5601/api/status || exit 1']
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 30s
```

The Elasticsearch of the stack runs without security for local development, so Kibana needs no
credentials. Steps 2 and 3 need nothing more.

### 1c — The dashboards modules, when a release accepts your jExperience

Steps 4 and 5 show a Kibana dashboard inside the jExperience tab of jContent, through two modules:
`kibana-dashboards-provider` (the proxy to Kibana) and `jexperience-dashboards` (the tab). Both
declare the jExperience line they accept in `Jahia-Depends`, and a module outside that line installs
and never starts (`unresolved dependency jexperience`, see `jahia-dev-run-module` step 6).

As of jExperience 4.2.1, every published release of both modules (2.1.0 and 2.0.1) accepts
`jexperience=[3.7.0,4)` only. The next line (2.2.0, on `main`) widens it to `[3.7.0,5)`. Read the
store before you pin:

```bash
curl -s https://devtools.jahia.com/nexus/content/repositories/jahia-public-app-store/org/jahia/modules/jexperience-dashboards/maven-metadata.xml | grep '<version>'
```

Once a version exists that accepts the installed jExperience, append to the manifest:

```yaml
# Configure the Kibana proxy BEFORE installing the provider, so it starts already pointed at Kibana
- editConfiguration: 'org.jahia.modules.kibana_dashboards_provider'
  properties:
    kibana_dashboards_provider.kibanaURL: 'http://kibana:5601'
    kibana_dashboards_provider.KibanaProxy.enable: 'true'

- installOrUpgradeModule:
    - 'mvn:org.jahia.modules/kibana-dashboards-provider/<version>'
    - 'mvn:org.jahia.modules/jexperience-dashboards/<version>'
  autoStart: true

# The dashboards tab shows on the sites the module is enabled on, and on no others
- enable: 'jexperience-dashboards'
  site: '<siteKey>'
```

Then verify both bundles answer `ACTIVE`, and that the site node lists `jexperience-dashboards` in
`j:installedModules`. A missing tab in jContent is one of those two checks failing.

### 1d — Apply the change

The manifest runs when the container is created, so a manifest change needs the Jahia container
recreated. Ask the developer first, because the data volume is theirs:

```bash
docker compose up --wait          # picks up the new kibana service
docker compose down --volumes && docker compose up --wait   # only to re-run the manifest
```

---

## Step 2 — Push events from a client component

jExperience injects `window.wem` (Web Experience Manager) into every page. It is only available in the browser — use it inside `.client.tsx` files.

### Event model

Every event has two parts:

| Part | What it is | Helper |
|------|------------|--------|
| **source** | Where the event happened (usually the current page) | `wem.buildSourcePage()` |
| **target** | What happened (the action) | `wem.buildTarget(id, type, properties)` |

### Full example — feedback widget

```tsx
// src/components/FeedbackWidget/definition.cnd
// [hydrogen:feedbackWidget] > jnt:content, hydrogenmix:component
//  - question (string) = 'Was this helpful?'
```

```tsx
// Widget.client.tsx
import { useState } from "react";

export default function Widget({ question }: { question: string }) {
  const [sent, setSent] = useState(false);

  const handler = (happy: boolean) => () => {
    const source = wem.buildSourcePage();
    const target = wem.buildTarget("feedback", "click", { happy });
    const event = wem.buildEvent("click", target, source);
    wem.collectEvents({ events: [event] });
    setSent(true);
  };

  if (sent) return <aside>Thank you for your feedback!</aside>;

  return (
    <aside>
      {question}
      <button type="button" onClick={handler(true)}>Yes</button>
      <button type="button" onClick={handler(false)}>No</button>
    </aside>
  );
}
```

```tsx
// default.server.tsx
import { jahiaComponent, Island } from "@jahia/javascript-modules-library";
import Widget from "./Widget.client.jsx";

interface Props { question: string; }

jahiaComponent(
  { nodeType: "hydrogen:feedbackWidget", componentType: "view" },
  ({ question }: Props) => (
    <Island clientOnly component={Widget} props={{ question }}>
      Loading…
    </Island>
  ),
);
```

### `window.wem` API reference

| Method | Signature | Returns |
|--------|-----------|---------|
| `buildSourcePage` | `()` | Source object for the current page |
| `buildTarget` | `(id: string, type: string, properties?: object)` | Target object |
| `buildEvent` | `(eventType: string, target, source)` | Event object |
| `collectEvents` | `({ events: Event[] })` | Sends events to jCustomer |

`buildTarget` properties are free-form — pass any serializable data you want to analyse downstream (e.g. `{ happy: true }`, `{ productId: "p-123" }`).

> The `window.wem` object comes from the [apache/unomi-tracker](https://github.com/apache/unomi-tracker) package. Refer to its documentation for advanced event types.

### Google Tag Manager alternative

If your site uses GTM instead of jCustomer:

```tsx
dataLayer.push({ event: "feedback", happy });
```

---

## Step 3 — Verify events in Kibana

1. Open [localhost:5601](http://localhost:5601)
2. Go to **Discover**, create a data view on `context-event*` (the jCustomer event indices), and expand the time range
3. Browse an event — confirm the `source.properties.pageInfo.pagePath` and `target.properties.happy` fields are present

---

## Step 4 — Create a Kibana dashboard

### Create a saved search

In **Discover**, add column filters for:
- `eventType` = `click`
- `itemType` = `event`
- `target.itemId` = `feedback`
- `target.itemType` = `click`

Add display columns: `source.properties.pageInfo.pagePath`, `target.properties.happy`. Save as e.g. **All Feedbacks**.

### Create the dashboard

1. **Dashboards → Create dashboard**
2. **Add from library** → add the saved search (table of all feedbacks)
3. **Create visualization** → paste this KQL filter into the search bar:
   ```
   eventType: click and itemType: event and target.itemId: feedback and target.itemType: click
   ```
4. Drop **Records** onto the panel, then in **Break down by** select `target.properties.happy`. Use the **Status** color palette for red/green.
5. **Save and return**, then **Save** the dashboard with a meaningful name — this name becomes the entry label inside Jahia's jExperience tab.

---

## Step 5 — Package the dashboard in the module

Dashboards exported from Kibana are automatically imported when the module is deployed.

1. In Kibana go to **Analytics → Overview → Manage → Saved Objects**
2. Select your dashboard, click **Export** — you get a `.ndjson` file
3. Save it to your module:
   ```
   settings/kibana-dashboard/dashboards/<dashboard-name>.ndjson
   ```
4. Deploy the module — the dashboard will appear in the jExperience tab on any Jahia instance running the module.

---

## Validation checklist
- [ ] The stack from `jahia-dev-setup-environment` passes its own checks, and the `kibana` service is healthy
- [ ] jExperience enabled on the target site; jExperience Dashboards too, when a release accepts the installed jExperience
- [ ] jExperience tab visible in jContent
- [ ] Client component uses `.client.tsx` extension and `Island clientOnly`
- [ ] `wem.collectEvents` called with a valid event (source + target)
- [ ] Events visible in Kibana Discover under the `context-event*` data view
- [ ] Dashboard saved and visible under the jExperience tab in Jahia
- [ ] Dashboard `.ndjson` saved to `settings/kibana-dashboard/dashboards/` for packaging

## References
- Apache Unomi tracker: https://github.com/apache/unomi-tracker
- KQL query syntax: https://www.elastic.co/guide/en/kibana/current/kuery-query.html
- jExperience guide: https://github.com/Jahia/javascript-modules/blob/main/docs/2-guides/1-building-a-feedback-form/README.md
