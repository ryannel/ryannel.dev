---
name: "Groundwork"
description: "Repository-owned product plans that a person and an agent read and write from the same source."
status: "Active"
order: 1
links:
  - label: "GitHub"
    href: "https://github.com/ryannel/GroundWork"
related:
  - messy-real-world-context
  - coding-agents-context-across-a-large-system
---

Plans that live in the repository they describe, in a format an agent can read and write as well
as I can. A feature breaks into deliverables, deliverables into tasks, and every stage has to trace
back to the one before it — so "why is this being built" is answerable from the plan rather than
from memory.

It exists because I kept losing that thread. The work an agent does is only as good as the account
of what it is for, and that account was living in my head and in chat scrollback. A viewer renders
the plans, a dashboard collects several repositories at once, and the same operations are exposed
over a CLI and an MCP server — so the agent is working from exactly what I am looking at. It runs
entirely locally and never fetches or publishes anything.

Early, and honest about it: not on npm, installed from a tarball you build yourself, and used
against one real application so far. The repository is the thing to read.
