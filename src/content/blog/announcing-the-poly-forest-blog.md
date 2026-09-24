---
title: "Hello, world — why Poly Forest is writing things down"
description: "An engineering blog for Poly Forest: what we're building, what we're learning, and why our first subject is Vinyl, our open-source web audio streaming engine."
pubDate: 2026-09-24
updatedDate: 2026-09-24
author: "Nicholas Bilyk"
tags: ["meta", "vinyl", "open-source"]
draft: false
---

Every project at Poly Forest eventually produces the same artifact: a pile of knowledge
sitting in git history, issue threads, and release notes that only make sense if you
already know the story. This blog is where that story gets written down for everyone else.

## What to expect

Three kinds of posts, all written by the people doing the work:

- **Deep dives.** How a piece of the system actually works — parsers, buffers, rendering
  loops — with the benchmarks and repro scripts to back up any number we quote.
- **Release write-ups.** When something ships, we'll explain what changed, why it changed,
  and what we'd do differently. The misses come along with the wins.
- **Notes from shipping.** The unglamorous parts of maintaining open-source software:
  test coverage as a workflow, CI that fails usefully, supporting real users at real scale.

## Starting with Vinyl

Our first subject is [Vinyl](https://github.com/amazonmusic/vinyl), the open-source
JavaScript streaming engine we announced in
[June 2026](https://www.linkedin.com/posts/polyforest_today-im-announcing-that-amazon-vinyl-the-activity-7470112528870580226-8rwT).
It's the engine behind playback on Amazon Music and Alexa.com, and it's built for the web:
DASH and HLS with DRM, gapless track transitions, queues and prefetch as first-class
concepts, all in about 75 KiB gzipped with zero runtime dependencies.

We have strong opinions about web media — about what belongs in an engine, what belongs
in a player UI, and what the platform should be doing for you instead. Writing them down
is overdue.

## The ground rules

A few commitments, so you know what you're reading:

1. **Numbers come with methods.** If we quote a bundle size or a benchmark, the script
   that produced it is published next to it, with the date it was measured.
2. **We answer the naive questions first.** Especially the ones left in comments on our
   own announcements.
3. **We say when Vinyl isn't the right tool.** Simple sites don't need a streaming
   engine, and pretending otherwise buys nobody anything.

That's the deal. Next up: an honest answer to the question from the launch thread —
"is this good for video, or only for audio?"
