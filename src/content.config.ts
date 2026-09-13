import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * YAML turns an empty frontmatter key (`updated:`) into null, which would otherwise
 * coerce to 1970-01-01 or fail validation. Treat null and '' as "not set".
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === null || value === '' ? undefined : value), schema);

const links = optional(
  z
    .array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    )
    .default([]),
);

const writing = defineCollection({
  loader: glob({ base: './src/content/writing', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    updated: optional(z.coerce.date().optional()),
    featured: optional(z.boolean().default(false)),
    draft: optional(z.boolean().default(false)),
    /** Descriptive only — there are no tag pages, and there shouldn’t be. */
    tags: optional(z.array(z.string()).default([])),
    /** Optional social preview image, relative to /public (e.g. "/og/context.png"). */
    image: optional(z.string().optional()),
    /** "Related code / skill / project / discussion" links, rendered after the article. */
    links,
    /** Filenames of other notes, without the extension. */
    related: optional(z.array(reference('writing')).default([])),
  }),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    /** Free text, e.g. "Active", "Ongoing", "Occasional". */
    status: z.string(),
    /** Lower sorts first. */
    order: optional(z.number().default(100)),
    draft: optional(z.boolean().default(false)),
    links,
    related: optional(z.array(reference('writing')).default([])),
  }),
});

export const collections = { writing, projects };
