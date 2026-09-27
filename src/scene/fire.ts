// Ported from polyforest/polyforest-web
// (https://github.com/polyforest/polyforest-web), branch main, commit
// fa689af4010fa136400c341580f38f26a51d00b3, file src/fire.ts. Upstream retains
// the canonical version; drift is accepted and documented in the scene
// background spec. Local changes: asset paths point at the blog's
// /assets/scene/ copies, and the ?liteshadows capture affordance is dropped
// (the 2048 shadow map is always used).
import {
    AdditiveBlending,
    CanvasTexture,
    Color,
    CircleGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    PointLight,
    ShaderMaterial,
    SphereGeometry,
    TextureLoader,
    Vector3,
    Texture,
    PerspectiveCamera,
} from 'three'
import { fbm1D, lerp, to01WithContrast } from './noise'
import { smoothstep } from './util'
import { ParticleEffect, ParticleEffectLoader } from 'three-particles'
import { rng } from './rand'

export interface FireController {
    light: PointLight
    update: (dt: number, camera: PerspectiveCamera) => void
    group: Group
}

// Tunable parameters for the campfire look.
const config = {
    // Color temperature: a gentle drift between two nearby warm oranges —
    // enough range to read as living fire, tight enough that the tint never
    // dominates the scene (feedback: the earlier deep-ember → bright-amber
    // swing changed color too much).
    lightColorLow: 0xff8237,
    lightColorHigh: 0xffa45a,
    // Intensity: small smooth excursions around a base — subtle and
    // continuous, never dipping toward dark.
    lightBaseIntensity: 8.5,
    lightBreathIntensity: 1.6, // slow breathing amplitude (fireEnvelope)
    lightNoiseIntensity: 0.7, // continuous wind-noise amplitude
    lightGustIntensity: 1.4, // extra swell at gust peak
    lightDistance: 24,
    lightDecay: 1.8,
    lightHeight: 1.25,
    // Sway: the light origin wanders continuously around its home. Shadows
    // only move when the light POSITION moves, so this wander is what keeps
    // the shadows on stones, logs, and ground swaying every frame.
    swayRadius: 0.035, // wander scale, metres (typical offset ~1/3 of this) — per PR #17 review, shadow amplitude too big at 0.1; intentionally walks back PR #19's 0.5 ground-sweep restoration; 2026-09-26 live-demo review: Nicholas ruled amplitude and speed both down ~30% (this knob is the amplitude half; the speed half is the sway clock in updateLight)
    swayGustScale: 1.6, // wander-scale multiplier at gust peak
    swayGustWarmth: 0.3, // extra color drift toward amber at gust peak
    // Depth range: reach the near tree ring so trunks and canopies cast
    // dancing firelight shadows — tree bases start ~4.2 m from the light (the
    // clearing keeps trees 4 m out) and the signature trees sit at 5.0/5.8 m.
    // Casters beyond ~15 m stay out on purpose: there the firelight falloff
    // (~0.008x of base) and the 7 m fog make a shadow invisible, so extra
    // reach would only spend cube-map depth precision.
    shadowFar: 16,
    // PCF blur radius: a soft penumbra hides any residual banding at the
    // contact line.
    shadowRadius: 3,

    logCount: 5,
    logLength: 1.25,
    logRadius: 0.085,
    logBaseRadius: 0.5, // distance from center to the base of each tipi log
    logElevation: 1.9, // rise of the tipi lean; higher = more vertical

    stoneCount: 11,
    stoneRingRadius: 0.88,
    stoneSize: 0.19,

    coalCount: 7,
    coalGlowBase: 1.5,
    coalGlowAmp: 1.3,

    glowCoreRadius: 0.24,
    glowCoreOpacity: 0.17,

    // Aux ember-glow lights (no shadows): dim accents that wobble shadow
    // contrast near the coals.
    auxBase: 0.3,
    auxAmp: 0.7,
}

