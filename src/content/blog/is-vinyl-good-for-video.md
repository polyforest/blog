---
title: "Is Vinyl good for video?"
description: "The first real question on our launch post was whether Vinyl plays video or only audio. The short answer: both — but it's audio-first, on purpose. Here's exactly where video stands."
pubDate: 2026-09-24
author: "Nicholas Bilyk"
tags: ["vinyl", "video", "dash", "hls"]
draft: false
---

When we [announced Vinyl](https://www.linkedin.com/posts/polyforest_today-im-announcing-that-amazon-vinyl-the-activity-7470112528870580226-8rwT)
in June, the examples were all `new Audio()`. The first substantive question under the
post asked exactly the right thing: **is this good for video, or only for audio?**

We should have answered it on the spot. Here's the answer, with the detail it deserved.

## The short answer

Vinyl is a **streaming engine, audio-first**, that handles video too. The media pipeline
is format-agnostic: the same queue, prefetch, and stall-detection machinery that powers
music playback on Amazon Music also drives video streams with AVC, HEVC, and VP9, separate
audio renditions, and even postroll ads.

But "handles video" and "is a video player" are different claims, and we only make the
first one.

## What audio-first means

The features we invest hardest in are the ones that matter most when the *sound* is the
product:

- **Gapless track transitions** — no audible seam between tracks, which the HTML5 media
  element won't give you on its own.
- **UHD audio up to 192 kHz** inside small source-buffer quotas.
- **Queues and prefetch** as first-class concepts, not afterthoughts bolted onto an
  `<audio>` tag.
- **A sub-millisecond SAX parser for DASH manifests**, because the manifest is hot path
  when you're chaining tracks.

Video teams care about a different list: player UI, captions workflows, ad decisioning,
quality ladders. Some of that exists in Vinyl's pipeline; the parts that live in full
video players like shaka-player or video.js are the parts we deliberately leave to them.

## Where video stands today

Concretely, on video Vinyl gives you:

- Playback of AVC, HEVC, and VP9 through the standard pipeline.
- Separate audio renditions — the track-selection machinery doesn't assume audio and
  video arrive together.
- Postroll ad support in the playback lifecycle.
- The same error recovery, stall detection, and buffered-versus-fetched accounting that
  audio playback gets, because it's the same engine.

What it doesn't give you is a UI, and MSE-based FairPlay is still
[open on the tracker](https://github.com/amazonmusic/vinyl/issues) — it's on our roadmap,
not in your build.

## Try it

The fastest way to evaluate is to point Vinyl at a stream you actually care about:

```shell
npm install @amazon/vinyl
```

The [README](https://github.com/amazonmusic/vinyl) has quickstarts, and the docs cover
the queue and prefetch APIs in depth. If you find a video case it handles badly, open an
issue — real streams are the only test suite that matters.
