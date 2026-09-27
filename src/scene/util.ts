/**
 * Ported from polyforest/polyforest-web
 * (https://github.com/polyforest/polyforest-web), branch main, commit
 * fa689af4010fa136400c341580f38f26a51d00b3, file src/util.ts. Upstream retains
 * the canonical version; drift is accepted and documented in the scene
 * background spec. Only the subset the ambient scene uses was ported; the
 * urlParams/isDebug plumbing is intentionally dropped.
 */

/**
 * Applies a pow2 ease out on the given alpha.
 * This will be fast at first and slow down.
 */
export function easeOut(alpha: number): number {
    return 1 - (1 - alpha) * (1 - alpha)
}

/**
 * fast - slow - fast
 */
export function easeOutIn(alpha: number): number {
    return signedSquare((alpha - 0.5) * 2) * 0.5 + 0.5
}

/**
 * Squared, and if the number is negative, the output is negative.
 */
function signedSquare(x: number): number {
    return x < 0 ? x * -x : x * x
}

/**
 * Repeat array items n times.
 */
export function repeatArr<T>(arr: T[], n: number): T[] {
    const out = new Array<T>(arr.length * n)
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < arr.length; j++) {
            out[i * arr.length + j] = arr[j]
        }
    }
    return out
}

export function smoothstep(edge0: number, edge1: number, x: number) {
    // Scale, bias and clamp x to 0..1 range
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
}
