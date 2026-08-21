import {
  PROJECTION_VIEWER_DISTANCE,
  TESSERACT_EDGES,
  TESSERACT_FACES,
  TESSERACT_VERTICES,
  applyRevealRotation,
  sliceTesseract,
} from '../math/fourd'
import { evaluateAttempt } from '../math/validation'
import { TRACKED_VERTEX_COLOR, TRACKED_VERTEX_INDEX } from '../scene/trackedVertex'
import { useDimensionsStore } from '../state/store'
import { STAGE_CONFIG, STAGE_SHAPE_COUNTS, type Axis } from '../state/stageConfig'

const AXES: readonly Axis[] = ['x', 'y', 'z']
const LOCKED_LABEL = 'Unknown, unreachable'
/** A real value that exists, but the current view's lens doesn't show it — see Task 19. */
const SLICED_AWAY_LABEL = 'sliced away'
const HIDDEN_BEHIND_SHADOW_LABEL = 'hidden behind the shadow'

function formatNumber(value: number): string {
  return value.toFixed(2)
}

function formatDegrees(radians: number): string {
  return `${((radians * 180) / Math.PI).toFixed(1)}°`
}

const panelContainerStyle = {
  position: 'absolute',
  top: '1.5rem',
  right: '1.5rem',
  minWidth: '11rem',
  padding: '0.75rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: '0.72rem',
  letterSpacing: '0.02em',
  color: '#e5e4e7',
  background: 'rgba(10, 10, 15, 0.55)',
  border: '1px solid rgba(229, 228, 231, 0.25)',
  borderRadius: '0.5rem',
  pointerEvents: 'none',
} as const

/**
 * Task 19: extends the panel for the reveal stage — rotation (in degrees, per PLAN.md,
 * not the store's raw radians), the slice offset, the tracked tesseract vertex's live
 * x/y/z/w (reusing Task 15's same four row slots — the first time all four ever hold
 * real numbers at once, highlighted in `TRACKED_VERTEX_COLOR` to match its on-screen
 * marker in `RevealStage.tsx`), live edge count, cross-section extent, and distance from
 * projection alongside its resulting shadow-scale multiplier.
 *
 * Recomputes directly from the store's rotation/slice state via `math/fourd.ts`'s own
 * functions — the same "call the real function, don't re-derive the math" approach Task
 * 15's distance/orthogonality readouts already use — rather than threading extra derived
 * fields through the store or reading `RevealStage.tsx`'s own render output.
 *
 * Edge count is a real, live number in both the slice/projection views (dynamic 0-12 in
 * slice, fixed 32 in projection — PLAN.md's point is that this *contrast* is itself worth
 * noticing), so it never shows a placeholder there. Cross-section extent (slice-only) and
 * distance-from-projection/shadow-scale (projection-only) each read a placeholder in the
 * view that doesn't show them — a real value the current lens isn't showing, a different
 * kind of absence than a structurally locked axis, so it gets different wording than
 * "Unknown, unreachable" per PLAN.md's placeholder vocabulary.
 *
 * Task 21's chirality view isn't the tesseract at all (`ChiralityDemo.tsx` renders its
 * own asymmetric shape, not `TESSERACT_VERTICES`), so the tracked-vertex ledger/edge
 * count/extent/distance rows below — every one of them a fact about the tesseract
 * specifically — would describe a shape that isn't even on screen. Rotation (xw/yw) and
 * slice offset (w0) stay shown in every view, though: they're the literal shared state
 * the player is dragging, same reasoning Task 14's notes give for why a vertical drag
 * still moves `revealSliceW0` in projection view even though it isn't visually expressed
 * there either.
 */
