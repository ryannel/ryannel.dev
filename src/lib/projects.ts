import { getCollection, getEntries, type CollectionEntry, type ReferenceDataEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

/**
 * The one visibility rule on this site. Everything that selects or references
 * content goes through it: the projects index, the home page, the feed, the
 * sitemap (via the routes that exist) and the related lists on project pages.
 *
 * Two ways to be unpublished, one rule. `draft` is unfinished writing; `sample`
 * is placeholder content showing what the reading experience looks like. Both
 * stay in the repository and out of the build.
 *
 * `astro dev` shows everything, so a draft can be read and a sample still
 * demonstrates the design. `astro build` shows neither, and CI asserts it —
 * see scripts/verify-build.mjs.
 */
export type Hideable = { data: { draft: boolean; sample: boolean } };

export const isPublished = (entry: Hideable) =>
  import.meta.env.DEV || !(entry.data.draft || entry.data.sample);

/** Why an entry is hidden, for the dev-only badge. Null when it is published. */
export const hiddenReason = (entry: Hideable): 'Draft' | 'Sample' | null =>
  entry.data.draft ? 'Draft' : entry.data.sample ? 'Sample' : null;

/** Published projects, newest first. Hidden ones are visible in `astro dev` only. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', isPublished);
  return projects.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

/**
 * The home page selection: featured first, then the most recent, capped.
 *
 * Deterministic — a build is the same twice — and it degrades honestly. With
 * one published project the home page shows one; with none it shows the
 * section not at all. Nothing is padded to fill the slot.
 */
export async function getHomeProjects(limit: number): Promise<Project[]> {
  const projects = await getProjects();
  const featured = projects.filter((project) => project.data.featured);
  const rest = projects.filter((project) => !project.data.featured);
  return [...featured, ...rest].slice(0, limit);
}

/** Rough reading time in minutes, from the raw Markdown body. */
export function readingTime(body: string | undefined): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Dates in frontmatter are parsed as UTC midnight, so format them as UTC too —
 * otherwise a project published on the 13th renders as the 12th west of Greenwich.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolve `related:` references to the projects that this build actually publishes.
 *
 * Without the visibility filter a published page can advertise a hidden one's
 * title and link to a route that was never built. A reference that resolves to
 * nothing is a different problem — a typo in frontmatter — so it still throws.
 * An existing-but-hidden reference is not an error: it is the normal state of a
 * project whose companion piece is still a draft.
 */
export async function resolveProjects(refs: ReferenceDataEntry<'projects'>[]): Promise<Project[]> {
  if (refs.length === 0) return [];
  const entries = await getEntries(refs);
  entries.forEach((entry, i) => {
    if (!entry) {
      throw new Error(
        `related: "${refs[i].id}" does not match any project in src/content/projects/. ` +
          `References are filenames without the extension.`,
      );
    }
  });
  return entries.filter(isPublished);
}

export const projectHref = (id: string) => `/projects/${id}/`;
