#!/usr/bin/env node
/**
 * Renders public/social-card.svg to public/social-card.png (1200x630) for
 * Open Graph/Twitter images, using the bundled Scope One TTF so the wordmark
 * matches the site everywhere. Skips rendering if resvg is unavailable and a
 * card was committed previously — CI still passes, just with the old art.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = path.join(root, 'public/social-card.svg')
const pngPath = path.join(root, 'public/social-card.png')

let resvg
try {
  resvg = (await import('@resvg/resvg-js')).Resvg
} catch {
  if (existsSync(pngPath)) {
    console.warn('@resvg/resvg-js unavailable — keeping the committed social-card.png')
    process.exit(0)
  }
  console.error('@resvg/resvg-js unavailable and no committed social-card.png exists')
  process.exit(1)
}

const svg = (await import('node:fs')).readFileSync(svgPath, 'utf8')
const resvgRender = new resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: {
    fontFiles: [path.join(root, 'public/fonts/ScopeOne-Regular.ttf')],
    loadSystemFonts: false,
    defaultFontFamily: 'Scope One',
  },
  background: '#191919',
})

const png = resvgRender.render().asPng()
;(await import('node:fs')).writeFileSync(pngPath, png)
console.log(`Wrote ${path.relative(root, pngPath)} (${png.length} bytes)`)