const UP = new Vector3(0, 1, 0)
const TAU = Math.PI * 2

// Reused per frame: the light's color temperature rides the envelope.
const fireColorLow = new Color(config.lightColorLow)
const fireColorHigh = new Color(config.lightColorHigh)

/**
 * Slow fire envelope in [0, 1]: the slow-breath layer of the light's motion —
 * five incommensurate band-limited sines (periods ~3.8–14.5 s) through a tanh
 * contrast curve, so the breathing never loops and never kinks. The fast
 * continuous layers live in windSway and gustFactor below. Pure,
 * deterministic.
 */
export function fireEnvelope(t: number): number {
    const swell =
        0.2 * Math.sin(t * TAU * 0.069 + 0.9) +
        0.24 * Math.sin(t * TAU * 0.107 + 4.2) +
        0.22 * Math.sin(t * TAU * 0.149 + 2.4) +
        0.16 * Math.sin(t * TAU * 0.197 + 5.6) +
        0.08 * Math.sin(t * TAU * 0.263 + 3.1)
    return to01WithContrast(swell, 1.6)
}

/**
 * Wind sway in [-1, 1]: the continuous position/intensity carrier — two
 * band-limited fbm channels (a ~2.2 s wander band plus a small quicker
 * shimmer band, incommensurate rates) summed with fixed weights and
 * tanh-soft-clipped, so excursions stay bounded without ever kinking.
 * Measured (fbm2, 200k samples): median |x| ≈ 0.12 → typical |sway| ≈ 0.32,
 * p90 ≈ 0.8. Never loops, never holds still. Pure, deterministic.
 */
export function windSway(t: number): number {
    return Math.tanh(
        2.8 *
            (0.72 * fbm1D(t * 0.45 + 7.3, 2) + 0.28 * fbm1D(t * 1.4 + 2.9, 2)),
    )
}

/**
 * Gust factor in [0, 1]: slow fbm (features every ~7 s) normalized by its
 * measured p90 amplitude (~0.39) and gated by a smoothstep idle floor — the
 * factor sits at zero most of the time and ramps up smoothly only during the
 * noise's occasional high swells (~13% of the time above half strength), so
 * the sway scale and a gentle intensity/color drift get their "small gust of
 * wind" cadence: mostly steady, occasionally (and smoothly) larger. Pure,
 * deterministic.
 */
export function gustFactor(t: number): number {
    return smoothstep(0.25, 1, fbm1D(t * 0.14 + 15.1, 2) / 0.45)
}

/**
 * Shared radial-gradient texture for baked contact shading.
 */
let contactTexture: CanvasTexture | null = null

function getContactTexture(): CanvasTexture {
    if (contactTexture) return contactTexture
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
        const gradient = ctx.createRadialGradient(
            size / 2,
            size / 2,
            0,
            size / 2,
            size / 2,
            size / 2,
        )
        gradient.addColorStop(0, 'rgba(12, 5, 2, 0.85)')
        gradient.addColorStop(0.3, 'rgba(12, 5, 2, 0.5)')
        gradient.addColorStop(0.75, 'rgba(12, 5, 2, 0.18)')
        gradient.addColorStop(1, 'rgba(12, 5, 2, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, size, size)
    }
    contactTexture = new CanvasTexture(canvas)
    return contactTexture
}

/**
 * A soft dark disc under a log or stone. Baked contact shading anchors
 * bases to the ground even while the projected shadow breathes.
 */
function addContactDisc(
    group: Group,
    radius: number,
    x: number,
    z: number,
    y: number,
    opacity: number,
): void {
    const mesh = new Mesh(
        new CircleGeometry(radius, 24),
        new MeshBasicMaterial({
            map: getContactTexture(),
            transparent: true,
            opacity,
            depthWrite: false,
        }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, y, z)
    group.add(mesh)
}

function createBarkMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
        color: new Color().setHSL(0.07, 0.45, 0.16 + rng.nextFloat(0, 0.05)),
        roughness: 0.95,
        flatShading: true,
    })
}

