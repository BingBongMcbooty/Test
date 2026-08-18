import { useMemo } from 'react'
import { MeshBasicMaterial, Timer, Vector3 } from 'three'
import { computeArrowTransform, headGeometry, shaftGeometry } from './arrowGeometry'

/**
 * Seconds the fail cue takes to fully fade — `ArrowDrag` mirrors this in the
 * `setTimeout` that unmounts this component, so the two stay in sync.
 */
export const FAIL_CUE_DURATION = 0.45
const FAIL_COLOR = '#ff5252'

// Same reasoning as `materials.ts`'s `withTimeUniform`: mutating a `useMemo`-produced
// material from a sibling hook's callback (e.g. `useFrame`) trips
// `eslint-plugin-react-hooks`'s compiler-based immutability check ("modifying a value
// returned from a hook is not allowed"). Setting `onBeforeRender` here, during the
// material's own construction, sidesteps it — the mutation happens inside a plain
// three.js callback, not across a hook boundary.
function withFadeFlicker(material: MeshBasicMaterial): MeshBasicMaterial {
  const timer = new Timer()
  material.onBeforeRender = () => {
    timer.update()
    const t = Math.min(timer.getElapsed() / FAIL_CUE_DURATION, 1)
    // Flickers a couple of times while fading out, rather than a plain linear fade.
    const flicker = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 5))
    material.opacity = (1 - t) * flicker
  }
  return material
}

export interface FailCueArrowProps {
  start: Vector3
  end: Vector3
}

/**
 * Frozen copy of a just-finished drag that flashes red and fades out — the "fail" cue
 * for a drag whose `evaluateAttempt` result didn't clear the orthogonality threshold.
 * Uses its own plain `MeshBasicMaterial` rather than `LiveArrow`'s stage-driven shader
 * (`useArrowMaterial` in `scene/materials.ts`) since this needs direct opacity/color
 * control that the shader's uniforms don't expose, and per-stage richness isn't
 * relevant to a cue that's about to disappear. `ArrowDrag` owns unmounting this
 * component after `FAIL_CUE_DURATION` — it doesn't remove itself.
 */
export function FailCueArrow({ start, end }: FailCueArrowProps) {
  const transform = useMemo(() => computeArrowTransform(start, end), [start, end])
  const shaftMaterial = useMemo(
    () => withFadeFlicker(new MeshBasicMaterial({ color: FAIL_COLOR, transparent: true })),
    [],
  )
  const headMaterial = useMemo(
    () => withFadeFlicker(new MeshBasicMaterial({ color: FAIL_COLOR, transparent: true })),
    [],
  )

  if (!transform) return null

  return (
    <group>
      <mesh
        geometry={shaftGeometry}
        position={transform.shaftPosition}
        quaternion={transform.quaternion}
        scale={transform.shaftScale}
      >
        <primitive object={shaftMaterial} attach="material" />
      </mesh>
      <mesh
        geometry={headGeometry}
        position={transform.headPosition}
        quaternion={transform.quaternion}
        scale={transform.headScale}
      >
        <primitive object={headMaterial} attach="material" />
      </mesh>
    </group>
  )
}
