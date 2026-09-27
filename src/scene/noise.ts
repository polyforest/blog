// Reusable lightweight noise utilities and time-driven signal helper.
// Provides 1D Perlin-like gradient noise, FBM, contrast mapping, and a stateful
// NoiseSignal that you can advance with update(dt) to get evolving values.
//
// Ported from polyforest/polyforest-web
// (https://github.com/polyforest/polyforest-web), branch main, commit
// fa689af4010fa136400c341580f38f26a51d00b3, file src/noise.ts. Upstream retains
// the canonical version; drift is accepted and documented in the scene
// background spec. The unused NoiseSignal helper is not ported.

export function fade(t: number) {
    // 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10)
}

export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

// Hash -> gradient in [-1, 1)
// Wang-style integer finalizer (with Math.imul for true 32-bit multiply):
// mixes ALL inputs uniformly. The previous xorshift variant degenerates for
// small lattice indices (x >>> 17 is 0 below 2^17, so low integers map to a
// near-monotone ramp — every low-frequency signal collapsed to a straight
// line) and its (x >>> 0) / 2147483647 scaling could exceed [-1, 1].
export function grad(i: number) {
    let x = i | 0
    x = x ^ 61 ^ (x >>> 16)
    x = (x + (x << 3)) | 0
    x = x ^ (x >>> 4)
    x = Math.imul(x, 0x27d4eb2d)
    x = x ^ (x >>> 15)
    return ((x >>> 0) / 4294967296) * 2 - 1
}

// Perlin-style 1D gradient noise in [-1,1]
export function noise1D(x: number): number {
    const i0 = Math.floor(x)
    const i1 = i0 + 1
    const t = x - i0
    const g0 = grad(i0)
    const g1 = grad(i1)
    const n0 = g0 * t
    const n1 = g1 * (t - 1)
    return lerp(n0, n1, fade(t)) * 2
}

// Fractal Brownian Motion: sum octaves of noise, output in [-1,1]
export function fbm1D(
    x: number,
    octaves = 3,
    lacunarity = 2,
    gain = 0.5,
): number {
    let amp = 1
    let freq = 1
    let sum = 0
    let norm = 0
    for (let o = 0; o < octaves; o++) {
        sum += noise1D(x * freq) * amp
        norm += amp
        amp *= gain
        freq *= lacunarity
    }
    return sum / (norm || 1)
}

/**
 * Map signed noise in [-1,1] to [0,1] with adjustable contrast.
 * Higher contrast pushes values closer to 0 and 1 more often.
 */
export function to01WithContrast(xSigned: number, contrast: number): number {
    const c = Math.max(0.0001, contrast)
    const y = Math.tanh(xSigned * c) / Math.tanh(c)
    return y * 0.5 + 0.5
}

export interface NoiseSignalOptions {
    /** Number of noise features per second */
    freq?: number
    /** Number of FBM octaves to sum together */
    octaves?: number
    /** Frequency multiplier between octaves */
    lacunarity?: number
    /** Amplitude multiplier between octaves */
    gain?: number
    /** Initial offset added to the noise input */
    phase?: number
}

export interface NoiseSignal {
    t: number
    update: (dt: number) => number // advances time and returns current signed value
    setTime: (t: number) => number // sets time and returns current signed value
    getSigned: () => number // [-1,1]
    get: (
        /** Overall amplitude scaling factor (default 1) */
        amp?: number,
    ) => number // [0,amp] + ampOffset
}

/**
 * Create a time-driven 1D FBM noise signal. Supports combining a slow and fast band
 * using provided amplitude weights. Call update(dt) each frame.
 */
export function createNoiseSignal(
    options: NoiseSignalOptions = {},
): NoiseSignal {
    // Slow band
    const freq = options.freq ?? 1
    const octaves = options.octaves ?? 3
    const lacunarity = options.lacunarity ?? 2
    const gain = options.gain ?? 0.5
    const phase = options.phase ?? 0

    let t = 0
    let lastSigned = 0

    function evalAt(time: number) {
        const x = phase + time * freq
        lastSigned = fbm1D(x, octaves, lacunarity, gain) // [-1,1]
    }

    function update(dt: number): number {
        t += dt
        evalAt(t)
        return lastSigned
    }

    function setTime(newT: number): number {
        t = newT
        evalAt(t)
        return lastSigned
    }

    function getSigned() {
        return lastSigned
    }

    function get(amp = 1) {
        return to01WithContrast(lastSigned, amp)
    }

    // Initialize at t=0
    evalAt(t)

    return { t, update, setTime, getSigned, get }
}
