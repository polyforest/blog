// Ported from polyforest/polyforest-web
// (https://github.com/polyforest/polyforest-web), branch main, commit
// fa689af4010fa136400c341580f38f26a51d00b3, file src/forest.ts. Upstream
// retains the canonical version; drift is accepted and documented in the scene
// background spec. The isDebug branches are dropped (the ambient scene always
// runs the production layout).
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { easeOut, repeatArr } from './util'
import {
    BufferGeometry,
    Color,
    CylinderGeometry,
    Float32BufferAttribute,
    Matrix4,
    Mesh,
    MeshPhongMaterial,
    Vector2,
    Vector3,
} from 'three'
import { bellRandom, bellRandomInt, jiggleColor, pickRandom, rng } from './rand'
import { WATER_LEVEL, terrainHeight } from './terrain'

const leafPalette: Color[] = [
    new Color(0x22b311),
    new Color(0xe97723),
    new Color(0xe3ac41),
    new Color(0xb9433d),
    new Color(0xf4a93d),
    new Color(0xb99784),
]
const trunkPalette: Color[] = [
    new Color(0x919094),
    new Color(0xe17f47),
    new Color(0x542a0e),
]
const treeSpacing = 2.2
const treeJiggle = 0.25
const clearing = new Vector2(0, 0)
const clearingMin = 4 // Create a clearing where the trees get thicker until clearingMax
const clearingMax = 7

/**
 * Returns a Forest
 */
export function createForest(r: number): Mesh {
    const g: BufferGeometry[] = []
    const c = r / treeSpacing // The number of trees within the island radius.

    for (let i = -c; i < c; i++) {
        for (let j = -c; j < c; j++) {
            const rowP = i / c
            const colP = j / c
            const r1 = easeOut(rng.nextFloat(-1, 1)) * treeJiggle // Bias more jiggle over less without increasing max jiggle.
            const r2 = easeOut(rng.nextFloat(-1, 1)) * treeJiggle
            const p = new Vector2(colP * r + r1, rowP * r + r2)
            const clearD = p.distanceTo(clearing)
            const clearP = (clearD - clearingMin) / (clearingMax - clearingMin)
            if (p.length() > r || rng.nextFloat() > clearP) continue

            // No trees in the water or on the waterline fringe.
            const groundY = terrainHeight(p.x, p.y, r)
            if (groundY < WATER_LEVEL + 0.15) continue

            const tree = createTree()

            const s = bellRandom(0.8, 2)
            tree.scale(s, s, s)
            tree.rotateY(rng.nextFloat(0, Math.PI * 2))
            // Sit on the displaced ground; a small sink hides trunk-base
            // hover on convex terrain between heightfield samples.
            tree.translate(p.x, groundY - 0.1, p.y)
            g.push(tree)
        }
    }

    // The two trees that look like the logo:
    const px = 1 / 80

    // 180,270
    // 172,240
    // 177,218

    //
    // f7de67

    const yellowTree = createTree({
        leafColor: new Color(0xf7de67),
        trunkColor: new Color(0xffffff),
        segments: [
            {
                x: -8 * px,
                y: 30 * px,
                numLeaves: 1,
                leafRotateZ: Math.PI * 0.3,
                leafRotateY: 0,
                leafScale: 1.0,
            },
            {
                x: 5 * px,
                y: 22 * px,
                numLeaves: 1,
                leafRotateZ: -Math.PI * 0.07,
                leafRotateY: 0,
                leafScale: 3,
            },
        ],
    })

    yellowTree.translate(-0.3, terrainHeight(-0.3, -5.8, r) - 0.1, -5.8)
    g.push(yellowTree)

    const orangeTree = createTree({
        leafColor: new Color(0xdc6628),
        trunkColor: new Color(0xffffff),
        segments: [
            {
                x: 23 * px,
                y: 81 * px,
                numLeaves: 1,
                leafRotateZ: -Math.PI * 0.45,
                leafRotateY: 0,
                leafScale: 1.0,
            },
            {
                x: -19 * px,
                y: 72 * px,
                numLeaves: 1,
                leafRotateZ: -Math.PI * 0.3,
                leafRotateY: 0,
                leafScale: 0.5,
            },
            {
                x: -17 * px,
                y: 14 * px,
                numLeaves: 1,
                leafRotateZ: Math.PI * 0.25,
                leafRotateY: 0,
                leafScale: 1.6,
            },
        ],
    })

    orangeTree.translate(0.3, terrainHeight(0.3, -5, r) - 0.1, -5)
    g.push(orangeTree)

    const material = new MeshPhongMaterial({ vertexColors: true })
    const geom = mergeGeometries(g)
    const forestMesh = new Mesh(geom, material)
    forestMesh.receiveShadow = true
    forestMesh.castShadow = true
    return forestMesh
}

interface TreeParams {
    leafColor: Color
    trunkColor: Color
    segments: TreeSegment[]
}

interface TreeSegment {
    x: number
    y: number
    numLeaves: number
    leafRotateZ: number
    leafRotateY: number
    leafScale: number
}

