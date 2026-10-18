/**
 * Everything about the site that isn’t content lives here.
 * If you need to change a name, a link or a tagline, this is the only file to edit.
 */
export const SITE = {
  title: 'Ryan Nel',
  /** Used as the default meta description and in the RSS feed. */
  description: 'Things I’ve built to understand something better, and how each one was made.',
  /** Must match `site` in astro.config.mjs. */
  url: 'https://ryannel.dev',
  author: 'Ryan Nel',
  locale: 'en',
} as const;

/**
 * The home page opening. Two parts, deliberately: who is writing, then what the
 * site is about. `line` is also the home page's meta description, so it has
 * to stand on its own out of context.
 */
export const INTRO = {
  who: 'I’m Ryan, a software engineer in Gothenburg. I learn by building things, and write up how they went.',
  line: 'Maps, pictures, software and whatever I’m curious about next, each with notes on how it was made.',
} as const;

/** Shown in the footer and on the about page. Order is preserved. */
export const ELSEWHERE = [
  { label: 'GitHub', href: 'https://github.com/ryannel' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ryannel/' },
] as const;

export const NAV = [
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
] as const;

/** Shown once at the top of the projects index. */
export const PROJECTS_PREAMBLE =
  'Things I’ve built, mostly to understand something better. Each one comes with a write-up: how it works, how it was made, and what went wrong on the way.';

/**
 * How many projects the home page shows: one lead and up to two behind it.
 * A selection, not an archive — /projects/ is the archive.
 */
export const HOME_PROJECT_COUNT = 3;
