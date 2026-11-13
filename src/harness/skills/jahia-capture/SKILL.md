---
name: jahia-capture
description: Turns a task done more than once in the session into a skill or an instruction stored in the project, so the next session does it in one go. Use after proposing a capture and the user agreed, or when the user asks to "capture this", "make a skill out of this", "remember how to do this" or "add a rule for this". Picks skill or instruction, checks the installed skills for overlap, names it, writes it where the current agent loads it, and fills it with the exact commands, paths and fixes from the session.
allowed-tools: Bash, Read, Write, Edit, Grep
---

# Capturing repeated work

A capture is written in the user's project, next to the Jahia harness, for the agent running now.
It is only worth it when it is specific: the commands that worked, the paths of this project, the
error met and how it was fixed. A generic capture repeats what the agent already knows.

## Step 0 — Agreement

Write nothing before the user agrees. If they have not yet, propose first: the name, one line on
what it does, skill or instruction. Stop and wait.

## Step 1 — Skill or instruction?

| The repeated work is…                                 | Capture it as   | Example                                                                          |
| ----------------------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| A procedure: steps in order, run when a task comes up | **Skill**       | Reset the demo site: delete it, import the zip, publish, warm the cache          |
| A rule to follow all the time, or a fact to know      | **Instruction** | Images of this project live in `/sites/acme/files/brand`; never upload elsewhere |

When in doubt, choose a skill: an instruction is loaded every turn of every session and costs
context, a skill only when it is used.

## Step 2 — Check the overlap

List what is already installed (one of these folders exists, depending on the agent):

```bash
ls .claude/skills .agents/skills .windsurf/skills .kiro/skills 2>/dev/null
```

Read the `description` of every skill near the task.

- **A `jahia-*` skill covers it:** say so and capture nothing. Point to that skill instead.
- **A `jahia-*` skill covers part of it:** never edit that skill — reinstalling the harness
  (`npx @jahia/agentic@latest`) overwrites it. Capture only the missing part, and start the new
  skill with "Run `/jahia-…` first, then:".
- **A project skill covers it:** update that skill instead of creating a second one.

## Step 3 — Name

- Lowercase kebab-case, verb first: `reset-demo-site`, `import-brand-assets`.
- Prefix it with the project or module name when that makes it clearer: `acme-reset-demo-site`.
- **Never start with `jahia-`.** That prefix belongs to the harness: a later version could ship a
  skill with the same name and overwrite this one.
- A skill's folder name and its `name:` are the same.

## Step 4 — Where to write it

Write for the agent you are running in. When the project also holds the configuration folder of
another agent (`.github/`, `.cursor/`…), ask whether to write the capture for it too.

**Skills** (`<name>/SKILL.md`):

| Agent                                                 | Folder                             |
| ----------------------------------------------------- | ---------------------------------- |
| Claude Code                                           | `.claude/skills/<name>/SKILL.md`   |
| Windsurf                                              | `.windsurf/skills/<name>/SKILL.md` |
| Kiro                                                  | `.kiro/skills/<name>/SKILL.md`     |
| Copilot, Cursor, Codex, Gemini, OpenCode, Antigravity | `.agents/skills/<name>/SKILL.md`   |

**Instructions**:

| Agent           | File                                             | Front matter that keeps it always on |
| --------------- | ------------------------------------------------ | ------------------------------------ |
| Claude Code     | `.claude/rules/<name>.md`                        | none                                 |
| Copilot         | `.github/instructions/<name>.instructions.md`    | `applyTo: "**"`                      |
| Cursor          | `.cursor/rules/<name>.mdc`                       | `alwaysApply: true`                  |
| Windsurf        | `.windsurf/rules/<name>.md`                      | `trigger: always_on`                 |
| Kiro            | `.kiro/steering/<name>.md`                       | `inclusion: always`                  |
| Antigravity     | `.agents/rules/<name>.md`                        | none                                 |
| Codex, OpenCode | a `## <Title>` section at the end of `AGENTS.md` | —                                    |
| Gemini          | a `## <Title>` section at the end of `GEMINI.md` | —                                    |

`AGENTS.md` and `GEMINI.md` are shipped by the harness: tell the user that reinstalling it will
offer to overwrite them, and that the section must then be added back.

## Step 5 — Write it

Go back over the session and take what the occurrences had in common. What differed between them
(a site key, a component name, a page path) becomes a parameter the skill asks for or looks up.

**A skill:**

```markdown
---
name: <name>
description: <What it does, in one sentence.> Use when <the situations and the words the user says
  when they need it>. <What it gives: the steps, the script, the checks.>
---

# <Title>

<One paragraph: what it is for, and what to have before starting.>

## Step 1 — <Action>

<The exact command or file to write, copied from the session, with its parameters.>
```

- The `description` decides whether the skill is ever loaded: put in it the words the user used
  both times they asked for the task.
- Keep every command that worked, and the error each failed attempt gave with what fixed it.
  Leave out the dead ends that taught nothing.
- End with how to check that it worked: a URL to open, an output to expect.
- Stay under about 150 lines. Move a long script into a file next to `SKILL.md` and run it from
  there.

**An instruction:** one rule, said as an order, with its reason and, when it helps, an example.
A few lines; several unrelated rules go in several files.

## Step 6 — Report

Give the user the path of the file written, and one line on when the agent will use it. It is a
file of the project: it reaches teammates once the user commits it.
