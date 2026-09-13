/**
 * Everything about the site that isn’t content lives here.
 * If you need to change a name, a link or a tagline, this is the only file to edit.
 */
export const SITE = {
  title: 'Ryan Nel',
  /** Used as the default meta description and in the RSS feed. */
  description:
    'Notes on AI engineering, agents and software architecture, from things I build and learn.',
  /** Must match `site` in astro.config.mjs. */
  url: 'https://ryannel.dev',
  author: 'Ryan Nel',
  locale: 'en',
} as const;

export const INTRO = {
  role: 'Senior Staff Software Engineer',
  line: 'Senior Staff Software Engineer exploring how to build AI systems that can reason effectively over complex, real-world context.',
  sub: 'I write about AI engineering, agents, software architecture, and things I learn while building them.',
} as const;

/** Shown in the footer and on the about page. Order is preserved. */
export const ELSEWHERE = [
  { label: 'GitHub', href: 'https://github.com/ryannel' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ryannel/' },
] as const;

export const NAV = [
  { label: 'Notes', href: '/notes/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
] as const;

/** Shown once at the top of the notes index. Deliberately not repeated on every note. */
export const NOTES_PREAMBLE =
  "These are notes from things I’m building and learning. My thinking will probably change.";

/** How many notes the home page shows. */
export const HOME_NOTE_COUNT = 5;
