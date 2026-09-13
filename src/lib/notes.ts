import { getCollection, getEntries, type CollectionEntry, type ReferenceDataEntry } from 'astro:content';

export type Note = CollectionEntry<'writing'>;
export type Project = CollectionEntry<'projects'>;

const isPublished = (entry: { data: { draft: boolean } }) =>
  import.meta.env.DEV || !entry.data.draft;

/** Published notes, newest first. Drafts are visible in `astro dev` only. */
export async function getNotes(): Promise<Note[]> {
  const notes = await getCollection('writing', isPublished);
  return notes.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

/** Featured notes first, then the most recent. */
export async function getHomeNotes(limit: number): Promise<Note[]> {
  const notes = await getNotes();
  const featured = notes.filter((note) => note.data.featured);
  const rest = notes.filter((note) => !note.data.featured);
  return [...featured, ...rest].slice(0, limit);
}

export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', isPublished);
  return projects.sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}

/** Rough reading time in minutes, from the raw Markdown body. */
export function readingTime(body: string | undefined): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Dates in frontmatter are parsed as UTC midnight, so format them as UTC too —
 * otherwise a note published on the 13th renders as the 12th west of Greenwich.
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
 * Resolve `related:` references to the notes that this build actually publishes.
 *
 * Without the visibility filter a published note can advertise a draft's title and
 * link to a route that was never built. A reference that resolves to nothing is a
 * different problem — a typo in frontmatter — so it still throws.
 */
export async function resolveNotes(refs: ReferenceDataEntry<'writing'>[]): Promise<Note[]> {
  if (refs.length === 0) return [];
  const entries = await getEntries(refs);
  entries.forEach((entry, i) => {
    if (!entry) {
      throw new Error(
        `related: "${refs[i].id}" does not match any note in src/content/writing/. ` +
          `References are filenames without the extension.`,
      );
    }
  });
  return entries.filter(isPublished);
}

export const noteHref = (id: string) => `/writing/${id}/`;
