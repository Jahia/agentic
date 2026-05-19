/jahia

You are building a complete Jahia JavaScript module website for a fictional biscuit company.

---

## Context

- Module directory: `crumbleco/` (already scaffolded as a Hello World template set)
- Jahia is running at http://localhost:8080, credentials: root / root1234
- The site `crumbleco` has already been created in Jahia and uses this module
- Your job: build all components, create page templates, deploy, then populate with content

---

## Brand

**Company:** CrumbleCo Biscuits
**Tagline:** "Handcrafted biscuits, baked with love since 1987"
**Tone:** Warm, artisanal, traditional. No online shop — products sold through retailers only.
**Palette:** Cream background, dark brown headings, warm amber accents.

---

## Site structure

### Pages to create

| Page | Template | Content |
|------|----------|---------|
| Homepage (`/home`) | default | Hero + "Our Biscuits" product section (3 cards) + "Our Story" text section + blog teaser |
| Products (`/home/products`) | default | Hero + all 3 product cards |
| Butter Shortbread (`/home/products/butter-shortbread`) | default | Hero + product detail text |
| Dark Chocolate Chip (`/home/products/dark-chocolate-chip`) | default | Hero + product detail text |
| Lemon & Lavender (`/home/products/lemon-and-lavender`) | default | Hero + product detail text |
| Contact (`/home/contact`) | default | Hero + contact section |
| Blog (`/home/blog`) | default | Hero + blog listing (queries posts) |

### Blog posts (stored in `/sites/crumbleco/contents/blog/`)

1. **Easter Giveaway 2025** — "Win a CrumbleCo Hamper! This Easter we're giving away 10 hampers packed with our full range of handcrafted biscuits..."
2. **Introducing Lemon & Lavender** — "Our newest biscuit is here. Light, floral, and utterly irresistible — the Lemon & Lavender brings a touch of Provence to your tea time..."
3. **Behind the Scenes: Our Shortbread** — "Every batch of our Butter Shortbread starts with the same three ingredients our founder used in 1987: Scottish butter, plain flour, and caster sugar..."

---

## Content types to build

All types live in namespace `bc`. Create all definitions in `src/components/`.

### 1. `bc:hero`
```
src/components/Layout/Hero/definition.cnd
```
Fields: `title` (string, i18n, mandatory, primary), `subtitle` (string, textarea, i18n), `background` (weakreference, picker[type='image'], mandatory, < jmix:image)

View: full-width section, background image covers entire hero, dark overlay, centered white title/subtitle. Min-height 480px.

### 2. `bc:richText`
```
src/components/Layout/RichText/definition.cnd
```
Fields: `sectionTitle` (string, i18n), `body` (string, richtext, i18n, mandatory)

View: centered content block, max-width 800px. Title in dark brown, body text.

### 3. `bc:productCard`
```
src/components/Products/ProductCard/definition.cnd
```
Fields: `title` (string, i18n, mandatory, primary), `tagline` (string, i18n), `description` (string, textarea, i18n), `image` (weakreference, picker[type='image'], < jmix:image)

View: card layout — image top half, content bottom half. Title in bold, tagline in amber, description text.

### 4. `bc:blogPost`
```
src/components/Blog/BlogPost/definition.cnd
```
Extends: `mix:title`, `jmix:mainResource`
Fields: `excerpt` (string, textarea, i18n), `body` (string, richtext, i18n, mandatory), `cover` (weakreference, picker[type='image'], < jmix:image), `publishDate` (date)

Views:
- `default` — full article page: cover image, title, date, body text
- `small` — listing card: cover image, title, excerpt, date

### 5. `bc:blogListing`
```
src/components/Blog/BlogListing/definition.cnd
```
Fields: `sectionTitle` (string, i18n)

View: uses `useJCRQuery` to fetch all `bc:blogPost` nodes under `/sites/crumbleco/contents/blog/` ordered by `publishDate DESC`. Renders each post using `<Render node={post} view="small" />`. Grid of 3 columns.

---

## Page template

Create ONE page template: `default`

```
src/templates/Page/default.server.tsx
```

