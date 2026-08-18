import { useMemo } from 'react'
import type { Vector3 } from 'three'
import { useDimensionsStore } from '../state/store'
import { computeArrowTransform, headGeometry, shaftGeometry } from './arrowGeometry'
import { useArrowMaterial } from './materials'

export interface LiveArrowProps {
  start: Vector3
  end: Vector3
}

/**
 * Shaft + cone arrow between two points, oriented from `start` toward `end`. Material
 * comes from `useArrowMaterial` (see `scene/materials.ts`), which reads the current
 * stage so the arrow's richness escalates alongside Task 7's line->plane->cube
 * progression instead of having one fixed look. `start`/`end` are plain props for now —
 * Task 10 feeds these from real drag input instead of a debug harness.
 */
export function LiveArrow({ start, end }: LiveArrowProps) {
  const stage = useDimensionsStore((state) => state.stage)
  const material = useArrowMaterial(stage)

  const transform = useMemo(() => computeArrowTransform(start, end), [start, end])

  if (!transform) return null

  return (
    <group>
      <mesh
        geometry={shaftGeometry}
        position={transform.shaftPosition}
        quaternion={transform.quaternion}
        scale={transform.shaftScale}
      >
        <primitive object={material} attach="material" />
      </mesh>
      <mesh
        geometry={headGeometry}
        position={transform.headPosition}
        quaternion={transform.quaternion}
        scale={transform.headScale}
      >
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  )
}
