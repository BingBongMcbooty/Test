import { useMemo } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import { useCubeMaterial } from '../materials'
import { cubePosition } from '../shapePositions'
import { useDimensionsStore } from '../../state/store'

/**
 * Stage 3: the full richness treatment from Task 7 — a procedural multi-light,
 * noise/fresnel shader material (see `scene/materials.ts`) replacing Task 5's flat
 * `MeshStandardMaterial`, still translucent/no-depth-write/double-sided so the far side
 * of the cube — and a mid-drag arrow inside it — stay legible from any orbit angle,
 * plus the same thin wireframe edge overlay for definition. Task 16: the group is
 * positioned via `cubePosition()` so the cube (geometry itself unchanged, still
 * centered on its own local origin) sits with one corner at the world origin — the same
 * corner `Grid.tsx`'s three grid planes meet at, "like standing in the corner of a
 * room" per PLAN.md. Post-Task-25: which corner/octant comes from the live `axisSign`
 * store field — see `state/stageConfig.ts`'s `AxisSign` doc comment.
 */
export function CubeStage() {
  const axisSign = useDimensionsStore((state) => state.axisSign)
  const geometry = useMemo(() => new BoxGeometry(2.5, 2.5, 2.5), [])
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry])
  const material = useCubeMaterial()

  return (
    <group position={cubePosition(axisSign)}>
      <mesh geometry={geometry}>
        <primitive object={material} attach="material" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e5e4e7" />
      </lineSegments>
    </group>
  )
}
