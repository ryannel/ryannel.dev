import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '../consts';
import { getProjects, projectHref } from '../lib/projects';

export const GET: APIRoute = async (context) => {
  const projects = await getProjects();

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    // getProjects() has already applied the site's one visibility rule;
    // filtering again here is how the feed and the index drift apart.
    items: projects.map((project) => ({
      title: project.data.title,
      description: project.data.description,
      pubDate: project.data.published,
      link: projectHref(project.id),
    })),
    customData: `<language>en-gb</language>`,
  });
};
