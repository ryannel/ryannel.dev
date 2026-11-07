---
name: review
description: Independently review a ryannel.dev write-up or note before it's published or after a substantial revision. Use for "review this", "is this ready?", a read-through, or step 1 of publishing.
---

# Find out what the page actually says, and what it costs

An author can't see their own gaps, because they know what they meant. Review gives Ryan
independent readings of the finished page, so he can see what a reader actually gets. Findings
run both ways: something the reader needed and didn't get, and time the page took without giving
anything back.

## Choose readers who can surprise the author

Use subagents, scaled to the change: a new piece gets all three, a revised section may need
only a fresh reader.

- **A fresh reader.** Start it with none of this conversation and give it only the finished
  page and the audience: a curious reader who found the site. Use the built page (`npm run build`,
  then the HTML in `dist/projects/<slug>/` or `dist/notes/<slug>/`) and the figure images, not
  the `.mdx`, whose imports and comments give things away. Don't tell it what the piece is meant
  to teach, and don't give it the `writing` skill. Give it the instructions below.
- **A fact check.** Follow the claims, numbers, links and any "make your own" steps back to the
  source: the project's repo, the tool's docs, the live page. Say what was actually run and what
  was only read. Check that illustrative figures and examples are labelled as such. Claims about
  what Ryan did, saw or measured can't be checked anywhere else: list them for him to confirm.
- **An editor.** Reads the whole page in order against the reference articles in the `writing`
  skill and any of Ryan's own words about the subject, and says which passages work and which
  strain, read with their neighbours. Every sentence can be clear while the piece as a whole is
  laboured. Start with the opening and the ending, set beside how the references open and close:
  that is where a piece most often reads as an imitation. Name passages that read as later
  patches, such as an objection raised only to be answered or an aside that interrupts. For each
  section, say what a reader would lose if it were cut.

If the piece has interactive figures, someone also uses them rendered: every control, light and
dark themes, and phone width.

## What the fresh reader does

> Read this page as someone who found it and is curious, top to bottom, recording observations
> at the moment they happen rather than afterwards.
>
> Before each section, write what its heading leads you to expect; afterwards, compare. At the
> end of the opening, write what you now know the piece is about and why it exists, and which
> passage told you. Look at each figure before reading its caption and say what it shows you.
>
> Stop at the first thing the page hasn't supported and name the passage and the question ("How
> did we get from one tile to eighty?"). Note effort even when you understand: what you had to
> hold in your head, and where. Note time that bought you nothing: a passage that re-explains,
> runs long, or describes in prose what a picture would show. Note passages that read as if a
> machine wrote them. Note passages that work, so a revision keeps them.
>
> Keep observations separate from suggested fixes. Say which steps you filled in from your own
> knowledge.

## Turn findings into repairs

Keep each reading intact in a file Ryan can open, and keep disagreements visible rather than
settling them. What you bring him is short. Put the claims only he can confirm first. Then, for
each finding that matters, the passage, what the reader lost, and the smallest repair: a
sentence, a moved paragraph, a caption, a cut. Group them by what they cost the reader:

- **Wrong or unsupported:** the reader comes away believing something false, or a claim has
  nothing behind it.
- **Stalls the reader:** they have to stop, reread or supply something the page didn't give.
- **Polish:** optional, and it doesn't hold anything up.

Repeated difficulty is a reason to rethink the passage, not to keep polishing the same wording.

Don't change Ryan's phrasing without asking. After substantive repairs, have the editor reread
the whole page: fixes from several reviewers add repetition and hedging that no single fix shows.
Recheck with a new fresh reader only when an explanation or the argument has been substantially
rewritten, since one that has seen the old version knows too much. Local repairs don't need
another full round.

Model reviewers share the writer's blind spots and tend to praise fluent prose. Passing review is
evidence of work done. It doesn't make the piece good, and it doesn't authorise publishing.
