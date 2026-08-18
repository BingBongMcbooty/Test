import { useMemo } from 'react'
import { BufferGeometry, Vector3 } from 'three'

/** Stage 1: a bare line segment along the occupied X axis. */
export function LineStage() {
  const geometry = useMemo(
    () => new BufferGeometry().setFromPoints([new Vector3(-1.5, 0, 0), new Vector3(1.5, 0, 0)]),
    [],
  )

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#e5e4e7" />
    </lineSegments>
  )
}
