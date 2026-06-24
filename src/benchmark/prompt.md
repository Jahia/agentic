/jahia

You are building a Jahia website from scratch for a fictional B2C insurance company named "For Sure".

> **Time budget: 45 minutes.** Prioritise completing all 4 pages over perfection.

> **Important: Use MCP tools for all content operations.** The `jahia` MCP server is pre-configured with tools for site discovery, page creation, content authoring, and media upload. Never call the Jahia GraphQL API directly for content operations — use only MCP tools so we can validate the MCP tool surface coverage. If a tool is missing or doesn't work as expected, note it in your work log below.

## Efficiency rules — follow strictly to stay within the time budget

**Rule 1 — One build, at the end.**
Write ALL component CND files and ALL view files before running `yarn build && yarn jahia-deploy`. Skill instructions that say "deploy after this step" are wrong in this context — ignore them. A single deploy at the end covers everything. Only re-deploy if a runtime error forces it.

**Rule 2 — No intermediate validation in Page Builder.**
Skip Step 4 of `/jahia-dev-build-component` (the "click New content" validation step) for every component. There is no human to click through the UI. Move straight to the next component.

**Rule 3 — No accessibility audit.**
Skip `/jahia-dev-accessibility`. It is too slow for this run.

**Rule 4 — Minimal CND.**
Keep content types simple. No extra mixins, no optional properties beyond what the view needs. The CND author (`@jahia-cnd-author`) can be skipped — write the CND directly following the patterns you know.

## Pages to create

- Homepage: hero section + product grid + testimonials
- Car Insurance product page
- Health Insurance product page
- Home Insurance product page

## Components to build

- Hero section
- Sectioning component (1/2/3 columns): accepts text cards with CTA and text+image+CTA cards
- Testimonial component

Keep track of your work here:

---

<!--- This is your work log, keep track of your progress here. You can write anything you want here, it's for your own use. --->

---

When done:

- [ ] Publish all the pages
- [ ] Verify the pages are publicly viewable without logging in (use the `/cms/render/live/en/sites/<siteKey>/home.html` URL pattern, **not** the authenticated edit URL)
- [ ] Create a new `pages.json` file as an array of public URLs: `["http://localhost:8080/cms/render/live/en/sites/forsure/home.html", ...]`
