---
title: "Obvious SF Event"
description: "Obvious AI San Francisco hackathon"
pubDate: 2026-09-26
updatedDate: 2026-09-26
author: "Nicholas Bilyk"
tags: [ "meta", "events", "ai" ]
draft: false
---

# Hackathon!

This was my first hackathon in more than 10 years. I generally avoid them because I think that it's easy to start
something that never gets finished, but it's hard to keep with an idea and make it all the way to production.

[Obvious AI](https://obvious.ai/) hosted a hackathon in San Francisco on September 24th, offering unlimited tokens for
the day. It wasn't far from my work, and I had been meaning to get out of my shell, rebuild my social network, and
generally keep up with new technologies.

I've been in the Bay Area since 2021, working at Amazon Music. Despite being here a while I haven't explored the city at
all. My life has been back and forth between San Francisco and Walnut Creek, balancing work and kids without any room
for socializing.

I walked to the venue, "House of AI" from the Bart. In my cloistered day to day I have a beautiful bike ride to the
Walnut Creek Bart station, and then to work it's just a 1-minute walk to the Amazon offices. This was a rare case where
I had to go outside my comfort zone and walk the streets of San Francisco.

It felt like I entered a war zone. San Francisco very suddenly took me through block after block of squalor and
homelessness. I grew up in a country setting, so I still get rather uncomfortable in an urban environment. I very nearly
turned around as my Google Maps directions took me down a narrow alley to get to this place I'd never heard of, "House
of AI."

In the distance I spotted a nerd (you can tell by their backpacks and hoodies.) "Are you here for the hackathon?" I say
somewhat desperately.

_Yes. I made it._

I'm glad I didn't turn around because the event was so much fun. The crowd was full of entrepreneurs, engineers, and
just generally curious people.

The event was a strange challenge, using the Obvious AI platform, who can spend the most tokens. The winner takes home a
bunch of free tokens to use on the platform. I'm generally against tokenmaxxing, and abhor metrics like "tokens spent,"
or "PRs pushed." However, this felt like a good opportunity to push the limits.

# Obvious AI Platform

My typical day-to-day agentic flow is an agent steering file that describes the workflow of coding. A supervisor agent
breaking down input tasks into lower level ones, defining dependencies, orchestrating subagents, performing adversarial
reviews, visual evidence with puppeteer, and then back to the supervisor for merging and jira updates. It's mostly
hands-off, it works well, and it's a pretty common setup amongst engineers. Places where I'd love to see my workflow
improved are making it trivial to set up for non-engineers, and ability to run it on a server, so I don't need my
laptop.

[Kiro Crew](https://kiro.dev/crew/) seems pretty good for some of this as well, but still a little nerdy in my opinion.

The premise of Obvious is to set up those workflows for you, give you a way to run your work in the cloud, and connect
to many integrations such as Slack, Jira, and GitHub.

The integrations and the workflow part of this worked pretty well for me. I was able to get going without a lot of
friction.

Overall the UX felt very clumsy to me. It _felt_ like it was built by an AI. I immediately tried making multiple
projects with the expectation that they stay isolated with the ability to switch back and forth between them. Instead,
switching was challenging, tasks inadvertently created new projects, and it seemed that there wasn't any isolation. I
could inadvertently do work on project A from project B, and it's painfully unclear which project I was working on.

My next biggest criticism was that the platform was incredibly slow. It would take over an hour for a simple task such
as "remove the Astro link from the footer." And I would see multipage planning documents to support the task.

Parts that worked well were the ability to have the workflow validate itself. The instance Obvious creates can take
snapshots of its own work, and visually validate before merging. It then does its own adversarial reviews directly on
GitHub, and in general I felt like it made few mistakes.
Because of the slow speed and UI clumsiness, it ended up a lot less hands-off than my typical workflow. I felt like a
middle manager prodding for status updates because the progress was never clear enough.

# Proof is in the pudding

Overall, I'm glad I went to the event and I got a lot out of it. I'm excited to see where they are going and how they
can improve the platform. While I wasn't impressed with the speed and usability, what it ultimately produced is
fantastic.

In one day:

- This blog. A literal one-shot "make me a blog that looks congruous with polyforest.com." While table stakes at this
  point, it did automatically set up the pipelines and get from A to Z without any manual intervention.
- Revitalizing https://polyforest.com/ and https://particles.polyforest.com/. These were pet projects of mine that have
  long since gone stale. Obvious fixed them up, updated PolyForest to use
  my [three-particles](https://github.com/polyforest/three-particles) library, and added some really cool new features
  to my particle editor. (I wouldn't recommend using my particle engine, don't expect me to maintain it.)

One thing I thought was very cool was that it actually figured out how to use the data format I made for three-particles,
and it made a handful of cool effects for it.

A huge thanks to the organizers! Hope to chat again soon.