#!/usr/bin/env python3
"""Synthesize a soft, royalty-free demo music bed (stdlib only).

    python3 scripts/video/make-music.py --duration 90 music.wav

Renders one seamless 8-bar loop (pad, sub bass, plucked arpeggio) plus a
light pulse layer, then arranges them to the requested duration:
intro without the pulse, the body with it, and a fade out. The random
seed is fixed, so the output is identical on every run.

This is a placeholder bed; pass a licensed track to edit-demo.sh with
--music to use real music instead.
"""

import argparse
import math
import random
import struct
import sys
import wave

RATE = 44100
BPM = 92
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BARS_PER_CHORD = 2

# Dmaj7 - Bm7 - Gmaj7 - Asus2, as MIDI notes (pad voicing, arp tones, bass root).
PROGRESSION = [
    {'pad': [50, 54, 57, 61], 'arp': [62, 66, 69, 73], 'root': 38},
    {'pad': [47, 50, 54, 57], 'arp': [59, 62, 66, 69], 'root': 35},
    {'pad': [43, 47, 50, 54], 'arp': [62, 67, 71, 74], 'root': 31},
    {'pad': [45, 47, 52, 57], 'arp': [64, 69, 71, 76], 'root': 33},
]
ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def loop_length():
    return int(round(len(PROGRESSION) * BARS_PER_CHORD * BAR * RATE))


def add_tone(buf_l, buf_r, start, dur, freq, amp, attack, release, pan,
             detune_cents=0.0, harmonics=((1, 1.0),), decay=None):
    """Adds a sine-based note into circular stereo buffers (wraps at the end,
    so tails spill into the loop's start and the loop repeats seamlessly)."""
    n = len(buf_l)
    total = int((dur + release) * RATE)
    a_len = max(1, int(attack * RATE))
    sustain_end = int(dur * RATE)
    r_len = max(1, int(release * RATE))
    gl = amp * math.cos(pan * math.pi / 2)
    gr = amp * math.sin(pan * math.pi / 2)
    f = freq * 2 ** (detune_cents / 1200)
    incs = [2 * math.pi * f * h / RATE for h, _ in harmonics]
    weights = [w for _, w in harmonics]
    phases = [random.random() * 2 * math.pi for _ in harmonics]
    k = 1.0 / (decay * RATE) if decay else 0.0
    s0 = int(start * RATE)
    sin = math.sin
    exp = math.exp
    for i in range(total):
        if i < a_len:
            env = i / a_len
        elif i < sustain_end:
            env = 1.0
        else:
            env = max(0.0, 1.0 - (i - sustain_end) / r_len)
        if k:
            env *= exp(-i * k)
        v = 0.0
        for j in range(len(incs)):
            v += weights[j] * sin(phases[j] + incs[j] * i)
        v *= env
        idx = (s0 + i) % n
        buf_l[idx] += v * gl
        buf_r[idx] += v * gr


def render_music_loop():
    n = loop_length()
    l = [0.0] * n
    r = [0.0] * n
    chord_len = BARS_PER_CHORD * BAR
    for ci, chord in enumerate(PROGRESSION):
        t0 = ci * chord_len
        # Pad: two detuned voices per note, spread left/right, slow swell.
        for note in chord['pad']:
            f = hz(note)
            for detune, pan in ((-6, 0.3), (6, 0.7)):
                add_tone(l, r, t0, chord_len, f, 0.035, 0.9, 1.4, pan,
                         detune, ((1, 1.0), (2, 0.12)))
        # Sub bass: the root on beats 1 and 3, round and quiet.
        for b in range(BARS_PER_CHORD * 2):
            add_tone(l, r, t0 + b * 2 * BEAT, 1.6 * BEAT, hz(chord['root']),
                     0.10, 0.02, 0.25, 0.5, harmonics=((1, 1.0), (2, 0.2)))
        # Plucked arpeggio in eighth notes, slightly humanized.
        steps = int(chord_len / (BEAT / 2))
        for s in range(steps):
            note = chord['arp'][ARP_ORDER[s % len(ARP_ORDER)]]
            vel = 0.045 + random.uniform(-0.01, 0.01)
            if s % 4 == 0:
                vel *= 1.25
            jitter = random.uniform(-0.006, 0.006)
            pan = 0.35 if s % 2 == 0 else 0.65
            add_tone(l, r, t0 + s * BEAT / 2 + jitter, 0.05, hz(note), vel,
                     0.004, 0.5, pan, harmonics=((1, 1.0), (2, 0.35), (3, 0.08)),
                     decay=0.28)
    return l, r


