import { useMemo } from 'react'
import { ConeGeometry, CylinderGeometry, Quaternion, Vector3 } from 'three'
import { useDimensionsStore } from '../state/store'
import { useArrowMaterial } from './materials'

const SHAFT_RADIUS = 0.035
const HEAD_RADIUS = 0.09
const HEAD_LENGTH = 0.22
const MIN_LENGTH = 1e-4

const UP = new Vector3(0, 1, 0)

// Unit-sized (radius 1, height 1) and reused across every arrow instance — per-arrow
// shape comes from scaling/positioning the mesh, not rebuilding the geometry, since
// Task 10 will update `start`/`end` on every pointer-move during a drag.
const shaftGeometry = new CylinderGeometry(1, 1, 1, 12)
const headGeometry = new ConeGeometry(1, 1, 16)

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

  const transform = useMemo(() => {
    const delta = end.clone().sub(start)
    const length = delta.length()
    if (length < MIN_LENGTH) return null

    const direction = delta.clone().normalize()
    const quaternion = new Quaternion().setFromUnitVectors(UP, direction)
    const headLength = Math.min(HEAD_LENGTH, length * 0.5)
    const shaftLength = length - headLength

    return {
      quaternion,
      shaftScale: new Vector3(SHAFT_RADIUS, shaftLength, SHAFT_RADIUS),
      shaftPosition: start.clone().addScaledVector(direction, shaftLength / 2),
      headScale: new Vector3(HEAD_RADIUS, headLength, HEAD_RADIUS),
      headPosition: start.clone().addScaledVector(direction, shaftLength + headLength / 2),
    }
  }, [start, end])

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
