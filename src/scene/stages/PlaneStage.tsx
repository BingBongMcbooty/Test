import { useMemo } from 'react'
import { EdgesGeometry, PlaneGeometry } from 'three'
import { usePlaneFillMaterial } from '../materials'
import { SHAPE_POSITION } from '../shapePositions'

/**
 * Stage 2: the wireframe square from Task 5 stays primary, plus Task 7's transitional
 * fill — a faint, low-opacity lit/animated surface (see `scene/materials.ts`) sitting
 * behind the outline as a first hint of the shading/texture detail coming in Stage 3.
 * EdgesGeometry (not meshBasicMaterial wireframe) still excludes PlaneGeometry's
 * coplanar triangle diagonal, per Task 5's note. Task 16: the group is positioned via
 * `SHAPE_POSITION.plane` so the plane (geometry itself unchanged, still centered on its
 * own local origin) sits fully in the positive-x/y quadrant, matching `Grid.tsx`'s new
 * graph-paper grid instead of straddling it.
 */
export function PlaneStage() {
  const planeGeometry = useMemo(() => new PlaneGeometry(3, 3), [])
  const edges = useMemo(() => new EdgesGeometry(planeGeometry), [planeGeometry])
  const fillMaterial = usePlaneFillMaterial()

  return (
    <group position={SHAPE_POSITION.plane}>
      <mesh geometry={planeGeometry}>
        <primitive object={fillMaterial} attach="material" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e5e4e7" />
      </lineSegments>
    </group>
  )
}
