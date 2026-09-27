---
title: "AI Mode in the Particle Editor"
description: "The PolyForest Particle Editor now has an AI assistant that can build and edit effects with you."
pubDate: 2026-09-27
author: "Nicholas Bilyk"
tags: [ "particles", "ai", "threejs" ]
draft: false
---

The [PolyForest Particle Editor](https://particles.polyforest.com/) has a new AI mode! Open the chat, describe the
effect you want, and the assistant edits it while you watch the preview.

The PolyForest Particle editor is a web app I wrote many years ago that you've never heard of. Originally it was a tool
for a Kotlin multiplatform OpenGL/WebGL framework I wrote in 2016. While that's been long abandoned, I recently ported
both the [polyforest.com](https://polyforest.com) website and the editor to [Three.js](https://threejs.org).

While I can honestly not promise that I'll keep this editor maintained, as it's just a hobby side project, the more
users it gets the more incentive I have to make it awesome.

In gen AI, creating effects by hand suddenly felt tedious and time-consuming. To make this easier, I created an AI
assistant that works with Anthropic or OpenAI keys. The editor uses
the [three-particles](https://github.com/polyforest/three-particles) runtime library. This library is
also a port from the Kotlin version of long past.

<pf-video src="/videos/particles-ai-preview/manifest.mpd" poster="/videos/particles-ai-preview/poster.jpg" aspect="
1920/1108" title="AI mode in the particle editor"></pf-video>

## Bring your own key

AI mode works with your own Anthropic or OpenAI API key. Add it under **AI Assistant** in the account menu. The key is
checked with the provider, then encrypted and stored on the server. It is never sent back to the browser, and you can
remove it at any time.

## It knows what you're looking at

The chat panel docks beside the preview, so the effect stays visible as it changes. The assistant sees the effect you
have open, so a request like "fade the flame to blue" applies to the flame in front of you.

## What it can do

The assistant works through the same operations as the editor:

- create, duplicate, rename and delete effects
- add and edit emitters and their timelines
- set up materials and geometry
- draw new textures and add them to your texture library

Each step shows up in the chat as it happens.



_____________________________

_Plug: the video playback engine in this blog is [Amazon Vinyl](https://amazonmusic.github.io/vinyl/)_ 

_Screen recording background music by Suno_

_Blog written content by human hands, views expressed are my own_

_____________________________