def render_pulse_loop():
    """A soft kick on every beat plus a hushed offbeat tick."""
    n = loop_length()
    l = [0.0] * n
    r = [0.0] * n
    beats = int(round(n / (BEAT * RATE)))
    kick_len = int(0.3 * RATE)
    tick_len = int(0.05 * RATE)
    for b in range(beats):
        s0 = int(b * BEAT * RATE)
        amp = 0.16 if b % 2 == 0 else 0.10
        phase = 0.0
        for i in range(kick_len):
            t = i / RATE
            f = 48 + 70 * math.exp(-t * 28)
            phase += 2 * math.pi * f / RATE
            v = amp * math.sin(phase) * math.exp(-t * 11)
            idx = (s0 + i) % n
            l[idx] += v
            r[idx] += v
        # Offbeat tick: band-limited noise (a moving average tames the fizz).
        s1 = int((b + 0.5) * BEAT * RATE)
        prev = 0.0
        for i in range(tick_len):
            noise = random.uniform(-1, 1)
            prev = prev * 0.55 + noise * 0.45
            hp = noise - prev
            v = 0.012 * hp * math.exp(-i / (0.012 * RATE))
            idx = (s1 + i) % n
            l[idx] += v * 0.8
            r[idx] += v * 1.2
    return l, r


def lowpass(buf, alpha):
    """One-pole low-pass. The first pass only warms the filter state up so the
    written second pass starts where the loop ends, and the loop wraps
    without a click."""
    y = 0.0
    for write in (False, True):
        for i in range(len(buf)):
            y += alpha * (buf[i] - y)
            if write:
                buf[i] = y
    return buf


def soft_clip(x):
    return math.tanh(x * 1.2) / math.tanh(1.2)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('out', help='output .wav path')
    parser.add_argument('--duration', type=float, default=120.0,
                        help='length in seconds (default 120)')
    args = parser.parse_args()
    if args.duration <= 0:
        sys.exit('--duration must be positive')

    random.seed(20260927)
    music_l, music_r = render_music_loop()
    pulse_l, pulse_r = render_pulse_loop()
    for buf in (music_l, music_r):
        lowpass(buf, 0.35)

    n_loop = len(music_l)
    total = int(args.duration * RATE)
    intro = n_loop if total > 2 * n_loop else 0
    fade_in = int(1.5 * RATE)
    fade_out = int(min(4.0, args.duration / 4) * RATE)
    pulse_ramp = int(2 * BAR * RATE)

    frames = bytearray()
    for i in range(total):
        j = i % n_loop
        # The pulse enters after the intro loop, ramping in over two bars.
        p = 0.0 if i < intro else min(1.0, (i - intro) / pulse_ramp)
        g = 1.0
        if i < fade_in:
            g = i / fade_in
        if i > total - fade_out:
            g = min(g, (total - i) / fade_out)
        vl = soft_clip((music_l[j] + p * pulse_l[j]) * g)
        vr = soft_clip((music_r[j] + p * pulse_r[j]) * g)
        frames += struct.pack('<hh', int(vl * 32000), int(vr * 32000))

    with wave.open(args.out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(frames))
    print(f'wrote {args.out}: {args.duration:.1f}s, loop {n_loop / RATE:.2f}s')


if __name__ == '__main__':
    main()
