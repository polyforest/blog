// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

// GitHub Pages project site: https://polyforest.github.io/blog/
// To serve from a custom domain later, change `site` and `base` together.
export default defineConfig({
  site: 'https://polyforest.github.io',
  base: '/blog',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
})
