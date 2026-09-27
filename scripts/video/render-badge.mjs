#!/usr/bin/env node
/**
 * Renders the fast-forward overlay badge (a translucent pill with a ⏩ glyph
 * and a label) to a transparent PNG for ffmpeg's overlay filter.
 *
 *   node scripts/video/render-badge.mjs <out.png> <height-px> [label]
 *
 * Uses @resvg/resvg-js and the blog's bundled Scope One font, so the badge
 * renders identically everywhere without ffmpeg's drawtext (absent from the
 * default Homebrew ffmpeg build).
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const [out, heightArg, label = '4× speed'] = process.argv.slice(2)
const height = Number(heightArg)
if (!out || !Number.isFinite(height) || height < 8) {
  console.error('usage: render-badge.mjs <out.png> <height-px> [label]')
  process.exit(1)
}

// Designed on a 64px-tall canvas; the width grows with the label.
const H = 64
const fontSize = 30
const iconW = 34
const padX = 26
const gap = 14
const textW = Math.ceil(label.length * fontSize * 0.56)
const W = padX + iconW + gap + textW + padX

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Two right-pointing triangles for the fast-forward glyph.
const iy = H / 2
const tri = (x) => `M${x},${iy - 13} L${x + 17},${iy} L${x},${iy + 13} Z`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${(H - 2) / 2}"
    fill="#111111" fill-opacity="0.72" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
  <path d="${tri(padX)} ${tri(padX + 16)}" fill="#f0d554"/>
  <text x="${padX + iconW + gap}" y="${iy}" dominant-baseline="central"
    font-family="Scope One" font-size="${fontSize}" fill="#f5f2ea">${escape(label)}</text>
</svg>`

const png = new Resvg(svg, {
  fitTo: { mode: 'height', value: Math.round(height) },
  font: {
    fontFiles: [path.join(root, 'public/fonts/ScopeOne-Regular.ttf')],
    loadSystemFonts: false,
    defaultFontFamily: 'Scope One',
  },
})
  .render()
  .asPng()
writeFileSync(out, png)
