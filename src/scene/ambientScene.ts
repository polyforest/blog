/**
 * The ambient Poly Forest scene — a fixed, decorative background rendered
 * behind the blog home page content.
 *
 * Scene composition (fire, terrain, procedural forest, water, skybox, fog,
 * lights) mirrors polyforest-web's src/mainScene.ts at commit fa689af, minus
 * everything interactive: no logo plane, no leaves, no burst, no orbit
 * controls, no camera motion. The camera holds the hero-wide framing while
 * page content scrolls over the canvas.
 *
 * Lifecycle contract (see the scene background spec):
 * - Lazy: this module is only ever reached through a dynamic import() after
 *   window load + idle, so three.js never touches the initial bundle.
 * - Warm: the particle simulation is advanced WARMUP_SECONDS of virtual time
 *   before the first render, so frame one never shows a sparse, half-lit fire.
 * - Still on demand: under prefers-reduced-motion the loop never starts —
 *   one warmed-up frame renders and the scene holds.
 * - Frugal: the rAF loop pauses on visibilitychange, and the pixel ratio is
 *   capped at MAX_DPR.
 * - Clean: dispose() (wired to unloading pagehide) frees geometries, materials,
 *   textures, and the WebGL context.
 */
import {
    AmbientLight,
    CubeTextureLoader,
    DirectionalLight,
    Fog,
    FrontSide,
    LinearFilter,
    Material,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    RepeatWrapping,
    Scene,
    ShaderMaterial,
    Texture,
    TextureLoader,
    Vector2,
    WebGLRenderer,
} from 'three'
import { ParticleEffect } from 'three-particles'
import { createFire } from './fire'
import { createForest } from './forest'
import { createTerrainMesh, createWaterMesh } from './terrain'
import { WARMUP_SECONDS, WARMUP_STEP } from './WARMUP_STEP'

// The hero-wide framing on polyforest.com (QA-tuned from the spec's starting
// point (0, 8.5, 12): at that distance the fire is a distant dot — the hero
// look reads from the close band just past the intro's eased endpoint).
// No animation.
const CAMERA_POSITION = { x: 0, y: 2.1, z: 5.6 }
const CAMERA_TARGET = { x: 0, y: 0.9, z: 0 }
const FOV = 75
const NEAR = 0.1
const FAR = 400

const ISLAND_RADIUS = 30
const CLEAR_COLOR = 0x191919
const MAX_DPR = 1.5

/**
 * Initialize the scene on the given canvas and start its (visibility-gated)
 * render loop. Returns an idempotent dispose function; dispose is also wired
 * to a non-persisted `pagehide` internally (a bfcache entry only pauses), so
 * callers rarely need the return value.
 */
