---
name: jahia-review
description: Full quality review of a Jahia JavaScript module — runs code review and live site review in parallel via subagents. Use after deploying to get a complete pass/fail signal before finalizing work.
allowed-tools: Agent, Bash, Read
---

# Skill: jahia-review

Runs both `/jahia-review-code` and `/jahia-review-site` in parallel via independent subagents, then consolidates their findings. Use this before marking work complete.

---

## Step 1 — Collect live URLs

Read `pages-to-review.json` to get the list of live page URLs:

```bash
cat pages-to-review.json
```

---

## Step 2 — Spawn review subagents in parallel

Invoke two subagents simultaneously:

**Subagent A — code review:**
> Invoke `/jahia-review-code` on this module. Scan all CND files, TypeScript views, and page templates. Report every issue found (critical, warning, suggestion) with file locations and fix guidance. Report only: do not fix anything, and do not ask whether to fix.

**Subagent B — site review:**
> Invoke `/jahia-review-site` against the URLs in `pages-to-review.json`. Run the review script and report every failure it prints: a11y, SEO and content loss.

---

## Step 3 — Consolidate and report

Combine findings from both subagents into a single report:

```
## Review Results

### Code (jahia-review-code)
[findings from subagent A]

### Site (jahia-review-site)
[findings from subagent B]

### Verdict
✅ PASS — the site review passed and the code review found no 🔴 Critical issue.
❌ FAIL — N blocking issue(s): the site violations and the 🔴 Critical code issues.
```

Only site violations and 🔴 Critical code issues block. 🟡 Warnings and 🔵 Suggestions do not: list them once in the final report, and do not fix them in a review round.

---

## Step 4 — Fix and iterate

If the verdict is ❌ FAIL:

1. Fix the blocking issues, and only those.
2. Redeploy: `yarn build && yarn jahia-deploy`, and publish the content you changed.
3. Run the review again. The code review runs at most twice in total. After its second run, the verdict depends on the site review alone: re-run only `/jahia-review-site`, and list the 🔴 Critical code issues that remain in the final report.

A review round never restructures what holds existing content, whatever the severity of the issue. Do not rename or split an area, change the area types of a template, change the child node types of a content type, or move content between areas: list such an issue in the final report instead. A fix that renders content where it already lives is not a restructuring: the C8 fix, `<AbsoluteArea parent={currentNode}>` instead of `<Area>` in a view, makes hidden children appear without moving them. `/jahia-review-site` fails when a page lost content since its last pass.

Only mark work complete once the review passes. The `/jahia-review-site` script writes `pages.json` on pass: never write it by hand.
