---
name: "Skills"
description: "Agent skills for Claude Code and other agents, currently covering generative media."
status: "Active"
order: 2
links:
  - label: "GitHub"
    href: "https://github.com/ryannel/skills"
  - label: "skills.sh"
    href: "https://skills.sh/ryannel/skills"
related:
  - line-between-skills-tools-and-agents
  - training-character-loras
---

Agent skills for Claude Code and other agents, grouped by domain.

Everything so far is generative media: one skill per model for the image and video generators
worth knowing, plus cross-model ones for the craft that spans them — character LoRA training,
multi-stage production pipelines, and running ComfyUI on rented GPUs. An atlas skill sits at the
front to route a goal to the right model and the right skills.

Most of the work is research rather than distillation. These ecosystems change weekly, so the
skills track their sources and get re-checked rather than written once and left alone.

Install with `npx skills add ryannel/skills`, or pass `--list` to browse first.
