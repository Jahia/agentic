/jahia

You are building a Jahia website from scratch for a fictionnal B2C insurance company named "For Sure".

> **Time budget: 45 minutes.** Prioritise completing all 4 pages over perfection. Build all components first, deploy once, then populate content.

> **Important: Use MCP tools for all content operations.** The `my-jahia` MCP server is pre-configured with tools for site discovery, page creation, content authoring, and media upload. Never call the Jahia GraphQL API directly for content operations — use only MCP tools so we can validate the MCP tool surface coverage. If a tool is missing or doesn't work as expected, note it in your work log below.

Create the following pages:

- The homepage, with a hero section, a section showcasing the different insurance products, and a section with customer testimonials.
- A product page for each insurance product:
  - Car Insurance
  - Health Insurance
  - Home Insurance

That's 4 pages in total.

To build these pages, create the following components:

- a hero section
- a generic sectioning component to create 1/2/3 centered columns in pages (and other fancy grid rythms if you want)
- a testimonial component

The sectioning element accepts:

- simple text card with cta
- text + cta + image component

Additional components can be created to make pages look better, but the above are the minimum required.

Keep track of your work here:

---

<!--- This is your work log, keep track of your progress here. You can write anything you want here, it's for your own use. --->

---

When done:

- [ ] Publish all the pages
- [ ] Verify the pages are publicly viewable without logging in (use the `/cms/render/live/en/sites/<siteKey>/home.html` URL pattern, **not** the authenticated edit URL)
- [ ] Run `/jahia-dev-accessibility` once across all pages to fix any critical or serious violations
- [ ] Create a new `pages.json` file as an array of public URLs: `["http://localhost:8080/cms/render/live/en/sites/forsure/home.html", ...]`
