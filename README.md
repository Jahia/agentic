# `@jahia/agentic`

**TL;DR**: run `npx @jahia/agentic@latest` to get a functional agentic harness for Jahia development.

## What's an agentic harness?

While AI agents can be good at tasks well represented in their training data, they can fall short on rarer libraries and tools. An agentic harness helps provide the documentation an agent needs to complete a task successfully. The harness we provide is composed of the following components:

- **Skills**: most well-known harness part, a skill is a function that can be called by the agent. [Read the specification.](https://agentskills.io/home)
- **Prompts**: no need to write prompts yourself for common development tasks; we provide a set of prompts to get you started.
- **Instructions**: long-lived behavior rules (style guides, conventions)
- **Agents**: personas with explicit scope, tools, and triggers
- **Hooks**: event handlers fired by the runtime (pre-commit, on-tool-use)
- **Commands**: slash-command shortcuts the developer types into the agent
- **MCP servers**: tool-server declarations for the agent to use

Source: [Microsoft APM Author Primitives](https://microsoft.github.io/apm/producer/author-primitives/#primitive-types)

## Usage

Running `npx @jahia/agentic@latest` will create all the harness files in the current directory. Commit these files with git and restart your agentic runtime to load the new harness.

We support the following runtimes:

- Claude
- Codex
- Copilot
- Cursor
- Gemini
- OpenCode
- Windsurf
- ...and all agents following the `.agents`/`AGENTS.md` convention (select OpenCode during installation)

Re-running `npx @jahia/agentic@latest` will update the harness files to their latest version. As we are progressing rapidly, we recommend running this command weekly to get the latest features and bug fixes.

We use [Microsoft APM](https://microsoft.github.io/apm/) to compile a raw harness into agent-specific files. All new agents supported by APM will be added to `@jahia/agentic` as installation targets as soon as possible.

## Benchmarking

Creating a high quality harness is a challenge we tackle iteratively. We have created a benchmark to assess the quality and capabilities of the harness we offer. The benchmark can be consulted on [jahia.github.io/agentic](https://jahia.github.io/agentic/).

On harness changes, we task an agent to complete a long Jahia task end-to-end, and we measure the quality of the result on the following axes:

- Visual result
- Accessibility score
- SEO score

There's room for improvement on these axes, but once perfected we will introduce a more complex prompt and assess the quality of the code and the edition experience produced.
