import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { absoluteUrl } from '../utils/urls'

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())

  return rss({
    title: 'Poly Forest Blog',
    description:
      'Engineering notes from Poly Forest — interactive software, games, and web media.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: absoluteUrl(`/${post.id}/`, context.site),
      categories: post.data.tags,
    })),
    customData: '<language>en-us</language>',
  })
}
