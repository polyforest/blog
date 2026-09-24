#!/usr/bin/env node
/**
 * Scaffolds a new blog post: npm run new-post [-- --title "..." --slug ...]
 * Creates src/content/blog/<slug>.md with frontmatter and section stubs.
 * Refuses to overwrite an existing file.
 */
import { existsSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const postsDir = path.join(root, 'src/content/blog')

// ---- gather options -------------------------------------------------------
const args = process.argv.slice(2)
function readFlag(name) {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined
}

let title = readFlag('--title')
let slug = readFlag('--slug')

const rl = readline.createInterface({ input, output })
if (!title) title = (await rl.question('Post title: '))?.trim()
if (!slug) {
  const suggested = (title || 'new-post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  slug = (await rl.question(`Slug [${suggested}]: `))?.trim() || suggested
}
rl.close()

if (!title) {
  console.error('A title is required.')
  process.exit(1)
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Invalid slug "${slug}" — use lowercase letters, numbers, and hyphens.`)
  process.exit(1)
}

const filePath = path.join(postsDir, `${slug}.md`)
if (existsSync(filePath)) {
  console.error(`${filePath} already exists — choose another slug.`)
  process.exit(1)
}

// ---- friendly collision check --------------------------------------------
// Filenames may carry a date prefix or suffix variant; if something clearly
// duplicates this slug already exists, warn rather than clobber.
const existing = existsSync(postsDir) ? readdirSync(postsDir) : []
const clash = existing.find((f) => f.endsWith(`${slug}.md`))
if (clash) {
  console.error(`A post ending in "${slug}.md" already exists (${clash}) — choose another slug.`)
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)

const template = `---
title: ${JSON.stringify(title)}
description: "One sentence on why a reader should care. Used for meta tags, the index card, and RSS."
pubDate: ${today}
tags: []
draft: true
---

Write here. Delete this paragraph before publishing.

## Section

<!-- Drafts are hidden from the site and feeds until draft: false is set. -->
`

writeFileSync(filePath, template)
console.log(`Created ${path.relative(root, filePath)}`)
console.log('Next: npm run dev, then edit the file. Set draft: false when it reads well.')
