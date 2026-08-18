import { useMemo } from 'react'
import { BoxGeometry, DoubleSide, EdgesGeometry } from 'three'

/**
 * Stage 3: solid, lit faces with a translucent fill (low opacity, no depth-write, both
 * sides rendered) so the far side of the cube — and a mid-drag arrow inside it — stay
 * legible from any orbit angle, plus a thin wireframe edge overlay for definition.
 */
export function CubeStage() {
  const geometry = useMemo(() => new BoxGeometry(2.5, 2.5, 2.5), [])
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#5858a0"
          transparent
          opacity={0.45}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e5e4e7" />
      </lineSegments>
    </group>
  )
}
