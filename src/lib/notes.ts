import { getCollection, type CollectionEntry } from 'astro:content';
import { isPublished } from './projects';

export type Note = CollectionEntry<'notes'>;

/** Published notes, newest first. Hidden ones are visible in `astro dev` only. */
export async function getNotes(): Promise<Note[]> {
  const notes = await getCollection('notes', isPublished);
  return notes.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

export const noteHref = (id: string) => `/notes/${id}/`;