function RevealDimensionPanel() {
  const revealView = useDimensionsStore((state) => state.revealView)
  const revealRotationXW = useDimensionsStore((state) => state.revealRotationXW)
  const revealRotationYW = useDimensionsStore((state) => state.revealRotationYW)
  const revealSliceW0 = useDimensionsStore((state) => state.revealSliceW0)

  const rotated = applyRevealRotation(TESSERACT_VERTICES, revealRotationXW, revealRotationYW)
  const trackedVertex = rotated[TRACKED_VERTEX_INDEX]
  const [trackedX, trackedY, trackedZ, trackedW] = trackedVertex

  const sliceEdges = sliceTesseract(rotated, TESSERACT_FACES, revealSliceW0)
  const edgeCount = revealView === 'slice' ? sliceEdges.length : TESSERACT_EDGES.length

  const extentOf = (component: 'x' | 'y' | 'z') => {
    const values = sliceEdges.flatMap((edge) => [edge.a[component], edge.b[component]])
    return values.length > 0 ? Math.max(...values) - Math.min(...values) : 0
  }

  const distanceFromProjection = PROJECTION_VIEWER_DISTANCE - trackedW
  const shadowScale = PROJECTION_VIEWER_DISTANCE / distanceFromProjection

  return (
    <div data-testid="dimension-panel" style={panelContainerStyle}>
      <div data-testid="dimension-row-rotation-xw">xw: {formatDegrees(revealRotationXW)}</div>
      <div data-testid="dimension-row-rotation-yw">yw: {formatDegrees(revealRotationYW)}</div>
      <div data-testid="dimension-row-slice-w0">w0: {formatNumber(revealSliceW0)}</div>

      {revealView === 'chirality' ? (
        <div data-testid="dimension-chirality-note" style={{ marginTop: '0.25rem', opacity: 0.6 }}>
          same rotation, a different shape — no tesseract readouts here
        </div>
      ) : (
        <>
          <div style={{ marginTop: '0.25rem', color: TRACKED_VERTEX_COLOR }}>tracked vertex</div>
          <div data-testid="dimension-row-x" style={{ color: TRACKED_VERTEX_COLOR }}>
            x: {formatNumber(trackedX)}
          </div>
          <div data-testid="dimension-row-y" style={{ color: TRACKED_VERTEX_COLOR }}>
            y: {formatNumber(trackedY)}
          </div>
          <div data-testid="dimension-row-z" style={{ color: TRACKED_VERTEX_COLOR }}>
            z: {formatNumber(trackedZ)}
          </div>
          <div data-testid="dimension-row-w" style={{ color: TRACKED_VERTEX_COLOR }}>
            w: {formatNumber(trackedW)}
          </div>

          <div data-testid="dimension-edge-count" style={{ marginTop: '0.25rem', opacity: 0.75 }}>
            edges: {edgeCount}
          </div>
          <div data-testid="dimension-cross-section-extent" style={{ opacity: 0.75 }}>
            {revealView === 'slice'
              ? `Δx:${formatNumber(extentOf('x'))} Δy:${formatNumber(extentOf('y'))} Δz:${formatNumber(extentOf('z'))}`
              : HIDDEN_BEHIND_SHADOW_LABEL}
          </div>
          <div data-testid="dimension-distance-from-projection" style={{ opacity: 0.75 }}>
            {revealView === 'projection'
              ? `dist: ${formatNumber(distanceFromProjection)} → ×${formatNumber(shadowScale)}`
              : SLICED_AWAY_LABEL}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Task 15: an always-visible x/y/z/w axis ledger, live from Stage 1 on — see PLAN.md's
 * "Live instrumentation" locked decision. `w` is always locked pre-reveal, so it's
 * rendered directly rather than looped with `AXES`. An unlocked axis with no drag yet
 * this stage renders no row at all (`liveDragVector === null`) rather than a zero or a
 * blank — three different kinds of "no data" (locked, not-yet-shown, never-attempted),
 * per PLAN.md's tunables section, get three different treatments; Task 19 adds the
 * "sliced away"/"hidden behind the shadow" pair for Stage 4's two views.
 *
 * The distance formula and orthogonality ratio both reuse `evaluateAttempt` directly
 * against the current stage's `occupiedAxes` rather than re-deriving the math, so the
 * live number shown mid-drag is exactly what pointer-up will use to decide pass/fail
 * (`ArrowDrag.tsx` calls the same function). Vertex/edge counts are static per stage —
 * see `STAGE_SHAPE_COUNTS`'s doc comment for the doubling pattern they build toward.
 */
export function DimensionPanel() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const liveDragVector = useDimensionsStore((state) => state.liveDragVector)

  // Task 20: the cone warm-up isn't the tesseract, so its rotation/slice-offset/tracked-
  // vertex readouts would be stale/meaningless here — no panel at all while it's active,
  // same treatment 'closing' gets below for "not a hypercube-slice shape."
  if (stage === 'reveal') return revealWarmupActive ? null : <RevealDimensionPanel />

  const shapeCounts = STAGE_SHAPE_COUNTS[stage]
  // 'closing' isn't a hypercube-slice shape in this sense and gets no panel at all.
  if (!shapeCounts) return null

  const { occupiedAxes } = STAGE_CONFIG[stage]
  const result = liveDragVector ? evaluateAttempt(liveDragVector, occupiedAxes) : null
  const distance = liveDragVector
    ? Math.sqrt(occupiedAxes.reduce((sum, axis) => sum + liveDragVector[axis] ** 2, 0))
    : null
  const distanceFormula =
    occupiedAxes.length === 1
      ? `|${occupiedAxes[0]}|`
      : `√(${occupiedAxes.map((axis) => `${axis}²`).join('+')})`

  return (
    <div data-testid="dimension-panel" style={panelContainerStyle}>
      {AXES.map((axis) => {
        if (!occupiedAxes.includes(axis)) {
          return (
            <div key={axis} data-testid={`dimension-row-${axis}`} style={{ opacity: 0.5 }}>
              {axis}: {LOCKED_LABEL}
            </div>
          )
        }
        if (!liveDragVector) return null
        return (
          <div key={axis} data-testid={`dimension-row-${axis}`}>
            {axis}: {formatNumber(liveDragVector[axis])}
          </div>
        )
      })}
      <div data-testid="dimension-row-w" style={{ opacity: 0.5 }}>
        w: {LOCKED_LABEL}
      </div>

      <div style={{ marginTop: '0.25rem', opacity: 0.75 }}>
        {distanceFormula} = {distance === null ? '—' : formatNumber(distance)}
      </div>
      <div data-testid="dimension-orthogonality" style={{ opacity: 0.75 }}>
        orthogonality: {result === null ? '—' : formatNumber(result.orthogonalityRatio)}
      </div>
      <div data-testid="dimension-shape-counts" style={{ marginTop: '0.25rem', opacity: 0.55 }}>
        {shapeCounts.vertices}v · {shapeCounts.edges}e
      </div>
    </div>
  )
}
