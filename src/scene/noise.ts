// Reusable lightweight noise utilities: 1D Perlin-like gradient noise, FBM,
// and contrast mapping.
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
