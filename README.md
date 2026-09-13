# ryannel.dev

A small personal site: notes, projects, and a short about page.

Astro, static output, Markdown/MDX content, no backend, no database, no CMS, no analytics.
The only JavaScript is the theme toggle — two small inline scripts, no bundle, no network request.
Hosted on GitHub Pages, so hosting costs nothing.

```
src/
  content/notes/       one .mdx file per note
  content/projects/    one .md file per project
  content.config.ts    frontmatter schemas — the only place fields are defined
  consts.ts            name, links, taglines, how many notes the home page shows
  pages/               home, /notes, /notes/<slug>, /projects, /about, /rss.xml, 404
  components/          head, header, footer, note list, callout, figure, date, theme toggle
  layouts/Base.astro   the page shell
  styles/global.css    the whole design — one file, tokens at the top
public/                CNAME, robots.txt, favicon, og.png, diagrams/
```

## Local development

Requires Node 24 (see `.nvmrc`).

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:4321>. Drafts are visible in dev and excluded from builds.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve `dist/` exactly as it will be deployed |
| `npm run check` | Type-check and validate all frontmatter against the schemas |
| `npm run og` | Regenerate `public/og.png` after editing `scripts/generate-og.mjs` |

Run `npm run check` before pushing. It catches broken frontmatter, bad `related:` references
and type errors — the same check CI runs.

## Writing a new note

Create one file in `src/content/notes/`. The filename becomes the URL:
`context-is-the-hard-part.mdx` → `/notes/context-is-the-hard-part/`. Pick it carefully, because
changing it later breaks any link you have circulated.

```mdx
---
title: "What I'm learning about agent context"
description: "Why giving an agent more tokens isn't the same thing as giving it useful understanding."
published: 2026-09-13
updated:
featured: false
draft: false
---

Write here.
```

Only `title`, `description` and `published` are required. Everything else can be left blank or
omitted.

| Field | Meaning |
| --- | --- |
| `title` | Used as the page heading, `<title>` and social preview title |
| `description` | One sentence. Shown under the title, in lists, in RSS and in social previews |
| `published` | `YYYY-MM-DD`. The note's date, and its sort order |
| `updated` | Set this only for a substantive revision, not a typo fix |
| `featured` | `true` floats it to the top of the home page |
| `draft` | `true` keeps it out of the build; still visible in `npm run dev` |
| `tags` | Optional, descriptive only — there are deliberately no tag pages |
| `image` | Optional path to a social preview image, e.g. `/og/context.png` |
| `links` | Related code, skills, projects or a LinkedIn discussion — rendered at the end |
| `related` | Filenames (without extension) of other notes — rendered at the end |

Example of the optional end matter:

```yaml
links:
  - label: "Related code — groundwork/context"
    href: "https://github.com/ryannel/groundwork"
  - label: "Discussion on LinkedIn"
    href: "https://www.linkedin.com/posts/..."
related:
  - coding-agents-need-a-system-model
```

### Callouts

Available in any `.mdx` note without importing anything:

```mdx
<Callout type="hypothesis">What I currently think.</Callout>
<Callout type="surprise">Something I didn't expect.</Callout>
<Callout type="failed">An approach that didn't work.</Callout>
<Callout type="update" label="Update — March 2027">What changed my mind.</Callout>
```

Use `update` when you revise a note rather than silently rewriting it — a note should stay
identifiable as what you believed when you wrote it. Set `updated:` in the frontmatter at the
same time.

### Images and diagrams

Commit the file to `public/`, then reference it:

```mdx
<Figure src="/diagrams/repo-vs-system-model.svg" alt="Describe the diagram." caption="Optional." />
```

Diagrams are hand-written SVG rather than a rendering pipeline. Draw them with mid-tone neutral
strokes (`#8a8781` is what `public/diagrams/repo-vs-system-model.svg` uses) so a single file is
legible on both the light and dark background.

### Adding a project

Same idea, in `src/content/projects/`, with `name`, `description`, `status`, and optional
`order`, `links` and `related`. Projects render inline on `/projects` — there are no separate
project pages, and adding them would make the site bigger without helping a reader.

## Publishing

```bash
git add . && git commit -m "note: context is the hard part" && git push
```

