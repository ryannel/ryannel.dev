/**
 * Everything about the site that isn’t content lives here.
 * If you need to change a name, a link or a tagline, this is the only file to edit.
 */
export const SITE = {
  title: 'Ryan Nel',
  /** Used as the default meta description and in the RSS feed. */
  description: 'Notes on building software, experimenting with AI, and what I learn along the way.',
  /** Must match `site` in astro.config.mjs. */
  url: 'https://ryannel.dev',
  author: 'Ryan Nel',
  locale: 'en',
} as const;

/**
 * The home page opening. Two parts, deliberately: who is writing, then what the
 * writing is about. `line` is also the home page's meta description, so it has
 * to stand on its own out of context.
 */
export const INTRO = {
  who: 'I’m Ryan, a Senior Staff Software Engineer in Gothenburg. I build large software systems, and explore what changes when AI becomes part of them.',
  line: 'Notes on architecture, context, and what breaks in practice.',
} as const;

/** Shown in the footer and on the about page. Order is preserved. */
export const ELSEWHERE = [
  { label: 'GitHub', href: 'https://github.com/ryannel' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ryannel/' },
] as const;

export const NAV = [
  { label: 'Writing', href: '/writing/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
] as const;

/**
 * Shown once at the top of the writing index. Deliberately not repeated on every note —
 * the dates do that work, and a disclaimer on every piece reads as an apology.
 */
export const NOTES_PREAMBLE =
  "Things I’m learning while building and experimenting. They’re dated snapshots — if my thinking changes, I’ll usually write another one.";

/**
 * How many pieces the home page shows: one lead and up to two behind it.
 * A selection, not an archive — /writing/ is the archive.
 */
export const HOME_NOTE_COUNT = 3;
