---
"@jahia/agentic": patch
---

The harness now says how a link is created through the MCP tools: the picker's target lives on `jmix:internalLink` or `jmix:externalLink`, so `content.create` takes the mixin in `mixins` (or `content.update` adds it on an older server), and a skipped `j:linknode` in the answer names the mixin to add rather than a reason to model the link as strings. Two benchmark runs had taken that shortcut. `jahia-cnd-author`, `jahia-dev-debug` and the instructions carry the recipe.
