import { useMemo } from 'react'
import { EdgesGeometry, PlaneGeometry } from 'three'

/**
 * Stage 2: a wireframe square spanning the occupied X/Y plane. EdgesGeometry (not
 * meshBasicMaterial wireframe) so the diagonal from PlaneGeometry's two triangles is
 * excluded — its coplanar edge has a 0deg angle, under EdgesGeometry's threshold.
 */
export function PlaneStage() {
  const edges = useMemo(() => new EdgesGeometry(new PlaneGeometry(3, 3)), [])

  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial color="#e5e4e7" />
    </lineSegments>
  )
}