Pushing to `main` builds and deploys. Nothing else to do.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: install, `npm run check`,
`npm run build`, then publish `dist/` to GitHub Pages. A failing type-check or invalid frontmatter
fails the build rather than deploying a broken site.

### One-time repository setup

1. Push this repository to GitHub (any repository name works with a custom domain).
2. **Settings → Pages → Build and deployment → Source**: select **GitHub Actions**.
   This is required — the default "Deploy from a branch" will ignore the workflow.
3. Push to `main` once and confirm the workflow succeeds under the **Actions** tab.

### Configuring ryannel.dev

`public/CNAME` already contains `ryannel.dev`, which preserves the custom domain across deploys.
You still need to do two things by hand.

**1. DNS — at your domain registrar**

For the apex domain, four `A` records and four `AAAA` records, all with host `@`:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |

And one record so `www` redirects to the apex:

| Type | Host | Value |
| --- | --- | --- |
| CNAME | www | `<your-github-username>.github.io` |

Confirm these addresses against GitHub's current documentation before entering them — GitHub has
changed them before:
<https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>

Check propagation with:

```bash
dig +short ryannel.dev A
```

**2. GitHub — Settings → Pages**

1. Under **Custom domain**, enter `ryannel.dev` and save. GitHub will verify DNS; this can take
   up to an hour.
2. Once the check passes, tick **Enforce HTTPS**. The certificate is issued automatically and
   free. If the tickbox is greyed out, DNS hasn't fully propagated yet — wait and revisit.

If you ever change the domain, update it in three places: `public/CNAME`, `site` in
`astro.config.mjs`, and the sitemap URL in `public/robots.txt`.

## What this site deliberately does not have

Recorded so these stay decisions rather than oversights, and so the site doesn't quietly grow:

- **No analytics.** If you ever want them, add a privacy-respecting script (Plausible, Fathom,
  GoatCounter) as a single `<script>` in `src/components/BaseHead.astro`. That is the only place
  it would go. Nothing else needs to change, and no cookie banner is required for those.
- **No tag or category pages.** `tags` is descriptive metadata, not navigation.
- **No per-project pages.** Projects are short; they render on one page.
- **No comments, share buttons, newsletter, or search.** Distribution happens on LinkedIn and
  elsewhere; the site is the archive.
- **No per-note generated social images.** One static `public/og.png` covers every page. Set
  `image:` in a note's frontmatter to override it with a committed file.
- **No theme framework.** The toggle is three states and about fifteen lines — see below.

Before adding anything: does it help you publish useful writing, or help a reader understand your
work? If not, leave it out.

## How the theme toggle works

Three states: **system** (the default, stores nothing), **light**, **dark**. The button cycles
through them and shows an icon for the current one.

Colours are defined once each, carrying both values:

```css
--paper: light-dark(#fdfcfa, #141413);
```

`light-dark()` resolves against the active `color-scheme`, so there is no duplicated dark palette
and no `prefers-color-scheme` media query. The toggle only sets `color-scheme` on `:root`:

```css
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='dark']  { color-scheme: dark; }
```

To change a colour, edit the one `light-dark()` line in `src/styles/global.css`.

Two scripts, both inline:

- **`src/layouts/Base.astro`** — reads `localStorage` and sets `data-theme` before first paint.
  It must stay in `<head>` and stay blocking; moving or deferring it reintroduces a flash of the
  wrong theme on every page load. It also adds a `has-js` class, which is what reveals the button —
  so with JavaScript off there is no dead control, just the OS preference.
- **`src/components/ThemeToggle.astro`** — the click handler. Which icon is visible is decided in
  CSS from `data-theme`, so the script only ever sets one attribute.

Syntax highlighting follows along: Shiki is configured with `defaultColor: false`, so it emits
both palettes as `--shiki-light` / `--shiki-dark` custom properties and the CSS picks between them
with `light-dark()` like everything else.

One known gap: the `<meta name="theme-color">` tags still follow the OS setting rather than a
manual override, so mobile browser chrome can differ from the page. Not worth scripting.

## Placeholder content

The six notes in `src/content/notes/` and the three projects in `src/content/projects/` are
placeholders, each marked with a "sample content" line. They exist to show the reading experience.
Rewrite or delete them — `rm src/content/notes/*.mdx` is a fine way to start.

Things to change before going live, all in `src/consts.ts`: the GitHub and LinkedIn URLs are
guesses based on the domain name and need checking.
