# ryannel.dev

A small personal site: writing, projects, and a short about page.

Astro, static output, Markdown/MDX content, no backend, no database, no CMS.
The site's own JavaScript is two small inline scripts for the theme toggle — no bundle, nothing
fetched. Production builds also carry Cloudflare Web Analytics, which is one external script and
the only third-party request on the page; see Analytics below.
Hosted on GitHub Pages, so hosting costs nothing.

```
src/
  content/writing/     one .mdx file per note, served at /writing/<slug>/
  content/projects/    one .md file per project
  content.config.ts    frontmatter schemas — the only place fields are defined
  consts.ts            name, links, taglines, how many notes the home page shows
  pages/               home, /writing, /writing/<slug>, /projects, /about, /rss.xml, 404
  components/          head, header, footer, note list, callout, figure, date, theme toggle
  layouts/Base.astro   the page shell
  styles/global.css    the whole design — one file, tokens at the top
public/                CNAME, robots.txt, favicon, og.png, grain.png, fonts/, diagrams/
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
| `npm run grain` | Regenerate `public/grain.png`, the dark-mode texture |

Run `npm run check` before pushing. It catches broken frontmatter, bad `related:` references
and type errors — the same check CI runs.

## Writing a new note

Everything dated is a Note, whether it is 300 words or 3,000. "Note" describes the stance, not the
length — there is no separate essay or article type. `featured: true` is the only lever for giving
a piece more prominence.

Create one file in `src/content/writing/`. The filename becomes the URL:
`messy-real-world-context.mdx` → `/writing/messy-real-world-context/`. Pick it carefully, because
changing it later breaks any link that is already out there.

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
| `updated` | Only when you add a dated update block. Not for typos or broken links |
| `featured` | `true` floats it to the top of the home page |
| `draft` | `true` keeps it out of the build; still visible in `npm run dev` |
| `tags` | Optional, descriptive only — there are deliberately no tag pages |
| `image` | Optional path to a social preview image, e.g. `/og/context.png` |
| `links` | Anything worth pointing at — code, a skill, a project, a discussion elsewhere |
| `related` | Filenames (without extension) of other notes — rendered at the end |

Example of the optional end matter:

```yaml
links:
  - label: "The code this came from"
    href: "https://github.com/ryannel/groundwork"
  - label: "Discussion"
    href: "https://example.com/thread"
related:
  - coding-agents-context-across-a-large-system
```

`links` is deliberately generic — no platform is assumed or privileged. Add one when a particular
piece actually has somewhere worth pointing, and leave it out otherwise.

### Callouts

Available in any `.mdx` note without importing anything:

```mdx
<Callout type="hypothesis">What I currently think.</Callout>
<Callout type="surprise">Something I didn't expect.</Callout>
<Callout type="failed">An approach that didn't work.</Callout>
<Callout type="update" label="Update — March 2027">What changed my mind.</Callout>
```

### Revising a note

Notes are dated snapshots, not living documentation. A note dated September 2026 records what was
built, observed and understood in September 2026. It is not kept in line with a later view.

When the thinking moves materially, in order of preference:

1. write a new note;
2. link it to the earlier one via `related:`;
3. if it helps a reader, add a short dated update to the old note pointing at the new thinking:

```mdx
<Callout type="update" label="Update — March 2027">
  I've changed my mind about part of this. I wrote about what changed
  [here](/writing/the-newer-note/).
</Callout>
```

Set `updated:` in the frontmatter when adding one. The original argument stays as written — it is
the record of what was thought at the time. Factual corrections, typos, broken links and
formatting fixes need no update block.

### Images and diagrams

The simplest pattern, and the one to reach for by default: put the file in `src/assets/` and
import it.

```mdx
import diagram from '../../assets/agent-context.png';

<Figure src={diagram} alt="Describe the diagram." caption="Optional." />
```

Importing gets you the dimensions, a `srcset`, and a smaller format, all at build time. There is
no separate export or resizing step — commit the original and Astro does the rest.

For something already in `public/`, width and height are required, because Astro has no metadata
to read and without them the page reflows when the image lands:

```mdx
<Figure src="/diagrams/repo-vs-system-model.svg" alt="..." width={640} height={280} />
```

Leaving them out fails the build with an explanation rather than shipping the layout shift.

Images load lazily by default. Pass `eager` only for one that is genuinely visible without
scrolling — it sets high fetch priority, which is wasted if the image is further down.

Diagrams are hand-written SVG rather than a rendering pipeline. Draw them with mid-tone neutral
strokes (`#8a8781` is what `public/diagrams/repo-vs-system-model.svg` uses) so a single file is
legible on both the light and dark background. Nothing inverts images by theme.

