/**
 * Pure 4D math for the Stage 4 tesseract: vertex/face/edge generation, the two
 * xw/yz rotation planes, hyperplane slicing, and perspective projection to 3D.
 * No three.js dependency — Task 14's rendering layer converts these plain
 * numbers/objects into `THREE.LineSegments` geometry.
 */

/** A point in 4D space, axis order [x, y, z, w]. */
export type Vec4 = readonly [number, number, number, number]

/** A point in 3D space, the output of both rendering paths below. */
export interface Point3 {
  x: number
  y: number
  z: number
}

/** A square face of the tesseract: 4 vertex indices in cyclic order (consecutive pairs are edges). */
export interface TesseractFace {
  vertices: readonly [number, number, number, number]
}

/** An edge of the tesseract as a pair of vertex indices. */
export interface TesseractEdge {
  a: number
  b: number
}

/** One segment of a hyperplane cross-section, already flattened to 3D (w == the slice's w0). */
export interface SliceEdge {
  a: Point3
  b: Point3
}

function vertexFromBits(i: number): Vec4 {
  return [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]
}

/** All 16 tesseract vertices: every combination of ±1 across x/y/z/w, indexed 0-15 by bit pattern. */
export const TESSERACT_VERTICES: Vec4[] = Array.from({ length: 16 }, (_, i) => vertexFromBits(i))

function vertexIndex(coords: Vec4): number {
  let index = 0
  for (let axis = 0; axis < 4; axis++) if (coords[axis] === 1) index |= 1 << axis
  return index
}

/**
 * The 24 square faces, generated via the axis-pair method rather than a hardcoded
 * table: pick 2 of the 4 axes to vary ("free"), fix the other 2 at each of their 4
 * sign combinations, and walk the free pair in Gray-code order (00, 10, 11, 01) so
 * consecutive face vertices always differ in exactly one coordinate.
 */
function generateFaces(): TesseractFace[] {
  const faces: TesseractFace[] = []
  const corners: readonly [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]

  for (let freeA = 0; freeA < 4; freeA++) {
    for (let freeB = freeA + 1; freeB < 4; freeB++) {
      const fixedAxes = [0, 1, 2, 3].filter((axis) => axis !== freeA && axis !== freeB)
      for (const fixedA of [-1, 1]) {
        for (const fixedB of [-1, 1]) {
          const vertices = corners.map(([va, vb]) => {
            const coords: [number, number, number, number] = [0, 0, 0, 0]
            coords[freeA] = va
            coords[freeB] = vb
            coords[fixedAxes[0]] = fixedA
            coords[fixedAxes[1]] = fixedB
            return vertexIndex(coords)
          }) as [number, number, number, number]
          faces.push({ vertices })
        }
      }
    }
  }
  return faces
}

/** All 24 tesseract faces. */
export const TESSERACT_FACES: TesseractFace[] = generateFaces()

/** All 32 tesseract edges: vertex-index pairs whose bit patterns differ in exactly one axis. */
function generateEdges(): TesseractEdge[] {
  const edges: TesseractEdge[] = []
  for (let a = 0; a < 16; a++) {
    for (let b = a + 1; b < 16; b++) {
      const diff = a ^ b
      if (diff !== 0 && (diff & (diff - 1)) === 0) edges.push({ a, b })
    }
  }
  return edges
}

/** All 32 tesseract edges, as vertex-index pairs — the wireframe for `projectTo3D`'s output. */
export const TESSERACT_EDGES: TesseractEdge[] = generateEdges()

function rotate2D(a: number, b: number, angle: number): [number, number] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [a * c - b * s, a * s + b * c]
}

/** Rotates every vertex in the xw-plane by `angle`, leaving y/z untouched. */
export function rotateXW(vertices: readonly Vec4[], angle: number): Vec4[] {
  return vertices.map(([x, y, z, w]) => {
    const [rx, rw] = rotate2D(x, w, angle)
    return [rx, y, z, rw] as Vec4
  })
}

/** Rotates every vertex in the yz-plane by `angle`, leaving x/w untouched. */
export function rotateYZ(vertices: readonly Vec4[], angle: number): Vec4[] {
  return vertices.map(([x, y, z, w]) => {
    const [ry, rz] = rotate2D(y, z, angle)
    return [x, ry, rz, w] as Vec4
  })
}

/**
 * Where a 4D edge (a -> b) crosses the w = w0 hyperplane, linearly interpolated and
 * flattened to 3D. Returns null if the edge doesn't reach w0 (t outside [0, 1]) or
 * runs parallel to the hyperplane (aw === bw, the two endpoints share a w value —
 * covered by the face's other two edges instead, so no crossing here).
 */
function edgeCrossing(a: Vec4, b: Vec4, w0: number): Point3 | null {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  if (aw === bw) return null

  const t = (w0 - aw) / (bw - aw)
  if (t < 0 || t > 1) return null

  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, z: az + (bz - az) * t }
}

/**
 * Hyperplane slicing: intersects the w = w0 hyperplane with each of the tesseract's
 * 24 square faces directly (no convex-hull library needed). A face crossed by the
 * hyperplane has exactly 2 of its 4 edges cross it; those 2 points become one output
 * segment. Faces entirely on one side (or lying flat inside the hyperplane) contribute
 * nothing.
 */
export function sliceTesseract(
  vertices: readonly Vec4[],
  faces: readonly TesseractFace[],
  w0: number,
): SliceEdge[] {
  const edges: SliceEdge[] = []

  for (const face of faces) {
    const corners = face.vertices.map((i) => vertices[i])
    const crossings: Point3[] = []
    for (let i = 0; i < 4; i++) {
      const point = edgeCrossing(corners[i], corners[(i + 1) % 4], w0)
      if (point) crossings.push(point)
    }
    if (crossings.length === 2) edges.push({ a: crossings[0], b: crossings[1] })
  }

  return edges
}

/**
 * Distance of the 4D "viewer" along +w, used by `projectTo3D`'s perspective divide.
 * Must exceed the largest |w| a rotated tesseract vertex can reach (sqrt(2) ~= 1.414,
 * since rotation preserves x^2 + w^2 = 2 for a unit tesseract's corners) to keep the
 * divisor away from zero.
 */
export const PROJECTION_VIEWER_DISTANCE = 3

/**
 * Perspective 4D -> 3D projection: drops w with distance-based scaling (the classic
 * rotating-tesseract look), rather than an orthographic drop-w. Vertices closer to the
 * viewer along w end up larger, matching how the 3D->2D analogue works one dimension down.
 */
export function projectTo3D(
  vertices: readonly Vec4[],
  viewerDistance: number = PROJECTION_VIEWER_DISTANCE,
): Point3[] {
  return vertices.map(([x, y, z, w]) => {
    const scale = viewerDistance / (viewerDistance - w)
    return { x: x * scale, y: y * scale, z: z * scale }
  })
}
