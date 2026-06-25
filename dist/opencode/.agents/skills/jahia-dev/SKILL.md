---
name: jahia-dev
description: Entry point for Jahia JavaScript module development. Detects your project state and tells you what to do next. Start here if you are new to the project or unsure what skill to use.
---

# Jahia Dev — Project GPS

You are the entry point for Jahia JavaScript module development. Your job is to assess the current project state and guide the user to the right next skill.

## Step 1 — Detect project state

Run all checks in parallel.

### 1. Module exists?

Search for a `package.json` that references `@jahia/javascript-modules-library` in the current directory or subdirectories:

```bash
find . -name "package.json" -not -path "*/node_modules/*" | xargs grep -l "@jahia/javascript-modules-library" 2>/dev/null | head -5
```

- Found → record the module name (from the `name` field in that `package.json`)
- Not found → module does not exist yet

### 2. Jahia running?

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/cms/login
```

- `200` → Jahia is running at `http://localhost:8080`
- Anything else → Jahia is not running

### 3. Content types defined?

```bash
find src/components -name "definition.cnd" 2>/dev/null | wc -l
```

Record the count of `.cnd` files found under `src/components`.

### 4. Views defined?

```bash
find src/components -name "*.server.tsx" -o -name "*.client.tsx" 2>/dev/null | wc -l
```

Record the count of view files found.

### 5. Page templates defined?

```bash
find src/templates/Page -type f 2>/dev/null | wc -l
```

Record the count of files in `src/templates/Page/`. More than 1 means custom templates exist (the default `index.server.tsx` is always present).

---

## Step 2 — Report project state to user

Print a clear, scannable status summary:

```
📦 Module:          ✅ <module-name> (found)   OR   ❌ not found
🐳 Jahia:           ✅ running at http://localhost:8080   OR   ❌ not running
📋 Content types:   <N> defined
🖼  Views:          <N> defined
📄 Page templates:  <N> defined
```

---

## Step 3 — Recommend next action

Use the matrix below to pick exactly one recommendation to highlight:

| Condition | Recommendation |
|-----------|---------------|
| No module found | 🚀 **Start here:** invoke `/jahia-dev-create-template-set` to scaffold a new Jahia JavaScript module. |
| Module found, Jahia not running | 🐳 Your module is ready. Invoke `/jahia-dev-start-local` to start Jahia locally (Docker recommended). |
| Module + Jahia running, 0 content types | 🎯 Jahia is running! Time to build your first component. Invoke `/jahia-dev-build-component` to create a content type + view. |
| Module + Jahia running, content types exist, ≤1 page template | 📐 You have components. Invoke `/jahia-dev-create-page-template` to create a page template and start assembling pages. |
| Module + Jahia running, templates exist (>1) | 🏗 Your module is taking shape! Choose what to do next (see options below). |

When the last condition applies, present all options:

```
🏗 Your module is taking shape! What would you like to do next?
  - Add a new component         → /jahia-dev-build-component
  - Create a content listing    → /jahia-dev-query-content
  - Review your code for issues → /jahia-dev-review
  - Screenshot a reference site → /jahia-dev-screenshot
  - Create a new page template  → /jahia-dev-create-page-template
  - Clean up boilerplate        → run /jahia-dev-review and look for S10
```

---

## Step 4 — Print the full skill map

Always print this at the end so the user can navigate anywhere:

```
## Jahia Development Skills

### Setup
/jahia-dev-create-template-set   Scaffold a new JS/React module
/jahia-dev-start-local           Start Jahia locally (Docker or bare metal)

### Building
/jahia-dev-build-component       Build a complete component (content type + view) ← start here
/jahia-dev-define-content-type   Define a CND content type and types.ts
/jahia-dev-create-view           Implement a React view (.server.tsx or .client.tsx Island)
/jahia-dev-create-page-template  Create a page template with Areas

### Content
/jahia-dev-query-content         Query JCR content with JCR-SQL2 or useJCRQuery

### Quality
/jahia-dev-review                Review code for Jahia and generic best practices
/jahia-dev-screenshot            Screenshot reference URL + Jahia render for visual comparison
/jahia-dev-debug                 Debug build/deploy/runtime errors end-to-end
```
