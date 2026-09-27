import {
    type Material,
    type Mesh,
    Mesh as ThreeMesh,
    PlaneGeometry,
} from 'three'

// Ported from polyforest/polyforest-web
// (https://github.com/polyforest/polyforest-web), branch main, commit
// fa689af4010fa136400c341580f38f26a51d00b3, file src/terrain.ts. Upstream
// retains the canonical version; drift is accepted and documented in the scene
// background spec.

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
}

/**
 * Deterministic lattice hash in [-1, 1] for 2D value noise.
 */
function hash2(ix: number, iz: number): number {
    const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453
    return (s - Math.floor(s)) * 2 - 1
}

/**
 * Smooth 2D value noise (bilinear lattice, cubic-smoothed).
 */
function valueNoise2(x: number, z: number): number {
    const ix = Math.floor(x)
    const iz = Math.floor(z)
    const fx = x - ix
    const fz = z - iz
    const ux = fx * fx * (3 - 2 * fx)
    const uz = fz * fz * (3 - 2 * fz)
    const a = hash2(ix, iz)
    const b = hash2(ix + 1, iz)
    const c = hash2(ix, iz + 1)
    const d = hash2(ix + 1, iz + 1)
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

function fbm2(x: number, z: number, octaves: number): number {
    let sum = 0
    let amp = 1
    let freq = 1
    let norm = 0
    for (let i = 0; i < octaves; i++) {
        sum += amp * valueNoise2(x * freq, z * freq)
        norm += amp
        amp *= 0.5
        freq *= 2.1
    }
    return sum / norm
}

/** Height of the water surface; the coastline is where terrain crosses it. */
export const WATER_LEVEL = -0.5

/**
 * Coastline radius at bearing theta: the base radius modulated by
 * low-frequency angular noise sampled on a circle (seamless at +/-pi) plus
 * two sine harmonics — organic bays and peninsulas, never a square edge.
 * Pure, so terrain, forest, and decor agree on where the shore sits.
 */
export function shoreRadius(theta: number, islandRadius: number): number {
    const base = islandRadius * 0.7
    const lobes = fbm2(
        Math.cos(theta) * 1.35 + 7.7,
        Math.sin(theta) * 1.35 + 3.1,
        3,
    )
    return (
        base *
        (1 +
            0.2 * lobes +
            0.09 * Math.sin(theta * 3 + 1.3) +
            0.06 * Math.sin(theta * 7 - 2.1))
    )
}

/**
 * Terrain height at (x, z): an island — the level campfire clearing rises
 * into broad swells toward the interior, then the land falls below the
 * water line at an organic coastline and stays submerged outside it.
 * Pure, so terrain mesh, forest, and any decor all sample the same ground.
 */
export function terrainHeight(x: number, z: number, islandRadius = 30): number {
    const dist = Math.hypot(x, z)
    const theta = Math.atan2(z, x)
    const t = dist / shoreRadius(theta, islandRadius) // 1 at the coastline

    // The campfire pad: flat inside ~2.6 m, fully island-shaped beyond ~9 m.
    const pad = smoothstep(2.6, 9, dist)

    // Broad interior swells — unmistakable relief, no jagged peaks.
    const swellBand = smoothstep(0.06, 0.3, t) * (1 - smoothstep(0.6, 0.95, t))
    const swell =
        swellBand * (1.9 + 1.9 * fbm2(x * 0.05 + 11.3, z * 0.05 + 3.7, 3))

    // Gentle secondary rolling so the hills read in motion.
    const detail =
        0.4 *
        fbm2(x * 0.2 + 5.1, z * 0.2 + 9.4, 2) *
        (1 - smoothstep(0.75, 0.95, t))

    // The shore: land falls below WATER_LEVEL and stays there, so no plane
    // boundary is visible above or through the water.
    const coastal = 1.7 * smoothstep(0.74, 1.1, t)

    return pad * (swell + detail - coastal)
}

/**
 * The water surface: a large plane at WATER_LEVEL extending far beyond the
 * island so fog, not a geometry edge, ends the view.
 */
export function createWaterMesh(size: number, material: Material): Mesh {
    const geometry = new PlaneGeometry(size, size)
    geometry.rotateX(-Math.PI / 2)
    const mesh = new ThreeMesh(geometry, material)
    mesh.position.y = WATER_LEVEL
    return mesh
}

/**
 * The island ground: a dense plane displaced by terrainHeight, with
 * recomputed normals so lighting and fog read the new relief. The plane
 * extends past the coastline everywhere, so its boundary lies underwater.
 */
export function createTerrainMesh(radius: number, material: Material): Mesh {
    const geometry = new PlaneGeometry(radius * 2, radius * 2, 160, 160)
    geometry.rotateX(-Math.PI / 2)
    const pos = geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
        pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i), radius))
    }
    geometry.computeVertexNormals()

    const mesh = new ThreeMesh(geometry, material)
    mesh.receiveShadow = true
    return mesh
}
