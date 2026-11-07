---
name: publish
description: Publish, unpublish, revise or check projects on ryannel.dev. Use for "publish this", "start a new project", "add a project", "is it live?", "add an update to an old project", or any change to src/content/projects that should ship.
---

# Publishing on ryannel.dev

Pushing to `main` deploys. CI runs check, build, verify and test, then publishes `dist/` to
GitHub Pages. The README has the full reference (fields, figures, callouts, the in-page editor);
this is the working checklist.

Only push when Ryan asks for it in this conversation. Publishing is public and outward-facing.

## Where things live

- Projects: `src/content/projects/<slug>.mdx`, served at `/projects/<slug>/`: something built,
  with its write-up. The filename is the URL. Don't rename a published project. (Old `/writing/`
  URLs are redirected in `astro.config.mjs`.)
- Notes: `src/content/notes/<slug>.mdx`, served at `/notes/<slug>/`: writing on its own, with no
  `status` or `related`. Everything below applies to notes the same way, minus those fields.
- Images for a project: `src/assets/<slug>/`, imported and shown with `<Figure>`. `wide` needs a
  source at least 1152px wide.
- Static pages, data and tiles that must be served as-is: `public/<slug>/`.
- Fields are defined only in `src/content.config.ts`. `isPublished` in `src/lib/projects.ts` is the
  single rule for both: `draft: true` or `sample: true` hides an entry from the build but not from
  `npm run dev`.

## Start a project

Create `src/content/projects/<slug>.mdx` with `title`, a one-sentence `description`,
`status: "In progress"`, `published: <today>`, `draft: true`, and `tags`. Add `links` for code or
repos worth pointing at, and `related` for other projects (filenames without the extension).

## Publish a project

1. Run the `review` skill on the write-up and bring the findings to Ryan. Ask before changing his
   own phrasing.
2. In the frontmatter, set `draft: false`, `published:` to today's date, and `status:` (usually
   `Completed`).
3. Check for leftovers: no `TK`, no `{/* notes to Claude */}`, no unused imports, and alt text
   on every figure.
4. Run the whole CI sequence locally:
   ```bash
   npm run check && npm run build && npm run verify && npm test
   ```
   `verify` checks every HTML page in `dist/`, including anything copied into `public/`. Each
   page needs `<link rel="canonical" href="https://ryannel.dev/<path>">`, a
   `<meta name="description">` and an `og:image`. The site card `https://ryannel.dev/og.png` is
   fine for an og:image.
5. Stage only this project's files: the `.mdx`, its `src/assets/<slug>/`, any `public/<slug>/`,
   and any component or data it needs. Leave other drafts and unrelated local changes alone;
   check `git status` and stage by path, never `git add .`.
6. Commit with the message `Publish: <title>` (later edits use `<Short name>: <what changed>`)
   and push to `main`.
7. Watch the deploy, then check the live page against the origin, not local DNS:
   ```bash
   gh run watch "$(gh run list --workflow deploy.yml -L 1 --json databaseId -q '.[0].databaseId')" --exit-status
   ```
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" --resolve ryannel.dev:443:185.199.108.153 https://ryannel.dev/projects/<slug>/
   ```
   Also check that it appears on `/projects/`.

## Revise a published project

Write-ups are dated snapshots. Typos, broken links and factual corrections need no marking. When
the thinking changes, write a new one, link the two with `related:`, and if it helps a reader, add
`<Callout type="update" label="Update — Month YYYY">` to the old one and set `updated:`.

## Unpublish

Set `draft: true` and push. The file stays in the public repo. A draft is unpublished, not
private.

## Don't

- Don't add pages, tags, types or features the site doesn't have. The constraint is "do not
  overbuild this".
- Don't commit `IDEAS.md`. It's gitignored on purpose.
