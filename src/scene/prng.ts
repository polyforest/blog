// Simple deterministic PRNG (Mulberry32)
//
// Ported from polyforest/polyforest-web
// (https://github.com/polyforest/polyforest-web), branch main, commit
// fa689af4010fa136400c341580f38f26a51d00b3, file src/prng.ts. Upstream retains
// the canonical version; drift is accepted and documented in the scene
// background spec.

export interface Prng {
    next: () => number
    nextFloat: (min?: number, max?: number) => number
    nextInt: (min: number, max: number) => number
}

/**
 * Create a deterministic pseudo-random number generator based on Mulberry32.
 */
export function createPrng(seed: number): Prng {
    let t = seed >>> 0
    function next(): number {
        // mulberry32
        t += 0x6d2b79f5
        let r = Math.imul(t ^ (t >>> 15), 1 | t)
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
    return {
        next,
        nextFloat(min?: number, max?: number): number {
            const u = next()
            if (min === undefined) return u
            if (max === undefined) return u * min // treat single arg as scale
            return u * (max - min) + min
        },
        nextInt(min: number, max: number): number {
            // integer in [min, max)
            return Math.floor(next() * (max - min) + min)
        },
    }
}