The template has a single `<Area name="pageContent" />` that accepts any `bcmix:component`. No header/footer needed — keep it minimal.

The base mixin `bcmix:component` should be defined in `settings/definitions.cnd`:
```cnd
[bcmix:component] > jmix:droppableContent, jmix:accessControllableContent mixin
```

---

## Images

Download these images to `/tmp/crumbleco-imgs/` before uploading to Jahia:

```bash
mkdir -p /tmp/crumbleco-imgs
curl -sL "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1400&q=80" -o /tmp/crumbleco-imgs/hero-main.jpg
curl -sL "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80"  -o /tmp/crumbleco-imgs/shortbread.jpg
curl -sL "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&q=80" -o /tmp/crumbleco-imgs/chocolate.jpg
curl -sL "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80" -o /tmp/crumbleco-imgs/lemon.jpg
curl -sL "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800&q=80" -o /tmp/crumbleco-imgs/baking.jpg
curl -sL "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=800&q=80" -o /tmp/crumbleco-imgs/easter.jpg
curl -sL "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80"    -o /tmp/crumbleco-imgs/blog-hero.jpg
```

Upload all to `/sites/crumbleco/files/images/` with `jmix:image` mixin. Upload in parallel. Record the UUID of each uploaded file.

---

## Fake content details

### Hero texts

| Page | Title | Subtitle |
|------|-------|---------|
| Homepage | Handcrafted Biscuits, Baked with Love | Indulge in our artisanal range — made with the finest ingredients since 1987 |
| Products | Our Biscuit Range | Three recipes, each perfected over decades of baking tradition |
| Butter Shortbread | Butter Shortbread | The classic. Three ingredients, perfected since 1987 |
| Dark Chocolate Chip | Dark Chocolate Chip | Rich Belgian dark chocolate in every bite |
| Lemon & Lavender | Lemon & Lavender | Light, floral, and utterly irresistible |
| Contact | Get in Touch | We love hearing from fellow biscuit enthusiasts |
| Blog | From Our Kitchen | Stories, recipes, and news from the CrumbleCo team |

### Product detail text (for `bc:richText` on each product page)

**Butter Shortbread**
Title: "About Our Shortbread"
Body: `<p>Our Butter Shortbread is a celebration of simplicity. Just three ingredients — Scottish butter, plain flour, and caster sugar — mixed slowly and baked at low heat until golden. The result is a biscuit that crumbles the moment it touches your lips.</p><h3>Ingredients</h3><p>Scottish butter, plain flour, caster sugar. May contain traces of nuts and milk.</p><h3>Where to Buy</h3><p>Available at Waitrose, Marks & Spencer, and selected independent delicatessens across the UK.</p>`

**Dark Chocolate Chip**
Title: "About Our Chocolate Chip"
Body: `<p>For the chocolate lover who refuses to compromise. We use 70% Belgian dark chocolate chips throughout the biscuit, not just scattered on top. Each biscuit is hand-portioned and baked until just set — fudgy in the centre, crisp at the edge.</p><h3>Ingredients</h3><p>Plain flour, Belgian dark chocolate chips (70%), unsalted butter, soft brown sugar, free-range egg. May contain nuts and milk.</p><h3>Where to Buy</h3><p>Available at Waitrose, Marks & Spencer, and selected independent delicatessens across the UK.</p>`

**Lemon & Lavender**
Title: "About Lemon & Lavender"
Body: `<p>Inspired by the lavender fields of Provence and the lemon groves of the Amalfi coast, this is our most delicate biscuit. A lemon zest shortbread base is perfumed with culinary lavender and finished with a lemon icing glaze. Available seasonally.</p><h3>Ingredients</h3><p>Plain flour, unsalted butter, caster sugar, free-range egg, lemon zest, dried culinary lavender, icing sugar. May contain traces of nuts and milk.</p><h3>Where to Buy</h3><p>Available at Waitrose, Marks & Spencer, and selected independent delicatessens across the UK.</p>`

### Contact section

