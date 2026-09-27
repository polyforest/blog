# Videos in posts

Screen recordings become adaptive DASH streams in `public/videos/<slug>/`,
played in posts by the `<pf-video>` element
(`src/components/video/pf-video.ts`, built on
[@amazon/vinyl](https://amazonmusic.github.io/vinyl/)).

## Adding a video

```shell
npm install                                   # once: resvg + shaka-packager
scripts/video/edit-demo.sh recording.mov /tmp/edited.mp4 --ff-start 23 --ff-end 76
scripts/video/package-dash.sh /tmp/edited.mp4 my-video --poster-at 50
```

`package-dash.sh` prints the snippet to paste into the post:

```html
<pf-video src="/videos/my-video/manifest.mpd" poster="/videos/my-video/poster.jpg"
          aspect="1920/1108" title="What the video shows"></pf-video>
```

Skip `edit-demo.sh` if the recording needs no edit. Keep the edited mp4 out of
the repo; only `public/videos/<slug>/` is committed.

Requirements: `ffmpeg`/`ffprobe` (`brew install ffmpeg`), Node, and Python 3.
Shaka Packager comes from the `shaka-packager` npm package (Google's prebuilt
binaries), so there's nothing else to install.

## The scripts

### `edit-demo.sh <input> <output> [options]`

- Plays normally, then speeds up `--ff-start`→`--ff-end` (source seconds) by
  `--ff-speed` (default 23→76 at 4×), then plays normally again.
- Shows a "⏩ 4× speed" pill at the bottom center while fast-forwarding. The
  default Homebrew ffmpeg has no `drawtext`, so `render-badge.mjs` draws the
  pill as SVG with the blog's Scope One font (via `@resvg/resvg-js`) and
  ffmpeg overlays the PNG. No extra ffmpeg build needed, and it renders the
  same everywhere.
- Converts variable frame rate recordings to constant first (source rate,
  capped at 60), so the cut points and badge timing are exact.
- Audio: the recording's own audio is dropped during the fast-forward
  (4× narration is noise) and the music carries that section. Elsewhere the
  music ducks under the recording's audio with a sidechain compressor. With
  no source audio, the music is the only track.
- `--music <file>` uses your own track. Without it, `make-music.py` generates
  a placeholder bed. Swap in a licensed track for anything you care about.
- Output is a high-quality mezzanine (H.264 CRF 16, AAC 256k).

### `make-music.py [--duration S] <out.wav>`

A soft, seeded, standard-library-only music bed: a pad progression, sub bass,
a plucked arpeggio and a light pulse that enters after the intro. It renders
one seamless 8-bar loop and arranges it to length (a few seconds of CPU per
minute).

### `package-dash.sh <input> <slug> [--poster-at S]`

- **Ladder:** 1920, 1280 and 854 px wide. Height follows the source aspect,
  so there's no letterboxing, and rungs wider than the source are skipped.
- **Frame rate:** the source rate (60 for screen captures) on every rung.
  Particle motion is what the demos show, and one rate keeps quality switches
  seamless. Static UI costs almost nothing at 60 fps.
- **Encoding:** x264 `--tune animation` with a capped CRF (1080p CRF 20 / max
  6 Mbps, 720p 21 / 3.5, 480p 23 / 1.6). Animation tuning suits flat UI
  panels and sharp text; `stillimage` would smear the particles. Capped CRF
  keeps static screens small while `maxrate` bounds each rung's bandwidth.
- **GOP:** a closed GOP with a keyframe every 2 s and scene cuts off, so every
  rung cuts at the same 2 s boundaries.
- **Packaging:** Shaka Packager writes a static (VOD) MPD with
  `SegmentTemplate`/`SegmentTimeline` and one file per 2 s segment. Plain
  files work on any static host and with any cache, with no byte-range
  support needed.
- **Segment names:** segments use the `.mp4` extension, not `.m4s`, so every
  host serves them as `video/mp4`. The player fetches them as raw bytes
  anyway.
- **Size:** about 12–13 MB per minute of screen recording for all rungs
  together (the first video: 17 MB for 81 s).

## The player

`<pf-video>` has play/pause, a scrub bar showing the fetched range, time,
volume, a quality menu (Auto or a cap at 1080p/720p/480p, via Vinyl's
`abr.maxHeight` like the Vinyl website), fullscreen, a stall spinner and
keyboard control (Space/K, ←/→ ±5 s, ↑/↓ volume, M, F).

- Vinyl loads only when a player nears the viewport, and the stream loads on
  first play.
- Browsers without Media Source Extensions show a message instead.
- Several players per page work independently, and each disposes its player
  when removed.

The box uses `aspect`, else the poster's size, else the video's.

Drafts (`draft: true`) render in `npm run dev` at `/<slug>/`, so posts with
videos can be previewed. Builds never include them.
