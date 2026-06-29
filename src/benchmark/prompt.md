Build a Jahia website for "For Sure", a fictional B2C insurance company.

Pages:
- Homepage: hero section, product grid, testimonials
- Car Insurance product page
- Health Insurance product page
- Home Insurance product page

All pages share a common layout: generated navbar (from the page tree), content (contributable), footer (contributable).

Page-level components (only contributable on the page itself):
- Hero section
- Sectioning component with title and subtitle
- Full-width testimonial component with image, name and quote

Available sectioning layouts:
- 1 column
- 2 columns
- 3 columns
- 2 columns but the grid pattern is irregular (vertical split alternate):
  AA BB
  AA CC
  DD EE
  FF EE
- 3 columns but the grid pattern is irregular (33-67 alternate split):
  AA AA BB
  CC DD DD

Sectioning component children (only contributable on the sectioning component):
- Text card
- Image with bottom caption

All components (hero section, section, testimonial, text card, image with caption) can have 0 or 1 CTA.

Populate the pages with realistic content, including images, text, and links. All pages must have a hero section, at least 3 sections and 1 testimonial. Sectioning layouts must be varied across the pages.

Publish the 4 pages then create `pages.json` as an array of public page URLs.
