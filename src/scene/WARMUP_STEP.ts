/**
 * Shared warmup constants for the campfire simulation.
 *
 * A frozen frame at simulation t=0 shows a sparse, half-lit fire; four virtual
 * seconds in fixed 1/60 steps lands the particle effect and the light in their
 * steady state before the first visible frame.
 *
 * Ported from polyforest/polyforest-web
 * (https://github.com/polyforest/polyforest-web), branch main, commit
 * fa689af4010fa136400c341580f38f26a51d00b3, where the same values live inline
 * in src/mainScene.ts.
 */
export const WARMUP_SECONDS = 4
export const WARMUP_STEP = 1 / 60
