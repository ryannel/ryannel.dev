import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * YAML turns an empty frontmatter key (`updated:`) into null, which would otherwise
 * coerce to 1970-01-01 or fail validation. Treat null and '' as "not set".
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === null || value === '' ? undefined : value), schema);

/** Text that has to say something: "   " is not a title. */
const text = z.string().trim().min(1);

/**
 * A date that must actually be one. Without the preprocess, `published:` left
 * empty is null, `z.coerce.date()` reads that as epoch zero, and the page
 * publishes itself on 1 January 1970 — sorted last, dated absurdly, no error.
 */
const requiredDate = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  z.coerce.date(),
);

/**
 * Where a link may point. The only thing being rejected is a destination with no
 * scheme and no leading slash — "github.com/..." resolves relative to the
 * current page and 404s. Any scheme is fine, mailto: and tel: included; it is
 * not this schema's business which ones you use.
 */
const href = text.refine(
  (value) => /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/') || value.startsWith('#'),
  { message: 'needs a scheme (https:, mailto:), or must start with "/" or "#"' },
);

const links = optional(
  z
    .array(
      z.object({
        label: text,
        href,
      }),
    )
    .default([]),
);

/**
 * The two ways a file can exist in the repository without being published.
 *
 * `draft` is "not finished yet". `sample` is "demonstration content" — the
 * placeholder pages that show what the reading experience looks like before
 * there is anything real to put here. They are kept apart because they mean
 * opposite things about what happens next: a draft is waiting to be finished,
 * a sample is waiting to be deleted.
 *
 * Both are hidden by exactly the same rule; see isPublished in src/lib/projects.ts.
 */
const visibility = {
  draft: optional(z.boolean().default(false)),
  sample: optional(z.boolean().default(false)),
};

/**
 * Everything on the site is a project: something I built, with the write-up of
 * how it went. Each one has its own page at /projects/<slug>/.
 */
const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z
    .object({
      title: text,
      description: text,
      /** Free text, e.g. "Completed", "In progress". */
      status: text,
      published: requiredDate,
      updated: optional(z.coerce.date().optional()),
      featured: optional(z.boolean().default(false)),
      ...visibility,
      /** Descriptive only — there are no tag pages, and there shouldn’t be. */
      tags: optional(z.array(text).default([])),
      /** Optional social preview image, relative to /public (e.g. "/og/context.png"). */
      image: optional(z.string().startsWith('/').optional()),
      /** Code, repositories and anything else worth pointing at, rendered after the write-up. */
      links,
      /** Filenames of other projects, without the extension. */
      related: optional(z.array(reference('projects')).default([])),
    })
    .refine((data) => !data.updated || data.updated >= data.published, {
      message: 'updated: is before published: — one of the two dates is wrong',
      path: ['updated'],
    }),
});

export const collections = { projects };
