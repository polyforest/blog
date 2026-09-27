#!/usr/bin/env bash
# Light edit for a screen-recorded demo: fast-forwards one section with an
# on-screen "4× speed" badge and mixes in a background music bed.
#
#   scripts/video/edit-demo.sh <input> <output.mp4> [options]
#
# Options:
#   --music <file>     Music bed (any format ffmpeg reads). Default: a bed
#                      synthesized by make-music.py to fit the edit.
#   --ff-start <sec>   Where fast-forward starts, in source time (default 23).
#   --ff-end <sec>     Where it ends, in source time (default 76).
#   --ff-speed <n>     Speed-up factor (default 4).
#   --music-gain <n>   Music level, linear (default 0.5; ducked under speech).
#   --fps <n>          Output frame rate (default: the source's, capped at 60).
#
# During the fast-forward the recording's own audio is dropped (sped-up
# narration is unintelligible); the music carries that section. Everywhere
# else the music ducks under the original audio.
#
# The output is a high-quality mezzanine (H.264 CRF 16, AAC 256k) meant as
# input to package-dash.sh.
set -euo pipefail

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for tool in ffmpeg ffprobe node python3; do
  command -v "$tool" >/dev/null || { echo "error: $tool is required (see scripts/video/README.md)" >&2; exit 1; }
done
[[ -d "$here/../../node_modules/@resvg/resvg-js" ]] || {
  echo "error: run npm install in the blog repo first (needs @resvg/resvg-js)" >&2; exit 1; }

[[ $# -ge 2 ]] || usage
input="$1"; output="$2"; shift 2
music=""; ff_start=23; ff_end=76; ff_speed=4; music_gain=0.5; fps=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --music) music="$2"; shift 2 ;;
    --ff-start) ff_start="$2"; shift 2 ;;
    --ff-end) ff_end="$2"; shift 2 ;;
    --ff-speed) ff_speed="$2"; shift 2 ;;
    --music-gain) music_gain="$2"; shift 2 ;;
    --fps) fps="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "error: unknown option $1" >&2; usage ;;
  esac
done
[[ -f "$input" ]] || { echo "error: input not found: $input" >&2; exit 1; }

probe() { ffprobe -v error "$@" -of default=nw=1:nk=1 "$input"; }
duration="$(probe -show_entries format=duration)"
width="$(probe -select_streams v:0 -show_entries stream=width)"
height="$(probe -select_streams v:0 -show_entries stream=height)"
[[ -n "$width" && -n "$height" ]] || { echo "error: no video stream in $input" >&2; exit 1; }
has_audio="$(probe -select_streams a:0 -show_entries stream=index | head -1)"
if [[ -z "$fps" ]]; then
  # avg_frame_rate is right for both constant and variable frame rate
  # recordings; snap near-integer rates (a VFR capture averaging 59.99 -> 60)
  # and cap screen-capture oddities like 1000/1.
  fps="$(probe -select_streams v:0 -show_entries stream=avg_frame_rate |
    awk -F/ '{ r = ($2 > 0) ? $1 / $2 : 30; if (r > 60) r = 60; if (r < 1) r = 30;
      n = int(r + 0.5); if (r - n < 0.1 && n - r < 0.1) r = n; printf "%g", r }')"
fi

read -r out_duration ff_out_end <<<"$(awk -v d="$duration" -v a="$ff_start" -v b="$ff_end" -v s="$ff_speed" '
  BEGIN {
    if (!(a >= 0 && b > a && b <= d && s > 1)) { print "invalid"; exit }
    printf "%.3f %.3f\n", d - (b - a) + (b - a) / s, a + (b - a) / s
  }')"
[[ "$out_duration" != invalid ]] || {
  echo "error: need 0 <= ff-start < ff-end <= duration ($duration) and ff-speed > 1" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Badge: about 6.5% of the frame height, rendered to a transparent PNG. It
# sits 11% up from the bottom so a player's overlaid controls don't hide it.
badge_h="$(awk -v h="$height" 'BEGIN { printf "%d", h * 0.065 }')"
margin="$(awk -v h="$height" 'BEGIN { printf "%d", h * 0.11 }')"
speed_label="$(awk -v s="$ff_speed" 'BEGIN { printf "%g", s }')× speed"
node "$here/render-badge.mjs" "$work/badge.png" "$badge_h" "$speed_label"

if [[ -z "$music" ]]; then
  music="$work/music.wav"
  python3 "$here/make-music.py" --duration "$out_duration" "$music"
fi

fade_out_start="$(awk -v d="$out_duration" 'BEGIN { printf "%.3f", (d > 6) ? d - 3 : d / 2 }')"
ff_len_out="$(awk -v a="$ff_start" -v b="$ff_end" -v s="$ff_speed" 'BEGIN { printf "%.3f", (b - a) / s }')"

# Normalize to constant frame rate first: screen recordings are often VFR,
# and a CFR timeline makes the trim/setpts math and the badge timing exact.
video_graph="
[0:v]fps=${fps},split=3[v0][v1][v2];
[v0]trim=0:${ff_start},setpts=PTS-STARTPTS[va];
[v1]trim=${ff_start}:${ff_end},setpts=(PTS-STARTPTS)/${ff_speed}[vb];
[v2]trim=start=${ff_end},setpts=PTS-STARTPTS[vc];
[va][vb][vc]concat=n=3:v=1:a=0,fps=${fps},format=yuv420p[vcat];
[vcat][2:v]overlay=x=(W-w)/2:y=H-h-${margin}:enable='between(t,${ff_start},${ff_out_end})'[vout]"

music_chain="[1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${out_duration},asetpts=PTS-STARTPTS,volume=${music_gain},afade=t=in:d=1.5,afade=t=out:st=${fade_out_start}:d=3"

if [[ -n "$has_audio" ]]; then
  audio_graph="
[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[a0][a2];
[a0]atrim=0:${ff_start},asetpts=PTS-STARTPTS[aa];
anullsrc=r=48000:cl=stereo,atrim=0:${ff_len_out}[ab];
[a2]atrim=start=${ff_end},asetpts=PTS-STARTPTS[ac];
[aa][ab][ac]concat=n=3:v=0:a=1,asplit=2[orig][side];
${music_chain}[bed];
[bed][side]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[ducked];
[orig][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]"
else
  audio_graph="
${music_chain},alimiter=limit=0.95[aout]"
fi

ffmpeg -hide_banner -loglevel warning -stats -y \
  -i "$input" -i "$music" -loop 1 -i "$work/badge.png" \
  -filter_complex "${video_graph};${audio_graph}" \
  -map '[vout]' -map '[aout]' \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 \
  -t "$out_duration" -movflags +faststart \
  "$output"

echo "Edited: $output"
echo "  source ${duration}s -> ${out_duration}s at ${fps} fps; ${ff_speed}x from ${ff_start}s to ${ff_end}s (output ${ff_start}s-${ff_out_end}s)"
