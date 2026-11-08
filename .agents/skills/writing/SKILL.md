---
name: writing
description: The writing voice for ryannel.dev. Use before drafting, revising or polishing any prose for the site, including project write-ups, notes, descriptions, headings and captions in src/content.
---

# Writing on ryannel.dev

Write for a curious friend. They are smart and interested, but they don't know this subject. They
chose to read, so the job is to make each step easy to follow and get them to the end knowing
something they didn't before. Every choice below serves that reader.

## Read the references first

Read these four Randall Munroe pieces in full before you write:

- [Relativistic Baseball](https://what-if.xkcd.com/1/)
- [A Mole of Moles](https://what-if.xkcd.com/4/)
- [Glass Half Empty](https://what-if.xkcd.com/6/)
- [Sunless Earth](https://what-if.xkcd.com/49/)

Read the articles themselves, not a summary. A fetch tool that answers a question about a page
returns another model's paraphrase. This prints the article text:

```bash
curl -s https://what-if.xkcd.com/1/ | sed -n '/<article/,/<\/article>/p' | sed 's/<[^>]*>//g'
```

The aim is a piece that could sit beside them and read as if the same person wrote it.

## What to take from them

Copy how he explains, not what he writes about.

- He follows one question step by step. Each paragraph answers the question the last one raised.
- He uses everyday words. A technical term appears only when it's needed, and he explains it on
  the spot.
- His sentences are short, but they connect. The reader never has to jump a gap.
- He says what he is assuming, and where an estimate gets shaky.
- His jokes do work. They ease the reader through a hard step or mark a turn in the argument.

Leave his subjects, catchphrases, absurd premises and xkcd in-jokes behind. Leave the drawings
too: many of his jokes live in the pictures. Here the prose has to make sense on its own. Figures
illustrate it, so never refer to "the figure" or "the boxes" to carry a point. Name the things
in the sentence.

## Ryan's register

This is Ryan's personal notebook. It is informal, honest and in his voice, not an article or a
paper. Where it differs from Munroe:

- It is warm and generous to everyone in it: the reader, the people written about, and the
  people who disagree. Concede points kindly. Don't argue with the reader, ask gotcha questions
  or deliver one-line verdicts.
- A piece can end on one quiet line, the way Munroe's do. It should not be a slogan or a moral.
- Link to other people's writing on a phrase, like a citation. Quote directly only where a line
  carries real weight, and only a couple of times per piece.

## Say what you mean

Mannered prose uses metaphor and flourish in place of a plain statement. It writes "a dial worth
turning" for "a setting worth changing". These phrases show off the writer and make the reader
work harder. They are also less precise, because a metaphor brings meanings the writer didn't
choose. When a literal phrase exists, use it.

The same goes for these habits, which put the writer's performance ahead of the idea:

- "It's not X, it's Y" reversals.
- Lists of three for the sound of it.
- One-word or fragment sentences for drama, like "Simple."
- A colon or dash held back for a reveal.
- Headings and openers that announce what's coming instead of saying it.

Make each piece as long as the idea needs and no longer. If the reader wouldn't miss a paragraph,
cut it.

## Facts

Ryan's own words are the other reference. When he has described the subject in conversation,
that is his register; keep his claims and his way of putting them.

The facts are his too. Numbers, scale, examples and anything that happened come from Ryan: ask
before drafting, and where you don't know, write TK rather than a plausible guess. A figure that
illustrates an idea is labelled as a sketch, not presented as a measurement.

## Revising

When revising after review, treat each finding as a problem the reader had, not wording to
insert. Make the smallest repair that reads as part of the piece: reword, reorder, cut or move.
A run of fixes tends to leave patch-like asides, repeated points and new tag lines behind, so
reread the whole page before handing it back.
