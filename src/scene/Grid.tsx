import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Line, LineDashedMaterial, Vector3 } from 'three'
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

/** A grid of lines covering `[0, extent]` in both directions of `plane`, at spacing `spacing`. */
function buildQuadrantGridGeometry(extent: number, spacing: number, plane: Plane): BufferGeometry {
  const positions: number[] = []
  const steps = Math.round(extent / spacing)

  for (let i = 0; i <= steps; i++) {
    const t = i * spacing
    positions.push(...planePoint(plane, t, 0), ...planePoint(plane, t, extent))
    positions.push(...planePoint(plane, 0, t), ...planePoint(plane, extent, t))
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function useQuadrantGrid(extent: number, spacing: number, plane: Plane): BufferGeometry {
  return useMemo(() => buildQuadrantGridGeometry(extent, spacing, plane), [extent, spacing, plane])
}

/** Stage 2: x/y graph paper the plane sits on top of. */
function PlaneGrid() {
  const geometry = useQuadrantGrid(PLANE_GRID_EXTENT, PLANE_GRID_SPACING, 'xy')
  return (
    <lineSegments geometry={geometry} position={[0, 0, -COPLANAR_EPSILON]}>
      <lineBasicMaterial color={GRID_COLOR} transparent opacity={GRID_OPACITY} />
    </lineSegments>
  )
}

/** Stage 3: floor (xy) + two walls (xz, yz) meeting at the origin, like a room corner. */
function CubeGrid() {
  const floor = useQuadrantGrid(CUBE_GRID_EXTENT, CUBE_GRID_SPACING, 'xy')
  const wallXZ = useQuadrantGrid(CUBE_GRID_EXTENT, CUBE_GRID_SPACING, 'xz')
  const wallYZ = useQuadrantGrid(CUBE_GRID_EXTENT, CUBE_GRID_SPACING, 'yz')

  return (
    <group>
      <lineSegments geometry={floor} position={[0, 0, -COPLANAR_EPSILON]}>
        <lineBasicMaterial color={GRID_COLOR} transparent opacity={GRID_OPACITY} />
      </lineSegments>
      <lineSegments geometry={wallXZ} position={[0, -COPLANAR_EPSILON, 0]}>
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

  switch (stage) {
    case 'line':
      return <LineGrid />
    case 'plane':
      return <PlaneGrid />
    case 'cube':
      return <CubeGrid />
    default:
      return null
  }
}
