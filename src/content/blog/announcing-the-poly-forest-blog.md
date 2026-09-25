---
title: "Hello, world: why Poly Forest is writing things down"
description: "The Poly Forest engineering blog. What we're building and what we're learning, starting with Vinyl, our open-source web audio streaming engine."
pubDate: 2026-09-24
updatedDate: 2026-09-24
author: "Nicholas Bilyk"
tags: ["meta", "vinyl", "open-source"]
draft: false
---

Every project leaves the same trail behind: decisions buried in git history, arguments
in issue threads, context scattered across release notes. It all makes sense if you were
in the room. This blog is where we write things down for the people who weren't.

## What to expect

Everything here is written by the people doing the work. Some posts are deep dives into
how a piece of the system actually works: parsers, buffers, rendering loops. Others are
release write-ups: what shipped, why, and what we'd do differently next time. The misses
get the same treatment as the wins.

The rest is notes from maintaining open source. Test coverage as part of the workflow,
CI that fails usefully, supporting real users at real scale. Less glamorous than the
deep dives, but it's most of the actual job.

## Starting with Vinyl

We're starting with [Vinyl](https://github.com/amazonmusic/vinyl), the open-source
JavaScript streaming engine we announced in
[June 2026](https://www.linkedin.com/posts/polyforest_today-im-announcing-that-amazon-vinyl-the-activity-7470112528870580226-8rwT).
It's the engine behind playback on Amazon Music and Alexa.com, and it's built for the
web: DASH and HLS with DRM, gapless track transitions, queues and prefetch as
first-class concepts. All of it in about 75 KiB gzipped, with zero runtime dependencies.

We have opinions about web media, mainly about where the engine ends and the player UI
begins, and how much the platform should be doing for you instead. Writing them down is
overdue.

## The ground rules

A few commitments, so you know what you're getting. If we quote a bundle size or a
benchmark, the script that produced it is published next to it, with the date it was
measured. We answer the naive questions first, especially the ones left in the comments
on our own announcements. And when Vinyl isn't the right tool, we'll say so: simple
sites don't need a streaming engine, and pretending otherwise buys nobody anything.

Next up: the first real question under the launch announcement. Is Vinyl good for
video, or only for audio? The next post answers it.