export function initAmbientScene(canvas: HTMLCanvasElement): () => void {
    const renderer = new WebGLRenderer({ canvas, antialias: true })
    renderer.setClearColor(CLEAR_COLOR)
    renderer.shadowMap.enabled = true
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))

    const initialAspect =
        canvas.clientWidth > 0 && canvas.clientHeight > 0
            ? canvas.clientWidth / canvas.clientHeight
            : 2
    const camera = new PerspectiveCamera(FOV, initialAspect, NEAR, FAR)
    camera.position.set(
        CAMERA_POSITION.x,
        CAMERA_POSITION.y,
        CAMERA_POSITION.z,
    )
    camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z)

    const scene = new Scene()
    scene.fog = new Fog(0x0a1019, 7, 34)

    const dLight = new DirectionalLight(0xccddff, 0.15)
    dLight.shadow.mapSize.set(1024, 1024)
    dLight.position.set(10, 5, 3)
    dLight.castShadow = true
    scene.add(dLight)

    scene.add(new AmbientLight(0xffffff, 0.03))

    // Draw order matters: the fire consumes the seeded rng (seed 232) before
    // the forest does, matching mainScene's creation order on polyforest.com.
    const fire = createFire()
    scene.add(fire.group)
    scene.add(createForest(ISLAND_RADIUS))

    const textureLoader = new TextureLoader()

    // Floor: the level campfire clearing swelling into an island, one 512px
    // texture tile per ~4.6m — the old site's texel density.
    let groundTex: Texture | null = null
    let groundNormalTex: Texture | null = null
    {
        groundTex = textureLoader.load('/assets/scene/ground.jpg')
        groundTex.wrapS = RepeatWrapping
        groundTex.wrapT = RepeatWrapping
        groundTex.magFilter = LinearFilter
        const repeats = (ISLAND_RADIUS * 2) / 4.6
        groundTex.repeat.set(repeats, repeats)

        const planeMat = new MeshStandardMaterial({
            map: groundTex,
            side: FrontSide,
        })

        groundNormalTex = textureLoader.load(
            '/assets/scene/groundNormalMap.jpg',
        )
        groundNormalTex.wrapS = RepeatWrapping
        groundNormalTex.wrapT = RepeatWrapping
        groundNormalTex.magFilter = LinearFilter
        groundNormalTex.repeat.set(repeats, repeats)

        planeMat.normalMap = groundNormalTex
        // The normal map was created for an upside down rendering engine...
        planeMat.normalScale = new Vector2(0.8, -0.8)

        scene.add(createTerrainMesh(ISLAND_RADIUS, planeMat))
    }

    // Water: a still night surface extending far past the fog so the shore
    // fades naturally with no visible plane edge.
    {
        const waterMat = new MeshStandardMaterial({
            color: 0x0c1826,
            roughness: 0.28,
            metalness: 0.5,
        })
        scene.add(createWaterMesh(2000, waterMat))
    }

    // Skybox: the same six-face night sky as polyforest.com's hero.
    const skybox = new CubeTextureLoader().load([
        '/assets/scene/skybox/pos-x.jpg',
        '/assets/scene/skybox/neg-x.jpg',
        '/assets/scene/skybox/pos-y.jpg',
        '/assets/scene/skybox/neg-y.jpg',
        '/assets/scene/skybox/pos-z.jpg',
        '/assets/scene/skybox/neg-z.jpg',
    ])
    scene.background = skybox

    // --- Warmup -------------------------------------------------------------
    // createFire() attaches its particle effect to the group asynchronously
    // (sprite textures + effect JSON load first); the warmup steps only warm
    // something once that effect exists, so wait for it. Until then the loop
    // simply doesn't render — the transparent canvas over the page's #191919
    // backdrop looks identical to the scene's own clear color.
    let warmupRemaining = WARMUP_SECONDS
    let warmedUp = false
    const effectReady = (): boolean =>
        fire.group.children.some((child) => child instanceof ParticleEffect)

    function warmup(): void {
        while (warmupRemaining > 0) {
            fire.update(WARMUP_STEP, camera)
            warmupRemaining -= WARMUP_STEP
        }
        warmedUp = true
    }

    // --- Render loop --------------------------------------------------------
    const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
    ).matches
    let lastFrameTime = 0
    let rafId = 0
    let running = false
    let disposed = false

    function resizeRendererToDisplaySize(): boolean {
        const width = canvas.clientWidth
        const height = canvas.clientHeight
        const dpr = renderer.getPixelRatio()
        const needResize =
            canvas.width !== Math.floor(width * dpr) ||
            canvas.height !== Math.floor(height * dpr)
        if (needResize) renderer.setSize(width, height, false)
        return needResize
    }

    function updateCameraAspect(): void {
        camera.aspect = canvas.clientWidth / canvas.clientHeight
        camera.updateProjectionMatrix()
    }

    // One-shot reveal: the page's CSS fades the canvas in once it carries the
    // .scene-ready class, so the reveal must fire exactly here — right after
    // the first real render — on both render paths (the animated loop and the
    // reduced-motion still frame), or reduced-motion users would see nothing.
    let revealed = false
    function reveal(): void {
        if (revealed) return
        revealed = true
        canvas.classList.add('scene-ready')
    }

    function frame(now: number): void {
        rafId = requestAnimationFrame(frame)

        if (!warmedUp) {
            if (!effectReady()) return
            warmup()
        }

        // dT 0 on the first frame (the warmup already ran). Cap the simulation
        // step: on slow frames — or after a hidden tab pauses rAF — a huge
        // delta teleports particles; a capped step slows time gracefully
        // instead of jumping.
        const dT = lastFrameTime > 0 ? (now - lastFrameTime) / 1000 : 0
        lastFrameTime = now
        const simDt = Math.min(dT, 0.1)
        if (resizeRendererToDisplaySize()) updateCameraAspect()
        fire.update(simDt, camera)
        renderer.render(scene, camera)
        reveal()
    }

    function start(): void {
        if (running || disposed || prefersReducedMotion) return
        running = true
        rafId = requestAnimationFrame(frame)
    }

    function stop(): void {
        running = false
        cancelAnimationFrame(rafId)
    }

    // --- Reduced motion: one warmed, still frame ----------------------------
    function renderStill(): void {
        if (!warmedUp || disposed) return
        if (resizeRendererToDisplaySize()) updateCameraAspect()
        // dT 0: a settled frame that still tracks the camera for the effect's
        // billboard yaw (same treatment as upstream's reduced-motion path).
        fire.update(0, camera)
        renderer.render(scene, camera)
        reveal()
    }

    const onVisibilityChange = (): void => {
        if (document.hidden) stop()
        else start()
    }
    // A persisted pagehide means the page is entering the back/forward cache
    // and may be restored intact, so only pause; tearing down the WebGL
    // context here would leave a blank canvas when the user navigates back.
    const onPagehide = (event: PageTransitionEvent): void => {
        if (event.persisted) stop()
        else dispose()
    }
    const onPageshow = (event: PageTransitionEvent): void => {
        if (!event.persisted) return
        if (prefersReducedMotion) renderStill()
        else if (!document.hidden) start()
    }

    if (prefersReducedMotion) {
        const renderStillWhenReady = (): void => {
            if (disposed) return
            if (!effectReady()) {
                rafId = requestAnimationFrame(renderStillWhenReady)
                return
            }
            warmup()
            renderStill()
        }
        window.addEventListener('resize', renderStill)
        renderStillWhenReady()
    } else {
        document.addEventListener('visibilitychange', onVisibilityChange)
        start()
    }

    window.addEventListener('pagehide', onPagehide)
    window.addEventListener('pageshow', onPageshow)

    // --- Teardown -----------------------------------------------------------
    function disposeMaterial(material: Material): void {
        // three-particles' billboard materials carry their sprite textures as
        // uniform maps rather than .map; free those too.
        if (material instanceof ShaderMaterial) {
            const map = material.uniforms?.map?.value
            if (map instanceof Texture) map.dispose()
        }
        material.dispose()
    }

    function dispose(): void {
        if (disposed) return
        disposed = true
        stop()
        document.removeEventListener('visibilitychange', onVisibilityChange)
        window.removeEventListener('resize', renderStill)
        window.removeEventListener('pagehide', onPagehide)
        window.removeEventListener('pageshow', onPageshow)

        scene.traverse((obj) => {
            if (!(obj instanceof Mesh)) return
            obj.geometry.dispose()
            if (Array.isArray(obj.material)) {
                obj.material.forEach(disposeMaterial)
            } else {
                disposeMaterial(obj.material)
            }
        })
        groundTex?.dispose()
        groundNormalTex?.dispose()
        skybox.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
    }

    return dispose
}
