import { useMemo } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import { useCubeMaterial } from '../materials'

/**
 * Stage 3: the full richness treatment from Task 7 — a procedural multi-light,
 * noise/fresnel shader material (see `scene/materials.ts`) replacing Task 5's flat
 * `MeshStandardMaterial`, still translucent/no-depth-write/double-sided so the far side
 * of the cube — and a mid-drag arrow inside it — stay legible from any orbit angle,
 * plus the same thin wireframe edge overlay for definition.
 */
export function CubeStage() {
  const geometry = useMemo(() => new BoxGeometry(2.5, 2.5, 2.5), [])
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry])
  const material = useCubeMaterial()

  return (
    <group>
      <mesh geometry={geometry}>
        <primitive object={material} attach="material" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e5e4e7" />
      </lineSegments>
    </group>
  )
}
