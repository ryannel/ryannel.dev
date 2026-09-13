---
name: "Skills"
description: "Agent skills for generative media, where the ecosystem moves faster than the models’ training data."
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

I wanted to generate images properly, and found that asking Claude or ChatGPT didn’t get me far —
not because they reason badly about it, but because this corner of the ecosystem moves faster than
the training data behind them. Models, ComfyUI nodes and licence terms all change on a scale of
weeks.

So I started writing what I needed down as agent skills instead, where I can keep it current. Some
of it comes out of my own workflow and the things I got wrong before they worked; some covers tools
I haven’t used myself and is research rather than experience.

Everything so far is generative media: one skill per model for the image and video generators
worth knowing, plus cross-model ones for character LoRA training, production pipelines, and running
ComfyUI on rented GPUs. An atlas sits at the front and routes a whole goal to the skills it needs,
settling most model choices on licence before quality.

Install with `npx skills add ryannel/skills`, or pass `--list` to read the set before installing
anything.
