/**
 * Shared URL helpers. The site is published as a GitHub Pages project
 * site (https://polyforest.github.io/blog/), so every internal link
 * must be prefixed with the configured base path.
 */

/** The site origin, from astro.config. */
export const SITE = import.meta.env.SITE as string | undefined

export const SITE_TITLE = 'Poly Forest Blog'

export const AUTHOR = 'Nicholas Bilyk'

export const SITE_DESCRIPTION =
  'Notes from the Poly Forest team — technical write-ups and release news for Vinyl, our open-source web audio library.'

/** The configured base path, without a trailing slash ('' for root deploys). */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '')

/** Prefix an absolute-on-site path with the configured base. */
export function withBase(path: string): string {
  return `${BASE}${path}`
}

/**
 * Build an absolute URL for canonical/OG/RSS use.
 * `site` comes from astro.config; `path` is absolute-on-site (starts with /).
 */
export function absoluteUrl(path: string, site: URL | undefined): string {
  if (!site) return withBase(path)
  const root = site.href.replace(/\/+$/, '')
  return `${root}${withBase(path)}`
}

/** Format a date the way the blog displays it: "June 9, 2026". */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** A URL-safe slug: lowercase, hyphenated, ASCII-only. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}
