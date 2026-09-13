import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '../consts';
import { getNotes, noteHref } from '../lib/notes';

export const GET: APIRoute = async (context) => {
  const notes = await getNotes();

  return rss({
    title: `${SITE.title} — Notes`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: notes
      .filter((note) => !note.data.draft)
      .map((note) => ({
        title: note.data.title,
        description: note.data.description,
        pubDate: note.data.published,
        link: noteHref(note.id),
      })),
    customData: `<language>en-gb</language>`,
  });
};