Title: "Come and Say Hello"
Body:
```html
<h3>By Post</h3>
<p>CrumbleCo Biscuits Ltd<br>14 Baker Street<br>Edinburgh<br>EH1 2AB<br>Scotland, UK</p>
<h3>By Email</h3>
<p><a href="mailto:hello@crumbleco.example">hello@crumbleco.example</a></p>
<p>We aim to respond within 2 working days. We do not operate an online shop — our biscuits are available exclusively through our retail partners.</p>
```

### Blog post bodies (rich HTML)

**Easter Giveaway 2025:**
```html
<p>Spring is here, and to celebrate we're running our biggest giveaway yet. Enter before 15 April 2025 for a chance to win one of 10 CrumbleCo hampers, each packed with our full range of handcrafted biscuits.</p>
<h2>How to Enter</h2>
<ol><li>Follow us on Instagram @crumbleco</li><li>Like this post</li><li>Tag a friend who deserves a treat</li></ol>
<p>Winners will be announced on Easter Monday, 21 April 2025. Good luck!</p>
```

**Introducing Lemon & Lavender:**
```html
<p>After two years of recipe testing, we are thrilled to introduce our newest biscuit to the CrumbleCo family: Lemon & Lavender.</p>
<p>The idea came from a holiday our founder took to Provence in 2022. Surrounded by lavender fields, she couldn't stop thinking about how the floral, herbal scent could complement the brightness of fresh lemon. The result is a biscuit unlike anything else in our range.</p>
<h2>Available Now</h2>
<p>Lemon & Lavender joins our range at Waitrose and Marks & Spencer stores nationwide from this week.</p>
```

**Behind the Scenes — Shortbread:**
```html
<p>We get asked all the time: "What's your secret?" The honest answer is that there is no secret. Our Butter Shortbread uses just three ingredients, and the magic comes from using the very best of each one.</p>
<h2>The Butter</h2>
<p>We source unsalted butter from a single farm in Perthshire. It has a higher fat content than standard supermarket butter, which is what gives the shortbread its characteristic melt-in-the-mouth texture.</p>
<h2>The Method</h2>
<p>We mix low and slow — the dough should never get warm. Once shaped, each biscuit rests in the fridge for 30 minutes before going into a moderate oven. No shortcuts.</p>
```

---

## Build and deploy order

1. Write all CND definitions and `types.ts` files
2. Write all views (`.server.tsx`) and CSS modules
3. Write the page template
4. From `crumbleco/` directory: `yarn build && yarn jahia-deploy`
5. Verify all content types appear in Jahia
6. Download and upload images to Jahia in parallel
7. Create blog posts in `/sites/crumbleco/contents/blog/`
8. Create all pages under `/sites/crumbleco/home/` with the correct content inside `pageContent` areas
9. Publish everything: `mutateNodesByQuery` on all nodes under `/sites/crumbleco/home/` and `/sites/crumbleco/contents/blog/`

---

## Output — required at the end

Print each page URL on its own line, exactly in this format (replace with actual live URLs):

```
PAGE_URL: homepage http://localhost:8080/cms/render/live/en/sites/crumbleco/home.html
PAGE_URL: products http://localhost:8080/cms/render/live/en/sites/crumbleco/home/products.html
PAGE_URL: product-shortbread http://localhost:8080/cms/render/live/en/sites/crumbleco/home/products/butter-shortbread.html
PAGE_URL: product-chocolate http://localhost:8080/cms/render/live/en/sites/crumbleco/home/products/dark-chocolate-chip.html
PAGE_URL: product-lemon http://localhost:8080/cms/render/live/en/sites/crumbleco/home/products/lemon-and-lavender.html
PAGE_URL: contact http://localhost:8080/cms/render/live/en/sites/crumbleco/home/contact.html
PAGE_URL: blog http://localhost:8080/cms/render/live/en/sites/crumbleco/home/blog.html
PAGE_URL: blog-easter http://localhost:8080/cms/render/live/en/sites/crumbleco/contents/blog/easter-giveaway-2025.html
PAGE_URL: blog-lemon http://localhost:8080/cms/render/live/en/sites/crumbleco/contents/blog/introducing-lemon-lavender.html
PAGE_URL: blog-shortbread http://localhost:8080/cms/render/live/en/sites/crumbleco/contents/blog/behind-the-scenes-shortbread.html
```
