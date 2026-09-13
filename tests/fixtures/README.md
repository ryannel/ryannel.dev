# Test fixtures

Content used only by `npm run test`. It lives here, outside `src/content/`, so the
loader never sees it and no build can publish it by accident — `scripts/test-visibility.mjs`
copies it into a throwaway checkout in the system temp directory, builds that, and
asserts on the output.

Each file exists to reproduce one thing that was once wrong, or could be:

| Fixture | What it is for |
| --- | --- |
| `__fixture-visible-note` | The reference that must survive filtering. |
| `__fixture-hidden-draft` | `draft: true` — must not be built, linked or advertised. |
| `__fixture-hidden-sample` | `sample: true` — the same rule by the other flag. |
| `__fixture-references-hidden` | Published, references one visible and both hidden notes. Renders the visible one only. |
| `__fixture-all-refs-hidden` | Published, references only hidden notes. The whole section must disappear. |
| `__fixture-project` | The same case on the projects page, where the list is rendered separately. |
| `__fixture-markdown-table` | A `.md` note: same table wrapper without MDX in the picture. |

`__fixture-visible-note` also carries a Markdown table, a table written as markup
(which reaches the processor as JSX, not as a Markdown node) and a `/public` figure
with explicit dimensions. `scripts/test-visibility.mjs` additionally builds a figure
with its dimensions missing and requires that build to fail.
