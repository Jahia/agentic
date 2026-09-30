---
"@jahia/agentic": patch
---

The harness now carries three lessons from the benchmark run of 2026-09-30, which spent 22 minutes rediscovering them. A sectioning component whose items editors drop inside it is modelled with a hidden list child type and rendered with `AbsoluteArea`, not with `+ *` on the component and `RenderChildren`, and `jahia-cnd-author`, `jahia-dev-build-component` and `jahia-dev-debug` say so, with the refusal that names the wrong model. A namespace is declared once, in `settings/definitions.cnd`, because the engine merges every CND file into one and a second declaration breaks the module. And content is created as subtrees, with the `children` of `content.create`, not one call per node.
