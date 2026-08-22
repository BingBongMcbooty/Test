import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { useDimensionsStore } from '../state/store'

// The world plane the line (Stage 1) and plane (Stage 2) shapes both actually lie in
// (`LineStage.tsx`/`PlaneStage.tsx` both sit at local z=0, and `shapePositions.ts`'s
// offsets never touch z) — a fixed plane, not `math/dragPlane.ts`'s camera-facing one.
// A cursor's "shadow" on the line/plane should read as a literal world (x, y)
// coordinate matching `Grid.tsx`'s coordinate-space grid, regardless of whether Stage
// 2's camera has been tilted away from dead-on (Task 23) — the camera-facing plane
// `ArrowDrag.tsx` uses for the actual attempt is deliberately a different, tilting
// surface, which is right for a drag but wrong for this literal-coordinate readout.
const WORLD_XY_PLANE = new Plane(new Vector3(0, 0, 1), 0)

/**
 * Task 24: continuous cursor-position tracking for Stages 1-2, independent of any
 * active drag. Unlike `ArrowDrag.tsx`'s pointer-move handler (only listening between a
 * `pointerdown` on the shape's collider and the matching `pointerup`), this listens on
 * `window` for the whole time the stage is line/plane, so a plain hover — no click —
 * keeps `liveCursorPoint` live. That's the fix for the problem PLAN.md's Task 24 row
 * names directly: `ui/DimensionPanel.tsx`'s axis ledger used to reflect only
 * `liveDragVector`, which is `null` at rest.
 *
 * Raycasts every `pointermove` onto the fixed `WORLD_XY_PLANE` above (not a
 * camera-facing one) and writes the resulting world-space hit to the store as-is;
 * `ui/DimensionPanel.tsx` and `CursorMarker.tsx` are the ones that decide which
 * component(s) of it are relevant for the current stage (just `x` for the line, both
 * `x`/`y` for the plane).
 */
export function CursorTracker() {
  const stage = useDimensionsStore((state) => state.stage)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const raycaster = useMemo(() => new Raycaster(), [])
  const setLiveCursorPoint = useDimensionsStore((state) => state.setLiveCursorPoint)

  useEffect(() => {
    if (stage !== 'line' && stage !== 'plane') {
      setLiveCursorPoint(null)
      return
    }

    function onPointerMove(event: PointerEvent) {
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = new Vector3()
      const result = raycaster.ray.intersectPlane(WORLD_XY_PLANE, hit)
      setLiveCursorPoint(result ? { x: hit.x, y: hit.y, z: 0 } : null)
    }

    window.addEventListener('pointermove', onPointerMove)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      setLiveCursorPoint(null)
    }
  }, [stage, camera, gl, raycaster, setLiveCursorPoint])

  return null
}
