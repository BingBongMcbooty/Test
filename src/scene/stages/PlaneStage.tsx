import { useMemo } from 'react'
import { EdgesGeometry, PlaneGeometry } from 'three'
import { usePlaneFillMaterial } from '../materials'
import { planePosition } from '../shapePositions'
import { useDimensionsStore } from '../../state/store'

/**
 * Stage 2: the wireframe square from Task 5 stays primary, plus Task 7's transitional
 * fill — a faint, low-opacity lit/animated surface (see `scene/materials.ts`) sitting
 * behind the outline as a first hint of the shading/texture detail coming in Stage 3.
 * EdgesGeometry (not meshBasicMaterial wireframe) still excludes PlaneGeometry's
 * coplanar triangle diagonal, per Task 5's note. Task 16: the group is positioned via
 * `planePosition()` so the plane (geometry itself unchanged, still centered on its own
 * local origin) sits fully in the x/y quadrant matching `Grid.tsx`'s graph-paper grid.
 * Post-Task-25: which quadrant (+y or -y) comes from the live `axisSign` store field —
 * see `state/stageConfig.ts`'s `AxisSign` doc comment.
 */
export function PlaneStage() {
  const axisSign = useDimensionsStore((state) => state.axisSign)
  const planeGeometry = useMemo(() => new PlaneGeometry(3, 3), [])
  const edges = useMemo(() => new EdgesGeometry(planeGeometry), [planeGeometry])
  const fillMaterial = usePlaneFillMaterial()

  return (
    <group position={planePosition(axisSign)}>
      <mesh geometry={planeGeometry}>
        <primitive object={fillMaterial} attach="material" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e5e4e7" />
      </lineSegments>
    </group>
  )
}