function createRandomTreeParams(): TreeParams {
    const leafColorIndex = rng.nextInt(0, leafPalette.length)
    const leafColor = jiggleColor(leafPalette[leafColorIndex])
    const trunkColor = jiggleColor(pickRandom(trunkPalette))
    const numSegments = bellRandomInt(1, 5)

    const t = numSegments

    let theta: number, dT: number

    switch (t) {
        case 1:
            theta = 0
            dT = 0
            break
        case 2:
            theta = 0.4
            dT = -0.4
            break
        case 3:
            theta = 0.4
            dT = -0.6
            break
        case 4:
            theta = 0.5
            dT = -0.3
            break
        default:
            throw new Error('unreachable')
    }

    let len = 0.7
    const segments = /** @type TreeSegment[] */ []
    const leafRotateZ = -Math.PI * 0.3
    let numLeaves
    const r = rng.nextFloat()
    if (r < 0.8) {
        numLeaves = 1
    } else if (r < 0.9) {
        numLeaves = 2
    } else if (r < 0.95) {
        numLeaves = 3
    } else {
        numLeaves = 4
    }
    // For many leaves, straighten the tree
    dT /= numLeaves
    theta /= numLeaves

    for (let i = 0; i < numSegments; i++) {
        let leafScale
        switch (i) {
            case 0:
                leafScale = bellRandom(0.7, 1.0)
                break
            case numSegments - 1:
                leafScale = bellRandom(0.8, 1.2)
                break
            default:
                leafScale = bellRandom(0.3, 0.7)
                break
        }
        //
        segments.push({
            x: Math.sin(theta) * len,
            y: Math.cos(theta) * len,
            numLeaves: i === t - 1 ? 1 : numLeaves,
            leafRotateZ: i === t - 1 ? -theta : leafRotateZ,
            leafRotateY: 0,
            leafScale: leafScale,
        })
        len *= 0.618
        theta += dT
    }

    return {
        leafColor: leafColor,
        trunkColor: trunkColor,
        segments: segments,
    }
}

/**
 * @param params {TreeParams}
 */
function createTree(params = createRandomTreeParams()): BufferGeometry {
    const leafColor = params.leafColor
    const treeParts: BufferGeometry[] = []

    // Trunk

    const segments = params.segments

    let x = 0
    let y = 0
    let w = 0.02
    const finalScale = 0.2
    const wM = Math.pow(finalScale, 1 / segments.length)
    const trunkColor = params.trunkColor

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]

        const trunkGeom = new CylinderGeometry(
            w * wM,
            w,
            segment.y,
            6,
            1,
            false,
        )
        w *= wM
        const shearMat = new Matrix4()
        //shearMat.
        shearMat.set(
            1,
            segment.x / segment.y,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
        )
        trunkGeom.applyMatrix4(shearMat)

        trunkGeom.translate(x + segment.x * 0.5, y + segment.y * 0.5, 0)
        x += segment.x
        y += segment.y

        trunkGeom.setAttribute(
            'color',
            new Float32BufferAttribute(
                repeatArr(
                    [trunkColor.r, trunkColor.g, trunkColor.b],
                    trunkGeom.getAttribute('position').count,
                ),
                3,
            ),
        )
        trunkGeom.deleteAttribute('uv')
        treeParts.push(trunkGeom)

        for (let j = 0; j < segment.numLeaves; j++) {
            const o = (j * Math.PI * 2) / segment.numLeaves
            const leaf = new Leaf(leafColor)
            leaf.scale(segment.leafScale, segment.leafScale, segment.leafScale)
            leaf.rotateZ(segment.leafRotateZ)
            leaf.rotateY(segment.leafRotateY + o)

            leaf.translate(x, y, 0)
            treeParts.push(leaf)
        }
    }

    return mergeGeometries(treeParts)
}

/**
 * 0, 0 is the base of the leaf.
 */
class Leaf extends BufferGeometry {
    constructor(color: Color) {
        super()

        // this.type = 'LeafSide';

        // buffers

        const vertices: number[] = []
        const indices: number[] = []
        const colors: number[] = []

        // helper variables

        const ptA = new Vector3()
        const ptB = new Vector3()
        const ptC = new Vector3()
        let highestIndex = -1

        const pushFace = () => {
            vertices.push(
                ptA.x,
                ptA.y,
                ptA.z,
                ptB.x,
                ptB.y,
                ptB.z,
                ptC.x,
                ptC.y,
                ptC.z,
            )
            colors.push(
                color.r,
                color.g,
                color.b,
                color.r,
                color.g,
                color.b,
                color.r,
                color.g,
                color.b,
            )
            indices.push(highestIndex + 1, highestIndex + 2, highestIndex + 3)
            highestIndex += 3
        }

        const hH = 35 / 80
        const hW = 20 / 80

        ptA.set(-hW, hH, 0)
        ptB.set(0, hH, hW)
        ptC.set(0, hH * 2, 0)
        pushFace()

        ptA.set(0, hH, hW)
        ptB.set(hW, hH, 0)
        ptC.set(0, hH * 2, 0)
        pushFace()

        ptA.set(-hW, hH, 0)
        ptB.set(0, 0, 0)
        ptC.set(0, hH, hW)
        pushFace()

        ptA.set(0, hH, hW)
        ptB.set(0, 0, 0)
        ptC.set(hW, hH, 0)
        pushFace()

        // Back

        ptA.set(0, hH * 2, 0)
        ptC.set(-hW, hH, 0)
        ptB.set(0, hH, -hW)
        pushFace()

        ptA.set(0, hH * 2, 0)
        ptC.set(0, hH, -hW)
        ptB.set(hW, hH, 0)
        pushFace()

        ptA.set(0, hH, -hW)
        ptC.set(-hW, hH, 0)
        ptB.set(0, 0, 0)
        pushFace()

        ptA.set(hW, hH, 0)
        ptC.set(0, hH, -hW)
        ptB.set(0, 0, 0)
        pushFace()

        // build geometry
        this.setIndex(indices)
        this.setAttribute('position', new Float32BufferAttribute(vertices, 3))
        this.setAttribute('color', new Float32BufferAttribute(colors, 3))

        this.computeVertexNormals()
    }
}