const charMaterial = new MeshStandardMaterial({
    color: 0x140d09,
    roughness: 1,
    flatShading: true,
})

const stoneMaterial = new MeshStandardMaterial({
    color: 0x6a675e,
    roughness: 0.85,
    flatShading: true,
})

/**
 * A leaning tipi log: base on the ground at angle phi, top leaning toward the
 * center of the fire.
 */
function createTipiLog(phi: number): Mesh {
    const geometry = new CylinderGeometry(
        config.logRadius * 0.7, // narrower burnt top
        config.logRadius,
        config.logLength,
        7,
    )
    // Origin at the base so the log leans from the ground.
    geometry.translate(0, config.logLength / 2, 0)

    const bark = createBarkMaterial()
    // Cap materials: [side, top, bottom]. The inner/top end is charred.
    const mesh = new Mesh(geometry, [bark, charMaterial, bark])

    const dir = new Vector3(
        -Math.cos(phi),
        config.logElevation,
        -Math.sin(phi),
    ).normalize()
    mesh.position.set(
        Math.cos(phi) * config.logBaseRadius,
        0,
        Math.sin(phi) * config.logBaseRadius,
    )
    mesh.quaternion.setFromUnitVectors(UP, dir)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}

/**
 * A fallen log lying across the stone ring, burnt end pointing into the fire.
 */
function createFallenLog(phi: number): Mesh {
    const length = 0.95
    const geometry = new CylinderGeometry(0.075, 0.095, length, 7)
    const bark = createBarkMaterial()
    // [side, top, bottom]: the top (+Y) end is rotated to face the fire.
    const mesh = new Mesh(geometry, [bark, charMaterial, bark])

    const radius = config.stoneRingRadius + 0.18
    mesh.position.set(Math.cos(phi) * radius, 0.08, Math.sin(phi) * radius)
    // Lay the cylinder on its side (top end faces -X), then aim -X at the center.
    mesh.rotation.set(0, -phi, Math.PI / 2)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}

function createStone(phi: number, radius: number): Mesh {
    const size = config.stoneSize * rng.nextFloat(0.7, 1.25)
    const geometry = new DodecahedronGeometry(size, 0)
    const mesh = new Mesh(geometry, stoneMaterial)
    mesh.position.set(
        Math.cos(phi) * radius,
        size * 0.45,
        Math.sin(phi) * radius,
    )
    mesh.scale.y = rng.nextFloat(0.6, 0.9)
    mesh.rotation.set(rng.nextFloat(0, Math.PI), rng.nextFloat(0, Math.PI), 0)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}

function createCoal(): Mesh {
    const size = rng.nextFloat(0.07, 0.13)
    const geometry = new DodecahedronGeometry(size, 0)
    const material = new MeshStandardMaterial({
        color: 0x1c0c05,
        emissive: 0xff4d12,
        emissiveIntensity: config.coalGlowBase,
        roughness: 1,
        flatShading: true,
    })
    const mesh = new Mesh(geometry, material)
    const angle = rng.nextFloat(0, Math.PI * 2)
    const radius = rng.nextFloat(0, 0.28)
    mesh.position.set(
        Math.cos(angle) * radius,
        size * 0.55,
        Math.sin(angle) * radius,
    )
    mesh.rotation.set(rng.nextFloat(0, Math.PI), rng.nextFloat(0, Math.PI), 0)
    mesh.userData.material = material
    return mesh
}

/**
 * Billboarded instanced-quad material for the diamond-leaf flames and sparks.
 * Each instance renders as a camera-facing sprite: position from the instance
 * matrix translation, size from its scale columns, tint from the instance
 * color, shape from the texture's alpha. Additive blending makes baking the
 * alpha envelope into the color keyframes lossless (the instanced renderer
 * carries RGB only). Spherical billboarding matches the original 2D acorn
 * engine, where sprites were always screen-facing.
 */
