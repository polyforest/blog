# [Poly Forest Blog](https://blog.polyforest.com/)

The Poly Forest engineering blog — a static [Astro](https://astro.build) site
published to GitHub Pages at <https://blog.polyforest.com/>.

## Writing a post

```shell
npm run new-post
```

That's the whole workflow. The script asks for a title and slug, then creates
`src/content/blog/<slug>.md` pre-filled with frontmatter and section scaffolding.
Write the body in Markdown, run `npm run dev` to preview at
<http://localhost:4321/>, and open a PR when it reads well.

### Frontmatter reference

| Field | Required | Notes |
|---|---|---|
| `title` | yes | |
| `description` | yes | One sentence; used for meta tags, the index, and RSS. |
| `pubDate` | yes | `YYYY-MM-DD` |
| `updatedDate` | no | Set when a post is meaningfully revised. |
| `author` | no | Defaults to Nicholas Bilyk. |
| `tags` | no | Array of strings. |
| `draft` | no | `true` hides a post from the site and feeds entirely. |

A post that fails frontmatter validation fails `astro build`, so broken
metadata can never deploy.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with live reload at `localhost:4321/`. |
| `npm run build` | Renders the social card to PNG, then builds the site to `dist/`. |
| `npm run preview` | Serves the production build locally. |
| `npm run check` | Astro + TypeScript diagnostics. |
| `npm run new-post` | Scaffolds a new post in `src/content/blog/`. |

## How the pieces fit

- `src/layouts/` — `BaseLayout` (the HTML shell, head, header, footer) and
  `PostLayout` (post chrome: title header, byline, share links). New page
  types compose these instead of duplicating them.
- `src/components/` — header, footer, post card, share links, and `BaseHead`,
  which owns all meta/OG/Twitter/JSON-LD tags.
- `src/content/blog/` — the posts (Markdown with validated frontmatter).
- `src/utils/urls.ts` — URL helpers (path joining, canonical URLs, and date
  formatting), all derived from the configured site origin.
- `public/` — favicon, author avatar, fonts, and the social share card.

## Social card

`public/social-card.svg` is the 1200×630 share image; `npm run build` renders
it to `social-card.png` with [@resvg/resvg-js](https://github.com/thx/resvg-js)
using the bundled Scope One font, so the card matches the site everywhere. The
rendered PNG is committed, so builds still work if resvg can't install.

## Deployment

Merging to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
`npm ci`, `astro check`, `npm run build`, then the Pages artifact deploy.
Pull requests run the same checks without deploying.

## Adding the new-post script to your flow

The scaffold refuses to overwrite and warns on near-colliding slugs. Drafts
(`draft: true`) are excluded from the index, RSS, sitemap, and post pages until
you flip the flag.
