import { useMemo } from 'react'
import { CHIRALITY_PARTS } from '../math/chirality'
import { PROJECTION_VIEWER_DISTANCE, applyRevealRotation, projectTo3D } from '../math/fourd'
import { useDimensionsStore } from '../state/store'

/**
 * Visual scale applied to `math/chirality.ts`'s local part sizes/anchors — picked to
 * roughly match `RevealStage.tsx`'s `TESSERACT_SCALE`, same reasoning as `SliceWarmup`'s
 * `CONE_SCALE`: this demo hands off to/from the same reveal-stage camera framing, so it
 * shouldn't jump size when the player switches views.
 */
const CHIRALITY_SCALE = 1.9

const PALM_COLOR = '#caa27a'
const FINGER_COLOR = '#e2c39a'

/**
 * Task 21: the chirality/mirror-flip demo. Reads the exact same `revealRotationXW`/
 * `revealRotationYW` store state `RevealStage.tsx`'s tesseract already reads (both are
 * driven by the same `RevealDrag.tsx` controller regardless of which `revealView` is
 * showing — see `state/store.ts`), and runs each part's rest anchor through
 * `applyRevealRotation`/`projectTo3D` verbatim — no new rotation or projection math, only
 * new geometry (see `math/chirality.ts`).
 *
 * Each part is treated as a rigid "fat point" rather than a fully-deformed mesh: its
 * *center* is rotated/projected exactly like `RevealStage.tsx`'s tracked-vertex marker
 * is, and the same w-dependent perspective factor `projectTo3D` applies to that center's
 * position is also applied as a uniform scale on the part's own mesh. This is what
 * produces PLAN.md's "different parts warp at different rates" tell: parts at different
 * rest-x values pick up different w as they rotate through (see `chirality.test.ts`), so
 * their scale factors diverge mid-turn and settle back to a uniform 1 (and an exact
 * x-mirror) at a full 180°.
 *
 * A plain `meshStandardMaterial` (not `materials.ts`'s hand-rolled shader system) is
 * enough here — the reveal stage's real `<directionalLight>`s already light this stage
 * (`Experience.tsx`'s `SceneLights`), and a solid, non-wireframe read is exactly what
 * PLAN.md's deliverable asks for.
 */
export function ChiralityDemo() {
  const revealRotationXW = useDimensionsStore((state) => state.revealRotationXW)
  const revealRotationYW = useDimensionsStore((state) => state.revealRotationYW)

  const rotatedAnchors = useMemo(
    () =>
      applyRevealRotation(
        CHIRALITY_PARTS.map((part) => part.anchor),
        revealRotationXW,
        revealRotationYW,
      ),
    [revealRotationXW, revealRotationYW],
  )

  const projected = useMemo(() => projectTo3D(rotatedAnchors), [rotatedAnchors])

  return (
    <>
      {CHIRALITY_PARTS.map((part, i) => {
        const w = rotatedAnchors[i][3]
        const scale = PROJECTION_VIEWER_DISTANCE / (PROJECTION_VIEWER_DISTANCE - w)
        const point = projected[i]
        const position: [number, number, number] = [
          point.x * CHIRALITY_SCALE,
          point.y * CHIRALITY_SCALE,
          point.z * CHIRALITY_SCALE,
        ]
        const size: [number, number, number] = [
          part.size[0] * CHIRALITY_SCALE,
          part.size[1] * CHIRALITY_SCALE,
          part.size[2] * CHIRALITY_SCALE,
        ]

        return (
          <mesh key={i} position={position} scale={scale}>
            {part.shape === 'box' ? (
              <boxGeometry args={size} />
            ) : (
              <cylinderGeometry args={[size[0], size[0], size[2], 14]} />
            )}
            <meshStandardMaterial
              color={i === 0 ? PALM_COLOR : FINGER_COLOR}
              roughness={0.55}
              metalness={0.05}
            />
          </mesh>
        )
      })}
    </>
  )
}
