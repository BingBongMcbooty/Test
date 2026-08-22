import { SphereGeometry } from 'three'
import { useDimensionsStore } from '../state/store'

const markerGeometry = new SphereGeometry(0.06, 16, 16)

// Warm gold — the same hue `materials.ts` uses for the player's own drawn arrow
// (`#ffb454`), not `trackedVertex.ts`'s cyan: this marker represents the player's own
// cursor/input, a different kind of "tracked point" than Stage 3/4's fixed tracked
// vertex (a property of the shape itself, not of where the player is currently
// pointing).
const MARKER_COLOR = '#ffb454'

/**
 * Task 24: a small dot at `liveCursorPoint`'s current position — PLAN.md's explicit
 * ask for Stage 1 ("a visible dot marker rendered on the line itself at that projected
 * point"); extended to Stage 2 as well (left as this task's own call — PLAN.md's own
 * tunable note only describes the marker for Stage 1) since the same "see your own
 * shadow" idea reads just as usefully one dimension up and costs nothing new to build,
 * `CursorTracker.tsx` already producing the same `{x, y}` shape either way.
 *
 * Stage 1 pins the marker to the line itself (y locked at 0, per the "line is 1D"
 * framing — showing raw un-projected y here would contradict the "shadow onto the
 * line" idea the marker exists to sell); Stage 2 uses the live x and y both, since the
 * plane is 2D and both are real, reachable coordinates there.
 */
export function CursorMarker() {
  const stage = useDimensionsStore((state) => state.stage)
  const liveCursorPoint = useDimensionsStore((state) => state.liveCursorPoint)

  if ((stage !== 'line' && stage !== 'plane') || !liveCursorPoint) return null

  const position: readonly [number, number, number] =
    stage === 'line' ? [liveCursorPoint.x, 0, 0] : [liveCursorPoint.x, liveCursorPoint.y, 0]

  return (
    <mesh geometry={markerGeometry} position={position}>
      <meshBasicMaterial color={MARKER_COLOR} />
    </mesh>
  )
}
