/**
 * Pure math for Task 20's Stage 4 warm-up: an ordinary 3D cone, approximated as a
 * triangulated solid (an apex, an N-sided rim, and a base cap), cut by a fixed z=z0
 * plane using the same per-face edge-crossing technique `math/fourd.ts`'s
 * `sliceTesseract` uses for the tesseract — one dimension down, and with triangular
 * faces (3 edges, 0 or 2 crossings) in place of the tesseract's quads (4 edges). No
 * three.js dependency, and deliberately not sharing `fourd.ts`'s `Point3`/`Vec4` types —
 * this module's `Point3` describes an ordinary 3D solid, unrelated to a 4D one, same
 * "self-contained per feature" precedent `validation.ts`'s own `Vec3` type sets.
 */

/** A point in ordinary 3D space. */
export interface Point3 {
  x: number
  y: number
  z: number
}

/** A point in the z=z0 cutting plane's own (x, y) coordinates. */
export interface Point2 {
  x: number
  y: number
}

/** A triangular face of the cone's approximating solid: 3 vertex indices. */
export interface ConeFace {
  vertices: readonly [number, number, number]
}

/** An edge of the cone's approximating solid, as a pair of vertex indices. */
export interface ConeEdge {
  a: number
  b: number
}

/** One segment of the cross-section boundary, already flattened to the cutting plane's 2D. */
export interface SliceSegment {
  a: Point2
  b: Point2
}

/** Radial resolution of the cone approximation — enough to read as smoothly round. */
export const CONE_RADIAL_SEGMENTS = 28

/** The cone's own dimensions in its local frame: apex at +z, base ring at -z. */
export const CONE_RADIUS = 1
export const CONE_HEIGHT = 2

/**
 * Clamp range for the cutting plane's z0 offset. The cone spans z in [-1, 1]
 * (`CONE_HEIGHT / 2` either way) — +-1.4 comfortably covers the whole range, including
 * where the cross-section shrinks to a point or vanishes, without letting the plane
 * drag indefinitely into empty space.
 */
export const CONE_SLICE_RANGE = 1.4

const APEX_INDEX = 0
const BASE_CENTER_INDEX = CONE_RADIAL_SEGMENTS + 1

function rimIndex(i: number): number {
  return 1 + (i % CONE_RADIAL_SEGMENTS)
}

/**
 * The cone's vertices in its own local frame: apex at index 0 (z = +HEIGHT/2), a ring
 * of `CONE_RADIAL_SEGMENTS` rim vertices at z = -HEIGHT/2 (indices 1..N), and the base
 * center at index N+1 (also z = -HEIGHT/2) — generated rather than hardcoded, same
 * approach `fourd.ts`'s `generateFaces`/`generateEdges` use for the tesseract.
 */
function buildConeVertices(): Point3[] {
  const vertices: Point3[] = [{ x: 0, y: 0, z: CONE_HEIGHT / 2 }]
  for (let i = 0; i < CONE_RADIAL_SEGMENTS; i++) {
    const theta = (i / CONE_RADIAL_SEGMENTS) * Math.PI * 2
    vertices.push({
      x: CONE_RADIUS * Math.cos(theta),
      y: CONE_RADIUS * Math.sin(theta),
      z: -CONE_HEIGHT / 2,
    })
  }
  vertices.push({ x: 0, y: 0, z: -CONE_HEIGHT / 2 })
  return vertices
}

/** All of the cone approximation's vertices, in its own untilted local frame. */
export const CONE_VERTICES: Point3[] = buildConeVertices()

/**
 * The cone's triangular faces: `CONE_RADIAL_SEGMENTS` side faces (apex + two adjacent
 * rim points) and the same number of base-cap faces (base center + two adjacent rim
 * points), together forming one closed triangulated surface.
 */
function buildConeFaces(): ConeFace[] {
  const faces: ConeFace[] = []
  for (let i = 0; i < CONE_RADIAL_SEGMENTS; i++) {
    faces.push({ vertices: [APEX_INDEX, rimIndex(i), rimIndex(i + 1)] })
    faces.push({ vertices: [BASE_CENTER_INDEX, rimIndex(i + 1), rimIndex(i)] })
  }
  return faces
}

/** All of the cone approximation's triangular faces. */
export const CONE_FACES: ConeFace[] = buildConeFaces()

/** Wireframe edges for rendering — apex-to-rim, the rim ring, and base-to-rim spokes. */
function buildConeEdges(): ConeEdge[] {
  const edges: ConeEdge[] = []
  for (let i = 0; i < CONE_RADIAL_SEGMENTS; i++) {
    edges.push({ a: APEX_INDEX, b: rimIndex(i) })
    edges.push({ a: rimIndex(i), b: rimIndex(i + 1) })
    edges.push({ a: BASE_CENTER_INDEX, b: rimIndex(i) })
  }
  return edges
}

/** All of the cone approximation's edges, for `THREE.LineSegments` wireframe rendering. */
export const CONE_EDGES: ConeEdge[] = buildConeEdges()

/**
 * Tilts the cone about the x-axis by `angle`, mixing y into z. Mirrors `fourd.ts`'s
 * `rotate2D`, kept local rather than imported since this module otherwise has no
 * dependency on `fourd.ts`'s 4D-specific concepts. Tilting the solid (rather than
 * tilting the cutting plane against a fixed solid) against a fixed z=z0 plane is what
 * actually varies the conic section produced: an upright, untilted cone sliced by any
 * horizontal plane only ever produces a circle, the exact "always a box" degeneracy
 * `fourd.ts`'s `rotateYW` doc comment describes one dimension up — here a single tilt
 * axis is already enough to break it, since (unlike the tesseract's w-slicing) the
 * cutting plane's normal is fixed at z regardless of rotation, and tilting the cone is
 * what lets that fixed normal cross the cone's surface at a genuinely different angle.
 */
export function tiltCone(vertices: readonly Point3[], angle: number): Point3[] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return vertices.map(({ x, y, z }) => ({
    x,
    y: y * c - z * s,
    z: y * s + z * c,
  }))
}

function edgeCrossing(a: Point3, b: Point3, z0: number): Point2 | null {
  if (a.z === b.z) return null
  const t = (z0 - a.z) / (b.z - a.z)
  if (t < 0 || t > 1) return null
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/**
 * Cross-section of the cone's triangulated surface at the fixed plane z = z0, via the
 * same per-face edge-crossing method `fourd.ts`'s `sliceTesseract` uses: a triangular
 * face crossed by the plane has exactly 2 of its 3 edges cross it, and those 2 points
 * become one output segment. Faces entirely on one side contribute nothing, and a
 * near-apex slice naturally degenerates to a cluster of near-zero-length segments
 * right at the apex point — no special-casing needed for the "just a point" case PLAN.md
 * calls for.
 */
export function sliceCone(
  vertices: readonly Point3[],
  faces: readonly ConeFace[],
  z0: number,
): SliceSegment[] {
  const segments: SliceSegment[] = []

  for (const face of faces) {
    const corners = face.vertices.map((i) => vertices[i])
    const crossings: Point2[] = []
    for (let i = 0; i < 3; i++) {
      const point = edgeCrossing(corners[i], corners[(i + 1) % 3], z0)
      if (point) crossings.push(point)
    }
    if (crossings.length === 2) segments.push({ a: crossings[0], b: crossings[1] })
  }

  return segments
}
