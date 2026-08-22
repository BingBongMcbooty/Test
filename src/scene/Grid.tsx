import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Line, LineDashedMaterial, Vector3 } from 'three'
import type { AxisSign } from '../state/stageConfig'
import { useDimensionsStore } from '../state/store'

/**
 * Task 16: a background reference grid per stage, restricted to the positive octant to
 * match the positive-octant repositioning in `shapePositions.ts` — the space a player
 * can draw into is exactly the space the grid covers, "like standing in the corner of a
 * room" per PLAN.md, rather than a symmetric grid extending in every direction (noisier,
 * no obvious "edge"). Each stage's extent runs a bit past its shape (see the per-grid
 * constants below) so the shape reads as fully contained rather than right at the edge.
 * Reveal/closing get no grid — Task 16 is scoped to Stages 1-3's polish, per PLAN.md.
 */

const GRID_COLOR = '#4a4a63'
const GRID_OPACITY = 0.45

// Stage 1: a dotted number-line along x, the line (0→3, `shapePositions.ts`) sits on
// top of. Slightly past the line's far end so the line reads as sitting within it, not
// right at its edge.
const LINE_GRID_EXTENT = 4.5
const LINE_DOT_SIZE = 0.06
const LINE_DOT_GAP = 0.14

// Stage 2: x/y graph paper in the plane's own z=0 plane, extending a bit past the
// plane's 0→3 edges.
const PLANE_GRID_EXTENT = 4.5
const PLANE_GRID_SPACING = 0.75

// Stage 3: three grid-planes (floor xy, wall xz, wall yz) meeting at the world origin —
// the same corner the cube (0→2.5 each axis, `shapePositions.ts`) has one of its own
// corners pinned to. Sparser spacing than the plane grid since three overlapping planes
// read as busier at the same density.
const CUBE_GRID_EXTENT = 4
const CUBE_GRID_SPACING = 1

// Pulled back a hair behind each stage's shape (away from the default camera) so
// coplanar grid lines and shape surfaces don't z-fight — the grid should read as sitting
// just behind the shape, not fighting with it for the same pixels.
const COPLANAR_EPSILON = 0.01

function useDottedLine(): Line {
  return useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0),
      new Vector3(LINE_GRID_EXTENT, 0, 0),
    ])
    const material = new LineDashedMaterial({
      color: GRID_COLOR,
      transparent: true,
      opacity: GRID_OPACITY,
      dashSize: LINE_DOT_SIZE,
      gapSize: LINE_DOT_GAP,
    })
    const line = new Line(geometry, material)
    line.computeLineDistances()
    return line
  }, [])
}

/** Stage 1: dotted number-line the line sits on top of. */
function LineGrid() {
  const line = useDottedLine()
  return <primitive object={line} position={[0, 0, -COPLANAR_EPSILON]} />
}

type Plane = 'xy' | 'xz' | 'yz'

function planePoint(plane: Plane, a: number, b: number): [number, number, number] {
  switch (plane) {
    case 'xy':
      return [a, b, 0]
    case 'xz':
      return [a, 0, b]
    case 'yz':
      return [0, a, b]
  }
}

/**
 * A grid of lines covering `[0, magnitude*signA]`/`[0, magnitude*signB]` in `plane`'s
 * two directions, at spacing `spacing`. Post-Task-25: `signA`/`signB` (each ±1) mirror
 * the grid to match wherever the shape it's the backdrop for actually mirrored to (see
 * `state/stageConfig.ts`'s `AxisSign` doc comment) — at `signA = signB = 1` this
 * reproduces the original always-positive-quadrant grid exactly.
 */
