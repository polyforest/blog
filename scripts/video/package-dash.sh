#!/usr/bin/env bash
# Encodes a 3-rung H.264 ABR ladder plus AAC audio and packages it as DASH
# with Shaka Packager into public/videos/<slug>/, ready for <pf-video>.
#
#   scripts/video/package-dash.sh <input> <slug> [--poster-at <sec>]
#
# Output (public/videos/<slug>/):
#   manifest.mpd                      static (VOD) DASH manifest, SegmentTemplate
#   video/<rung>/init.mp4, N.mp4      2 s fMP4 segments per rung
#   audio/init.mp4, N.mp4             2 s AAC segments
#   poster.jpg                        a still from --poster-at (default 3 s)
#
# Choices (see scripts/video/README.md for the reasoning):
#   - Ladder: 1920 / 1280 / 854 px wide, height from the source aspect
#     (rounded to even); rungs wider than the source are skipped.
#   - Source frame rate (up to 60) on every rung: particle motion is the
#     product, and one rate keeps quality switches seamless.
#   - x264 --tune animation, capped CRF: flat UI panels and sharp text get
#     the bits they need, static screens stay small, and maxrate bounds
#     each rung's DASH bandwidth.
#   - Closed GOP, a keyframe exactly every 2 s (no scenecut), so every rung
#     segments at identical boundaries.
set -euo pipefail

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"

for tool in ffmpeg ffprobe node; do
  command -v "$tool" >/dev/null || { echo "error: $tool is required (see scripts/video/README.md)" >&2; exit 1; }
done

# Shaka Packager ships as prebuilt binaries in the shaka-packager npm
# package. Run the binary directly: the package's node wrapper exits 0 even
# when packager fails.
packager="$(cd "$root" && node -e '
  const path = require("path")
  const names = {
    darwin: { x64: "packager-osx-x64", arm64: "packager-osx-arm64" },
    linux: { x64: "packager-linux-x64", arm64: "packager-linux-arm64" },
    win32: { x64: "packager-win-x64.exe" },
  }
  const name = (names[process.platform] || {})[process.arch]
  if (!name) process.exit(2)
  console.log(path.join(path.dirname(require.resolve("shaka-packager/package.json")), "bin", name))
' 2>/dev/null)" || { echo "error: shaka-packager missing; run npm install in the blog repo" >&2; exit 1; }
[[ -x "$packager" ]] || { echo "error: no Shaka Packager binary for this platform" >&2; exit 1; }

[[ $# -ge 2 ]] || usage
input="$1"; slug="$2"; shift 2
poster_at=3
while [[ $# -gt 0 ]]; do
  case "$1" in
    --poster-at) poster_at="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "error: unknown option $1" >&2; usage ;;
  esac
done
[[ -f "$input" ]] || { echo "error: input not found: $input" >&2; exit 1; }
[[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "error: slug must be lowercase letters, digits and dashes" >&2; exit 1; }

probe() { ffprobe -v error "$@" -of default=nw=1:nk=1 "$input"; }
src_w="$(probe -select_streams v:0 -show_entries stream=width)"
src_h="$(probe -select_streams v:0 -show_entries stream=height)"
[[ -n "$src_w" && -n "$src_h" ]] || { echo "error: no video stream in $input" >&2; exit 1; }
has_audio="$(probe -select_streams a:0 -show_entries stream=index | head -1)"
fps="$(probe -select_streams v:0 -show_entries stream=avg_frame_rate |
  awk -F/ '{ r = ($2 > 0) ? $1 / $2 : 30; if (r > 60) r = 60; if (r < 1) r = 30;
    n = int(r + 0.5); if (r - n < 0.1 && n - r < 0.1) r = n; printf "%g", r }')"
gop="$(awk -v f="$fps" 'BEGIN { printf "%d", f * 2 + 0.5 }')"

out="$root/public/videos/$slug"
rm -rf "$out"
mkdir -p "$out"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# name width crf maxrate(kbit/s) — maxrate sized for 60 fps screen content.
ladder=(
  "1080p 1920 20 6000"
  "720p 1280 21 3500"
  "480p 854 23 1600"
)

streams=()
summary=()
for rung in "${ladder[@]}"; do
  read -r name w crf maxrate <<<"$rung"
  if (( w > src_w )); then
    echo "skip $name: source is only ${src_w}px wide"
    continue
  fi
  h="$(awk -v sw="$src_w" -v sh="$src_h" -v w="$w" 'BEGIN { h = int(w * sh / sw / 2 + 0.5) * 2; print h }')"
  echo "encoding $name (${w}x${h} @ ${fps} fps, crf $crf, max ${maxrate}k)"
  ffmpeg -hide_banner -loglevel error -stats -y -i "$input" -map 0:v:0 -an \
    -vf "fps=${fps},scale=${w}:${h}:flags=lanczos,setsar=1,format=yuv420p" \
    -c:v libx264 -preset slow -tune animation -profile:v high \
    -crf "$crf" -maxrate "${maxrate}k" -bufsize "$((maxrate * 2))k" \
    -x264-params "keyint=${gop}:min-keyint=${gop}:scenecut=0:open-gop=0" \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    "$work/$name.mp4"
  streams+=("in=$work/$name.mp4,stream=video,init_segment=$out/video/$name/init.mp4,segment_template=$out/video/$name/\$Number\$.mp4")
  summary+=("$name ${w}x${h}")
done
(( ${#streams[@]} > 0 )) || { echo "error: source smaller than every rung" >&2; exit 1; }

if [[ -n "$has_audio" ]]; then
  echo "encoding audio (AAC-LC 128k stereo)"
  ffmpeg -hide_banner -loglevel error -y -i "$input" -map 0:a:0 -vn \
    -c:a aac -b:a 128k -ac 2 -ar 48000 "$work/audio.mp4"
  streams+=("in=$work/audio.mp4,stream=audio,init_segment=$out/audio/init.mp4,segment_template=$out/audio/\$Number\$.mp4")
fi

echo "packaging DASH"
"$packager" "${streams[@]}" \
  --segment_duration 2 \
  --generate_static_live_mpd \
  --mpd_output "$out/manifest.mpd" \
  --quiet
# Shaka writes absolute segment paths when given absolute outputs; make the
# manifest relative so the folder can be served from any URL.
sed -i.bak "s#$out/##g" "$out/manifest.mpd" && rm "$out/manifest.mpd.bak"

ffmpeg -hide_banner -loglevel error -y -ss "$poster_at" -i "$input" -frames:v 1 \
  -vf "scale='min(1920,iw)':-2:flags=lanczos" -q:v 3 "$out/poster.jpg"

poster_w="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nw=1:nk=1 "$out/poster.jpg")"
poster_h="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$out/poster.jpg")"

echo
echo "Packaged $slug -> public/videos/$slug/ ($(du -sh "$out" | cut -f1), $(find "$out" -type f | wc -l | tr -d ' ') files)"
for s in "${summary[@]}"; do echo "  video $s"; done
[[ -n "$has_audio" ]] && echo "  audio AAC 128k"
echo
echo "Embed it in a post:"
echo "  <pf-video src=\"/videos/$slug/manifest.mpd\" poster=\"/videos/$slug/poster.jpg\" aspect=\"$poster_w/$poster_h\" title=\"...\"></pf-video>"