function createBillboardMaterial(map: Texture): ShaderMaterial {
    return new ShaderMaterial({
        uniforms: { map: { value: map } },
        // instanceMatrix and instanceColor are declared by the three.js
        // shader prefix under USE_INSTANCING / USE_INSTANCING_COLOR.
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            varying vec3 vTint;
            void main() {
                vUv = uv;
                #ifdef USE_INSTANCING
                    vec3 instancePos = instanceMatrix[3].xyz;
                    float sx = length(instanceMatrix[0].xyz);
                    float sy = length(instanceMatrix[1].xyz);
                #else
                    vec3 instancePos = vec3(0.0);
                    float sx = 1.0;
                    float sy = 1.0;
                #endif
                vec4 mvPosition = modelViewMatrix * vec4(instancePos, 1.0);
                mvPosition.xy += position.xy * vec2(sx, sy);
                gl_Position = projectionMatrix * mvPosition;
                #ifdef USE_INSTANCING_COLOR
                    vTint = instanceColor;
                #else
                    vTint = vec3(1.0);
                #endif
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D map;
            varying vec2 vUv;
            varying vec3 vTint;
            void main() {
                vec4 texel = texture2D(map, vUv);
                gl_FragColor = vec4(vTint * texel.rgb, texel.a);
            }
        `,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
    })
}

/**
 * Create the campfire: stone ring, logs, glowing coals, a three-particles
 * flame/ember/smoke effect, and a warm flickering shadow-casting light.
 * Returns a controller with update(dt) to be called each frame.
 */
export function createFire(): FireController {
    const group = new Group()

    // Baked contact shading: at grazing angles the flickering point light
    // cannot hug every base, so stones and logs get their own grounded discs.
    // Discs run wide and feathered so they meet the projected shadow with no
    // visible seam and no gap at the contact line.
    addContactDisc(group, 1.1, 0, 0, 0.01, 0.55)

    for (let i = 0; i < config.logCount; i++) {
        const phi =
            (i / config.logCount) * Math.PI * 2 + rng.nextFloat(-0.18, 0.18)
        group.add(createTipiLog(phi))
    }

    // A couple of fallen logs for composition.
    for (const phi of [Math.PI * 0.32, Math.PI * 1.22]) {
        group.add(createFallenLog(phi))
        for (const dist of [0.75, 1.06, 1.37]) {
            addContactDisc(
                group,
                0.38,
                Math.cos(phi) * dist,
                Math.sin(phi) * dist,
                0.018,
                0.55,
            )
        }
    }

    for (let i = 0; i < config.stoneCount; i++) {
        const phi =
            (i / config.stoneCount) * Math.PI * 2 + rng.nextFloat(-0.14, 0.14)
        const ringRadius = config.stoneRingRadius * rng.nextFloat(0.9, 1.1)
        group.add(createStone(phi, ringRadius))
        addContactDisc(
            group,
            config.stoneSize * 3.3,
            Math.cos(phi) * ringRadius,
            Math.sin(phi) * ringRadius,
            0.014,
            0.6,
        )
    }

    const coals: Mesh[] = []
    for (let i = 0; i < config.coalCount; i++) {
        const coal = createCoal()
        coals.push(coal)
        group.add(coal)
    }

    // Hot core glow behind the flames.
    const glowCore = new Mesh(
        new SphereGeometry(config.glowCoreRadius, 16, 12),
        new MeshBasicMaterial({
            color: 0xff8c2a,
            transparent: true,
            opacity: config.glowCoreOpacity,
            blending: AdditiveBlending,
            depthWrite: false,
            side: DoubleSide,
        }),
    )
    glowCore.position.y = 0.3
    group.add(glowCore)

    // Load the diamond-fire particle effect (port of the original Kotlin
    // diamondFire.acornPEffect). The billboard materials and quad geometries
    // are registered here; the effect JSON carries the timeline data and
    // references them by id. Quad sizes are the world-space size at
    // scaleX/scaleY = 1, calibrated against the scene's 1.25 m logs.
    let particleEffect: ParticleEffect | null = null
    const textureLoader = new TextureLoader()
    const loader = new ParticleEffectLoader()
    Promise.all([
        textureLoader.loadAsync('/assets/scene/diamond.png'),
        textureLoader.loadAsync('/assets/scene/particle.png'),
    ])
        .then(([diamondTexture, particleTexture]) => {
            loader.setMaterials({
                diamondLeafMat: createBillboardMaterial(diamondTexture),
                emberMat: createBillboardMaterial(particleTexture),
            })
            loader.setGeometries({
                // Diamond leaves keep the 23x46 sprite's 1:2 aspect; the ember
                // quad matches the accepted pre-diamond ember dot (the old
                // emberMat PointsMaterial size 0.09). Per-instance scale
                // multiplies these quads.
                flameQuad: new PlaneGeometry(0.22, 0.44),
                emberQuad: new PlaneGeometry(0.09, 0.09),
            })
            return loader.loadAsync('/assets/scene/effects/diamond-fire.json')
        })
        .then((model) => {
            particleEffect = new ParticleEffect(model)
            group.add(particleEffect)
        })
        .catch(console.error)

    const light = new PointLight(
        config.lightColorLow,
        config.lightBaseIntensity,
        config.lightDistance,
        config.lightDecay,
    )
    light.castShadow = true
    light.shadow.mapSize.set(2048, 2048)
    light.shadow.camera.near = 0.2
    light.shadow.camera.far = config.shadowFar
    light.shadow.radius = config.shadowRadius
    // Near-zero bias: negative bias stretches the projected shadow away from
    // the stone bases (cm-scale with a 24 m far plane), and normalBias lifts
    // ground samples off the surface — both detach contact shadows.
    light.shadow.bias = -0.0003
    // The light origin wanders continuously around this home (see updateLight):
    // shadow geometry follows the position, so the wander is what keeps the
    // shadows alive between and beyond the old jump-cut events.
    const lightHome = new Vector3(0, config.lightHeight, 0)
    light.position.copy(lightHome)
    group.add(light)

    // Two dim ember-glow aux lights near the coals with independent noise
    // phases: their interference makes the main light's shadows wobble in
    // contrast and adds glow richness. They cast no shadows.
    const auxLights: { light: PointLight; seed: number; rate: number }[] = []
    for (const seed of [3.3, 17.9]) {
        const aux = new PointLight(0xffb066, 0, 2.2, 1.6)
        aux.position.set(
            rng.nextFloat(-0.22, 0.22),
            0.32,
            rng.nextFloat(-0.22, 0.22),
        )
        aux.castShadow = false
        group.add(aux)
        auxLights.push({ light: aux, seed, rate: seed > 10 ? 0.9 : 1.25 })
    }

    let fireTime = 0
    // Dedicated sway clock for the light-position wander: 0.7× real time —
    // the speed half of the 2026-09-26 ruling (amplitude and speed both
    // down ~30%). Only the position wander slows; every other consumer of
    // fireTime — breath, gust, shimmer, color, aux, coals — stays real time.
    let swayTime = 0

    // Layered wind motion: three smooth noise layers over time —
    //   · windSway: continuous positional wander (independent channels per
    //     axis, flame-sway scale) and a small continuous intensity shimmer,
    //   · fireEnvelope: the slow breath in intensity,
    //   · gustFactor: occasional gusts that widen the sway and swell the
    //     light, like wind leaning on the flames.
    // Every layer is C1-smooth, so there are no steps, jumps, freezes, or
    // strobing — and the position moves EVERY frame, which is what keeps the
    // shadow geometry swaying (color/intensity alone cannot move shadows).
    function updateLight(dT: number) {
        fireTime += dT
        swayTime += dT * 0.7

        const breath = fireEnvelope(fireTime)
        const gust = gustFactor(fireTime)
        const swayScale = lerp(1, config.swayGustScale, gust)

        // Position: independent noise channels per axis (different rates and
        // phase offsets) trace a 2D wander rather than a line; a half-radius
        // vertical bob modulates shadow lengths too.
        light.position.x =
            lightHome.x + config.swayRadius * swayScale * windSway(swayTime)
        light.position.z =
            lightHome.z +
            config.swayRadius * swayScale * windSway(swayTime * 1.13 + 31.7)
        light.position.y =
            lightHome.y +
            config.swayRadius *
                0.5 *
                swayScale *
                windSway(swayTime * 0.8 + 11.4)

        // Intensity: base + slow breath + continuous shimmer + gust swell.
        const shimmer = windSway(fireTime * 1.07 + 53.3)
        light.intensity =
            config.lightBaseIntensity +
            config.lightBreathIntensity * breath +
            config.lightNoiseIntensity * shimmer +
            config.lightGustIntensity * gust

        // Warmth rides the breath with a slight extra drift during gusts —
        // the color range itself is tight (see config), so this reads as a
        // gentle tint drift, not the old full ember-to-amber swings.
        const warmth = Math.min(
            1,
            Math.max(0, breath + config.swayGustWarmth * gust),
        )
        light.color.copy(fireColorLow).lerp(fireColorHigh, warmth)

        // Aux ember glows breathe on their own noise phases.
        for (const aux of auxLights) {
            aux.light.intensity =
                config.auxBase +
                config.auxAmp * fireEnvelope(fireTime * aux.rate + aux.seed)
        }

        // Coals breathe with the fire but out of phase, at a slower rate.
        const coal = lerp(
            config.coalGlowBase,
            config.coalGlowBase + config.coalGlowAmp,
            fireEnvelope(fireTime * 0.7 + 40),
        )
        for (const c of coals) {
            ;(c.userData.material as MeshStandardMaterial).emissiveIntensity =
                coal
        }
        glowCore.material.opacity =
            config.glowCoreOpacity * (0.6 + breath * 0.6)
    }

    // Scratch for the per-frame effect-plane yaw (see update).
    const fireWorldPos = new Vector3()

    // The runtime's InstancedMesh emitters default castShadow/receiveShadow
    // on (three-particles ParticleEmitterInstancedMesh constructor), and the
    // emitters are created lazily on the first update — after any load-time
    // traverse runs, so flags set there never reach them. Diamond quads
    // inside the fire light's shadow frustum would throw long radial shadow
    // streaks across the ground. Particles glow; they cast nothing. Apply
    // the flags once the first update has materialized the emitters.
    let particleShadowFlagsApplied = false

    function update(dT: number, camera: PerspectiveCamera) {
        updateLight(dT)

        particleEffect?.update(dT)

        if (particleEffect && !particleShadowFlagsApplied) {
            particleEffect.traverse((obj) => {
                obj.castShadow = false
                obj.receiveShadow = false
            })
            particleShadowFlagsApplied = true
        }

        // The original Kotlin engine drew this effect in screen space: the
        // emission fan's plane always faced the viewer. Per-particle
        // billboarding only orients the SPRITES — the plane the particles
        // emit and spread in is this effect root's local XY plane, so the
        // root yaws to face the camera, restoring the screen-plane semantic
        // for both emitters. (The smoke ellipsoid is w == d, so the yaw
        // changes nothing for it; rising particles are unaffected.)
        if (particleEffect) {
            group.getWorldPosition(fireWorldPos)
            particleEffect.rotation.y = Math.atan2(
                camera.position.x - fireWorldPos.x,
                camera.position.z - fireWorldPos.z,
            )
        }
    }

    return {
        light,
        update,
        group,
    }
}
