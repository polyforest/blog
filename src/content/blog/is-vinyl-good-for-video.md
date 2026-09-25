---
title: "Is Vinyl good for video?"
description: "The first real question on our launch post was whether Vinyl plays video or only audio. Both, though it's audio-first on purpose. Here's where video stands."
pubDate: 2026-09-24
author: "Nicholas Bilyk"
tags: ["vinyl", "video", "dash", "hls"]
draft: false
---

When we [announced Vinyl](https://www.linkedin.com/posts/polyforest_today-im-announcing-that-amazon-vinyl-the-activity-7470112528870580226-8rwT)
in June, the examples were all `new Audio()`. The first substantive question under the
post was the right one: is this good for video, or only for audio? We should have
answered it on the spot. This post is that answer.

## The short answer

Vinyl is a streaming engine, audio-first, and it handles video too. The media pipeline
is format-agnostic: the same queue, prefetch, and stall-detection machinery that powers
music playback on Amazon Music also drives video streams with AVC, HEVC, and VP9,
separate audio renditions, and even postroll ads.

But "handles video" and "is a video player" are different claims, and we only make the
first one.

## What audio-first means

Most of our engineering time goes to features that matter when sound is the product.
Gapless track transitions, since the HTML5 media element won't give you an inaudible
seam between tracks on its own. UHD audio up to 192 kHz, kept inside small
source-buffer quotas. Queues and prefetch are first-class concepts here, not
afterthoughts bolted onto an `<audio>` tag. And a sub-millisecond SAX parser for DASH
manifests, because the manifest is the hot path when you're chaining tracks.

Video teams care about a different list: player UI, captions workflows, ad decisioning,
quality ladders. Some of that exists in Vinyl's pipeline already. The parts that live in
full video players like shaka-player or video.js are the parts we deliberately leave to
them.

## Where video stands today

Concretely, here is what you get for video today. Playback of AVC, HEVC, and VP9
through the standard pipeline. Separate audio renditions, so track selection doesn't
assume audio and video arrive together. Postroll ad support in the playback lifecycle.
And the same error recovery, stall detection, and buffered-versus-fetched accounting
that audio playback gets, because it's the same engine.

What you don't get is a UI. MSE-based FairPlay is still
[open on the tracker](https://github.com/amazonmusic/vinyl/issues); it's on our roadmap,
not in your build.

## Try it

The fastest way to evaluate is to point Vinyl at a stream you actually care about:

```shell
npm install @amazon/vinyl
```

The [README](https://github.com/amazonmusic/vinyl) has quickstarts, and the docs cover
the queue and prefetch APIs in depth. If you find a video case it handles badly, open
an issue.
