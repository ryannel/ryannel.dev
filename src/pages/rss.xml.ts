import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '../consts';
import { getProjects, projectHref } from '../lib/projects';
import { getNotes, noteHref } from '../lib/notes';

export const GET: APIRoute = async (context) => {
  const projects = await getProjects();
  const notes = await getNotes();

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    // getProjects() and getNotes() have already applied the site's one visibility
    // rule; filtering again here is how the feed and the indexes drift apart.
    items: [
      ...projects.map((project) => ({
        title: project.data.title,
        description: project.data.description,
        pubDate: project.data.published,
        link: projectHref(project.id),
      })),
      ...notes.map((note) => ({
        title: note.data.title,
        description: note.data.description,
        pubDate: note.data.published,
        link: noteHref(note.id),
      })),
    ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()),
    customData: `<language>en-gb</language>`,
  });
};
