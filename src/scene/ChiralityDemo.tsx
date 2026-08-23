import { useMemo } from 'react'
import { CHIRALITY_PARTS, type ChiralityPartRole } from '../math/chirality'
import { PROJECTION_VIEWER_DISTANCE, applyRevealRotation, projectTo3D } from '../math/fourd'
import { useDimensionsStore } from '../state/store'

/**
 * Visual scale applied to `math/chirality.ts`'s local part sizes/anchors — picked to
 * roughly match `RevealStage.tsx`'s `TESSERACT_SCALE`, same reasoning as `SliceWarmup`'s
 * `CONE_SCALE`: this demo hands off to/from the same reveal-stage camera framing, so it
 * shouldn't jump size when the player switches views.
 */
const CHIRALITY_SCALE = 1.9

const ROLE_COLOR: Record<ChiralityPartRole, string> = {
  base: '#caa27a',
  digit: '#e2c39a',
  joint: '#d9b58c',
}

/**
 * Task 21: the chirality/mirror-flip demo. Reads the exact same `revealRotationXW`/
 * `revealRotationYW` store state `RevealStage.tsx`'s tesseract already reads (both are
 * driven by the same `RevealDrag.tsx` controller regardless of which `revealView` is
 * showing — see `state/store.ts`), and runs each part's rest anchor through
 * `applyRevealRotation`/`projectTo3D` verbatim — no new rotation or projection math, only
 * geometry (see `math/chirality.ts`).
 *
 * Each part is treated as a rigid "fat point" rather than a fully-deformed mesh: its
 * *center* is rotated/projected exactly like `RevealStage.tsx`'s tracked-vertex marker
 * is, and the same w-dependent perspective factor `projectTo3D` applies to that center's
 * position is also applied as a uniform scale on the part's own mesh. This is what
 * produces PLAN.md's "different parts warp at different rates" tell: parts at different
 * rest-x values pick up different w as they rotate through (see `chirality.test.ts`), so
 * their scale factors diverge mid-turn and settle back to a uniform 1 (and an exact
 * x-mirror) at a full 180°. Task 27's finer-grained part list (a separate knuckle joint
 * per digit) makes that warp gradient read as more continuous across the hand than the
 * original 6-part version did.
 *
 * `'ellipsoid'` parts need a second, *non-uniform* local scale (their own [rx,ry,rz]
 * radii) layered underneath the shared w-perspective scale above — the two can't share
 * one `scale` prop, so ellipsoid parts wrap an inner `<mesh>` (the local shape) inside an
 * outer `<group>` (the shared position + w-scale), while capsule parts — whose radius/
 * length are already baked into their geometry args — stay a single `<mesh>`.
 *
 * `meshPhysicalMaterial` (a touch of clearcoat, still no `materials.ts` shader) gives the
 * hand a soft, slightly glove-like sheen distinct from both the shapes' cool indigo/
 * violet and the arrow's gold — the reveal stage's real `<directionalLight>`s
 * (`Experience.tsx`'s `SceneLights`) already light it, so a real lit material is simpler
 * than replicating the shader rig's light uniforms for a shape that doesn't need Task 7's
 * animated-noise treatment.
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
        const rotation = part.rotation ?? [0, 0, 0]
        const color = ROLE_COLOR[part.role]
        const material = <meshPhysicalMaterial color={color} roughness={0.5} clearcoat={0.2} />

        if (part.shape === 'ellipsoid') {
          const [rx, ry, rz] = part.size
          return (
            <group key={i} position={position} scale={scale}>
              <mesh
                scale={[rx * CHIRALITY_SCALE, ry * CHIRALITY_SCALE, rz * CHIRALITY_SCALE]}
                rotation={rotation}
              >
                <sphereGeometry args={[1, 24, 18]} />
                {material}
              </mesh>
            </group>
          )
        }

        const [radius, length] = part.size
        return (
          <mesh key={i} position={position} scale={scale} rotation={rotation}>
            <capsuleGeometry args={[radius * CHIRALITY_SCALE, length * CHIRALITY_SCALE, 4, 12]} />
            {material}
          </mesh>
        )
      })}
    </>
  )
}
