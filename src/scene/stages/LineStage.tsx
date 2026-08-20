import { useMemo } from 'react'
import { BufferGeometry, Vector3 } from 'three'
import { SHAPE_POSITION } from '../shapePositions'

/**
 * Stage 1: a bare line segment along the occupied X axis. Task 16: the geometry itself
 * stays centered on its own local origin (unchanged from Task 5) and is positioned into
 * the positive octant via `SHAPE_POSITION.line` — the resulting world-space line runs
 * 0→3 along x, sitting fully within `Grid.tsx`'s new dotted-number-line grid rather than
 * half off it.
 */
export function LineStage() {
  const geometry = useMemo(
    () => new BufferGeometry().setFromPoints([new Vector3(-1.5, 0, 0), new Vector3(1.5, 0, 0)]),
    [],
  )

  return (
    <lineSegments geometry={geometry} position={SHAPE_POSITION.line}>
      <lineBasicMaterial color="#e5e4e7" />
    </lineSegments>
  )
}