### Tables

Write ordinary Markdown tables. The `wrap-tables` plugin in `astro.config.mjs` puts each one in a
`.table-wrap` container, so a table wider than the column scrolls inside itself instead of widening
the page, while a small one simply fits. The table node itself is untouched, so it keeps its real
semantics and anything you wrote on it.

It runs in the shared Sätteri pipeline, so `.md` and `.mdx` behave identically — an MDX component
override would only have covered `.mdx`. The one edit it makes is to the corner cell of a matrix
table: Markdown has no way to say an empty header is not a header, so an empty first cell of the
first header row becomes a `<td>`.

### Drafts

`draft: true` keeps a note out of production entirely: no route, no listing, no RSS entry, no
sitemap entry, and no mention from another note's `related:`. In `astro dev` drafts are visible, so
you can read one before publishing.

One thing this is not: a public Git repository is not confidential storage. A draft is unpublished,
not private.

A `related:` reference that matches nothing is still a build error — a typo and an unpublished
note are different problems, and only one of them should be silent.

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

If you ever change the domain, update it in four places: `public/CNAME`, `site` in
`astro.config.mjs`, `SITE.url` in `src/consts.ts` (canonical URLs, and the host the analytics
beacon checks before it loads), and the sitemap URL in `public/robots.txt`.

## What this site deliberately does not have

Recorded so these stay decisions rather than oversights, and so the site doesn't quietly grow:

- **No cookies, no local storage for analytics, no custom events.** Cloudflare Web Analytics is
  cookieless and sets nothing on the reader's device — see Analytics below. Outbound clicks and
  custom events are deliberately not tracked. (`localStorage` is used for one thing only: the
  theme you picked.)
- **No tag or category pages.** `tags` is descriptive metadata, not navigation.
- **No per-project pages.** Projects are short; they render on one page.
- **No comments, share buttons, newsletter, follower counts or engagement metrics.** The site is
  the canonical archive. Distribution is per-piece and manual: some notes are worth submitting
  somewhere, most are not, and the site does not depend on any of it. No platform is the default,
  and none should get an integration.
- **No separate essay, article or long-form type.** Everything dated is a Note.
- **No per-note generated social images.** One static `public/og.png` covers every page. Set
  `image:` in a note's frontmatter to override it with a committed file.
- **No theme framework.** The toggle is three states and about fifteen lines — see below.

Before adding anything: does it help publish useful writing, or help a reader understand the
work? If not, leave it out.

## Analytics

Cloudflare Web Analytics, via Cloudflare's manual beacon. It is cookieless and sets nothing on the
reader's device. GitHub Pages remains the host — **DNS does not move to Cloudflare**, and there is
no Worker, proxy or Cloudflare Pages involved. **No npm dependency.**

Whether a consent banner is required is a question about your jurisdiction and your readers, not
about this repository; nobody has reviewed that here. What the code does is described above and
below, and it is the thing to check a requirement against.

The beacon lives once in `src/layouts/Base.astro`. Three conditions all have to hold before a
single byte is requested from Cloudflare:

```
import.meta.env.PROD                     a production build, so never `astro dev`
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN    set at build time
location.hostname === ryannel.dev        checked in the browser, against SITE.url
```

The first two are build-time and decide whether the guard script is emitted at all. The third is
the one a build flag cannot answer — `PROD` describes how the artifact was built, not where it is
being served — so the host is compared at runtime and the beacon element is only created on a
match. A production build previewed on localhost therefore reports nothing, and a missing token
omits the guard entirely while the build still succeeds.

The element is configured before it is inserted (`type="module"`, as Cloudflare's FAQ recommends
for the manual beacon, plus `data-cf-beacon`), and a flag on `window` means it can only ever be
added once. If the request is blocked or fails, nothing else on the page is affected.

### One-time setup