function buildQuadrantGridGeometry(
  magnitude: number,
  spacing: number,
  plane: Plane,
  signA: 1 | -1,
  signB: 1 | -1,
): BufferGeometry {
  const positions: number[] = []
  const steps = Math.round(magnitude / spacing)
  const extentA = magnitude * signA
  const extentB = magnitude * signB

  for (let i = 0; i <= steps; i++) {
    const t = i * spacing
    positions.push(...planePoint(plane, t * signA, 0), ...planePoint(plane, t * signA, extentB))
    positions.push(...planePoint(plane, 0, t * signB), ...planePoint(plane, extentA, t * signB))
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function useQuadrantGrid(
  magnitude: number,
  spacing: number,
  plane: Plane,
  signA: 1 | -1,
  signB: 1 | -1,
): BufferGeometry {
  return useMemo(
    () => buildQuadrantGridGeometry(magnitude, spacing, plane, signA, signB),
    [magnitude, spacing, plane, signA, signB],
  )
}

/**
 * Stage 2: x/y graph paper the plane sits on top of. `x` never mirrors (see
 * `state/stageConfig.ts`'s `AxisSign` doc comment) — only `y`, via `axisSign.y`. The
 * z-pullback epsilon stays fixed (the plane's own z is never mirrored, so "away from
 * the camera" is always -z here regardless of `axisSign`).
 */
function PlaneGrid({ axisSign }: { axisSign: AxisSign }) {
  const geometry = useQuadrantGrid(PLANE_GRID_EXTENT, PLANE_GRID_SPACING, 'xy', 1, axisSign.y)
  return (
    <lineSegments geometry={geometry} position={[0, 0, -COPLANAR_EPSILON]}>
      <lineBasicMaterial color={GRID_COLOR} transparent opacity={GRID_OPACITY} />
    </lineSegments>
  )
}

/**
 * Stage 3: floor (xy) + two walls (xz, yz) meeting at the cube's own corner — post-
 * Task-25, that corner is wherever `axisSign` mirrored the cube to, not always the
 * world origin. Each wall's pullback epsilon flips sign along with whichever axis it's
 * offset on, since a mirrored cube also gets a mirrored camera (`cameraFraming.ts`'s
 * `cameraPositionTarget`) — "away from the camera" flips right along with it. The `x`
 * pullback (`wallYZ`) never flips: `x` itself never mirrors.
 */
function CubeGrid({ axisSign }: { axisSign: AxisSign }) {
  const floor = useQuadrantGrid(CUBE_GRID_EXTENT, CUBE_GRID_SPACING, 'xy', 1, axisSign.y)
  const wallXZ = useQuadrantGrid(CUBE_GRID_EXTENT, CUBE_GRID_SPACING, 'xz', 1, axisSign.z)
  const wallYZ = useQuadrantGrid(CUBE_GRID_EXTENT, CUBE_GRID_SPACING, 'yz', axisSign.y, axisSign.z)

  return (
    <group>
      <lineSegments geometry={floor} position={[0, 0, -COPLANAR_EPSILON * axisSign.z]}>
        <lineBasicMaterial color={GRID_COLOR} transparent opacity={GRID_OPACITY} />
      </lineSegments>
      <lineSegments geometry={wallXZ} position={[0, -COPLANAR_EPSILON * axisSign.y, 0]}>
        <lineBasicMaterial color={GRID_COLOR} transparent opacity={GRID_OPACITY} />
      </lineSegments>
      <lineSegments geometry={wallYZ} position={[-COPLANAR_EPSILON, 0, 0]}>
        <lineBasicMaterial color={GRID_COLOR} transparent opacity={GRID_OPACITY} />
      </lineSegments>
    </group>
  )
}

/** Per-stage coordinate-space background grid — see the module doc comment above. */
export function Grid() {
  const stage = useDimensionsStore((state) => state.stage)
  const axisSign = useDimensionsStore((state) => state.axisSign)

  switch (stage) {
    case 'line':
      return <LineGrid />
    case 'plane':
      return <PlaneGrid axisSign={axisSign} />
    case 'cube':
      return <CubeGrid axisSign={axisSign} />
    default:
      return null
  }
}
