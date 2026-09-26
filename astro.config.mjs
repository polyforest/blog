// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

// GitHub Pages site, served from the custom domain https://blog.polyforest.com
// at the domain root. The committed public/CNAME pins the domain on every deploy.
export default defineConfig({
  site: 'https://blog.polyforest.com',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
})