1. Sign in to Cloudflare and open **Web Analytics**.
2. **Add a site**, and enter `ryannel.dev`.
3. Open **Manage site** and copy the site token from the snippet.
4. In GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**

   ```
   PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN = <site token>
   ```

   A variable, not a secret: the token is public by design, and a variable keeps it readable in the
   workflow. Do not commit a `.env` containing the real value.
5. Re-run the latest **Deploy to GitHub Pages** workflow, or push anything.
6. Visit <https://ryannel.dev> and confirm data appears in Cloudflare after a few minutes.

The workflow already passes the variable through to `npm run build`; nothing else needs changing.

## Fonts

Source Serif 4, self-hosted from `public/fonts/`, weight axis only. `public/fonts/SOURCE.txt`
records the exact version and licence.

The reason for a web font at all is consistency: the previous stack led with Charter, which exists
on macOS and nowhere else, so Windows, Linux and Android each fell back to something different.

Three decisions worth keeping:

- **Weight axis, not optical size.** The `opsz` builds are 2.4x the bytes for a refinement that is
  marginal across the 18-34px range this site actually uses.
- **latin and latin-ext, not a subset of the current articles.** Subsetting against today's notes
  would mean regenerating fonts whenever a piece contains a character the old ones lacked.
  `unicode-range` means latin-ext is only fetched by a page that needs it, so it costs nothing
  until it is used. Swedish letters and typographic punctuation are all in `latin`.
- **Only the normal face is preloaded.** It is referenced from an external stylesheet, so without
  the preload the browser cannot discover it until that CSS arrives. Measured: it is worth about
  300ms of FCP. Italic is not on the critical path for most pages.

The stack also declares metric-matched fallbacks so line wrapping does not move when the real font
swaps in — six faces: upright and italic for Charter, Georgia, and the Times-like default that
`serif` resolves to on Windows, Linux and Android.

Three things there are easy to get wrong, and were:

- **`local()` matches a font's PostScript or full name, not its family name.** `local('Charter')`
  never resolved on macOS; `local('Charter-Roman')` does. Both spellings are listed.
- **`size-adjust` has to come from advance width, and be measured on real body copy.** Tuning on a
  short specimen left the fallback setting a paragraph a line short. The current values come from
  834 characters of this site's own prose.
- **Declare the italic faces.** Without them the browser slants the upright, which measured 8.4%
  too wide.

Measured across 324 elements on six pages at 320/390/768/1440: 2.5% of them change height when the
web font replaces the fallback, against 39.3% before. Bold italic is the remaining gap at about
4%, because it is synthesised bold over a real italic.

To drop the web font entirely, remove the `@font-face` blocks and the preload, and put `Charter`
back at the front of `--font-prose`. Everything else keeps working.

## Dark-mode texture

`public/grain.png` is a 128x128 tile, 7.2 KiB, whose noise lives in its **alpha** channel. That
means the CSS needs no `opacity`, no blend mode and no filter — it is a repeating background on
`body`, behind the content, in dark mode only. There is no fixed overlay and so no full-viewport
compositing layer. It is disabled for printing and for forced-colours mode, and publishing a note
never requires regenerating it.

It is meant to be imperceptible as a pattern. If it ever reads as dust, lower `MAX_ALPHA` in
`scripts/generate-grain.mjs` and run `npm run grain`.

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

`<meta name="theme-color">` follows the toggle too. The static pair in `<head>` is media-scoped and
correct without JavaScript, but the HTML spec picks the *first* matching `theme-color`, so an
override cannot simply be appended — `ThemeToggle.astro` removes both and owns a single tag
instead, and updates it when the OS flips while "system" is selected.

## Placeholder content

The six notes in `src/content/writing/` and the three projects in `src/content/projects/` are
placeholders. Each note carries a visible "sample content" line. They exist to show the reading
experience. Rewrite or delete them — `rm src/content/writing/*.mdx` is a fine way to start.

If you delete the notes, clear the `related:` lists in the sample projects too: a reference to a
note that no longer exists is a build error, deliberately. With no notes at all the site still
builds and reads as intentional — the home page drops its writing section rather than showing a
heading over nothing, and `/writing/` is its title and preamble with nothing under them yet.

The collection is `writing` throughout — folder, URL and schema. "Writing" is the section; a
"Note" is one piece in it.
