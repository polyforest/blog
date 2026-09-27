// Ported from polyforest/polyforest-web
// (https://github.com/polyforest/polyforest-web), branch main, commit
// fa689af4010fa136400c341580f38f26a51d00b3, file src/rand.ts. Upstream retains
// the canonical version; drift is accepted and documented in the scene
// background spec. The seed (232) and draw order matter: the ambient scene
// creates the fire before the forest, matching mainScene.ts upstream.
import { Color } from 'three'
import { easeOutIn } from './util'
import { createPrng } from './prng'

export const rng = createPrng(232)

/**
 * @param color {Color}
 * @param delta {number}
 * @return {Color}
 */
export function jiggleColor(color: Color, delta = 0.1): Color {
    return new Color(
        color.r + rng.nextFloat(-delta, delta),
        color.g + rng.nextFloat(-delta, delta),
        color.b + rng.nextFloat(-delta, delta),
    )
}

/**
 * @template T
 * @param arr {T[]}
 * @return {T}
 */
export function pickRandom<T>(arr: T[]): T {
    const index = rng.nextInt(0, arr.length)
    return arr[index]
}

/**
 * Returns a random number between min and max (exclusive), weighted towards the
 * middle.
 *
 * @param min {number}
 * @param max {number}
 * @return number
 */
export function bellRandom(min: number, max: number) {
    return easeOutIn(rng.nextFloat()) * (max - min) + min
}

/**
 * Returns a random number between min and max (exclusive), weighted towards the
 * middle and floored.
 *
 * @param min {number}
 * @param max {number}
 * @return number
 */
export function bellRandomInt(min: number, max: number) {
    return Math.floor(easeOutIn(rng.nextFloat()) * (max - min) + min)
}
