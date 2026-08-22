import type { CSSProperties } from 'react'
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
import { STAGE_CONFIG, STAGE_SHAPE_COUNTS, type Axis, type Stage } from '../state/stageConfig'

const AXES: readonly Axis[] = ['x', 'y', 'z']
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
  // Task 24 fix: this had no cap at all, so the reveal stage's chirality-view note
  // (`dimension-chirality-note`, a full sentence) grew the panel wide enough to
  // overlap the centered header prompt (`ui/HUD.tsx`) at typical viewport widths.
  // Every row already wraps by default (plain `div`s, no `whiteSpace: 'nowrap'`
  // anywhere in this file) — a `maxWidth` alone is enough to force that wrapping
  // instead of letting content dictate the box's width.
  maxWidth: '14rem',
  padding: '0.75rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
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
 * Task 24: the panel's shared row shape — a plain-language description first
 * (`primary`, sized/colored as the visually dominant line), the old terse mathematical
 * notation demoted to small, dim subtext underneath (`notation`) rather than the
 * primary visual element it was through Task 19. Every row in this file (locked axes,
 * live axis values, the distance formula, the orthogonality ratio, shape counts, and
 * the Stage 4 panel's own rotation/slice/tracked-vertex rows) goes through this one
 * component so the hierarchy is consistent everywhere, not just on the rows Task 24
 * happened to add new data for.
 */
function PanelRow({
  testId,
  primary,
  notation,
  color,
  dim,
}: {
  testId?: string
  primary: string
  notation: string
  color?: string
  dim?: boolean
}) {
  const style: CSSProperties = { opacity: dim ? 0.5 : 1, color }
  return (
    <div data-testid={testId} style={style}>
      <div>{primary}</div>
      <div style={{ fontSize: '0.6rem', opacity: 0.6, marginTop: '0.1rem' }}>[{notation}]</div>
    </div>
  )
}

/**
 * Task 24: plain-language framing for a locked (structurally unreachable) axis, kept
 * uniform across stages/axes rather than hand-written per case — the notation subtext
 * (`[y]`, `[w]`, etc.) is what actually says which axis, so the primary text doesn't
 * need to repeat it.
 */
const LOCKED_PRIMARY = 'Outside this world — no direction here yet'

type DragStage = Extract<Stage, 'line' | 'plane' | 'cube'>

/**
 * Task 24: plain-language description for each stage's per-axis live readout.
 * Stages 1-2 are the cursor's continuous projection (`liveCursorPoint`,
 * `CursorTracker.tsx`); Stage 3 is a tracked cube corner's position relative to the
 * *camera's* current view (`trackedCubeVertexCamera`, `TrackedCubeVertexTracker.tsx`)
 * — confirmed directly by the user (see PROGRESS.md) since the cube itself never
 * rotates in world space, only the camera orbits around it, so a world-space reading
 * would just be a constant that never changes.
 */
const AXIS_LIVE_LABEL: Record<DragStage, Partial<Record<Axis, string>>> = {
  line: { x: 'Where your cursor lands on the line' },
  plane: {
    x: 'Left-right position on the plane',
    y: 'Up-down position on the plane',
  },
  cube: {
    x: 'Tracked corner, left-right from here',
    y: 'Tracked corner, up-down from here',
    z: 'Tracked corner, near-far from here',
  },
}

/** Task 24: plain-language description for each stage's distance/orthogonality rows. */
const ATTEMPT_LABEL: Record<DragStage, { distance: string; orthogonality: string }> = {
  line: {
    distance: 'How far you dragged along the line',
    orthogonality: 'How much of that drag left the line',
  },
  plane: {
    distance: 'How far you dragged within the plane',
    orthogonality: 'How much of that drag left the plane',
  },
  cube: {
    distance: 'How far you dragged within the cube',
    orthogonality: 'How much of that drag left the cube',
  },
}

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
 * Task 15/24: an always-visible x/y/z/w axis ledger, live from Stage 1 on — see
 * PLAN.md's "Live instrumentation" and "Cursor-tracking, plain-language-first
 * instrumentation" locked decisions. `w` is always locked pre-reveal, so it's rendered
 * directly rather than looped with `AXES`; Task 19 adds the "sliced away"/"hidden
 * behind the shadow" pair for Stage 4's two views.
 *
 * Task 24 changed what drives the occupied-axis rows on every stage: they used to go
 * blank between drags (`liveDragVector === null` at rest) and are now continuously
 * live regardless of whether anything is actively being dragged — Stages 1-2 off
 * `liveCursorPoint` (`CursorTracker.tsx`'s plain-hover raycast, no click required),
 * Stage 3 off `trackedCubeVertexCamera` (`TrackedCubeVertexTracker.tsx`'s per-frame
 * camera-relative reading of one fixed cube corner — see that file and `store.ts`'s
 * doc comment for why "relative to the camera" rather than a world-space constant). A
 * real "nothing to report yet" state (Stages 1-2 only, before the first pointer move)
 * renders as `—` rather than hiding the row entirely, since a plain-language-first
 * panel should always show the reader *what* it's telling them even when it has
 * nothing to report yet. Stage 3's rows share the same cyan (`TRACKED_VERTEX_COLOR`)
 * as its on-scene marker and Task 19's tesseract equivalent — the same "the number and
 * the point read as one thing" connection, reused verbatim one dimension earlier.
 *
 * The distance formula and orthogonality ratio both reuse `evaluateAttempt` directly
 * against the current stage's `occupiedAxes` rather than re-deriving the math, so the
 * live number shown mid-drag is exactly what pointer-up will use to decide pass/fail
 * (`ArrowDrag.tsx` calls the same function) — these two rows stay drag-gated (`—` at
 * rest) on purpose, unlike the axis ledger above: `evaluateAttempt` is inherently a
 * function of a *drag vector* (two points), not a single cursor position, so there's
 * no meaningful "continuous" version of it the way there is for a live coordinate.
 * Vertex/edge counts are static per stage — see `STAGE_SHAPE_COUNTS`'s doc comment for
 * the doubling pattern they build toward.
 */
export function DimensionPanel() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const liveDragVector = useDimensionsStore((state) => state.liveDragVector)
  const liveCursorPoint = useDimensionsStore((state) => state.liveCursorPoint)
  const trackedCubeVertexCamera = useDimensionsStore((state) => state.trackedCubeVertexCamera)

  // Task 20: the cone warm-up isn't the tesseract, so its rotation/slice-offset/tracked-
  // vertex readouts would be stale/meaningless here — no panel at all while it's active,
  // same treatment 'closing' gets below for "not a hypercube-slice shape."
  if (stage === 'reveal') return revealWarmupActive ? null : <RevealDimensionPanel />

  const shapeCounts = STAGE_SHAPE_COUNTS[stage]
  // 'closing' isn't a hypercube-slice shape in this sense and gets no panel at all.
  if (!shapeCounts) return null

  const dragStage = stage as DragStage
  const { occupiedAxes } = STAGE_CONFIG[stage]
  const result = liveDragVector ? evaluateAttempt(liveDragVector, occupiedAxes) : null
  const distance = liveDragVector
    ? Math.sqrt(occupiedAxes.reduce((sum, axis) => sum + liveDragVector[axis] ** 2, 0))
    : null
  const distanceFormula =
    occupiedAxes.length === 1
      ? `|${occupiedAxes[0]}|`
      : `√(${occupiedAxes.map((axis) => `${axis}²`).join('+')})`

  // Task 24: Stages 1-2's continuous cursor projection; Stage 3's camera-relative
  // tracked-vertex reading — see this component's own doc comment above.
  function liveAxisValue(axis: Axis): number | null {
    if (dragStage === 'line' || dragStage === 'plane') {
      return liveCursorPoint ? liveCursorPoint[axis] : null
    }
    return trackedCubeVertexCamera ? trackedCubeVertexCamera[axis] : null
  }

  return (
    <div data-testid="dimension-panel" style={panelContainerStyle}>
      {AXES.map((axis) => {
        if (!occupiedAxes.includes(axis)) {
          return (
            <PanelRow
              key={axis}
              testId={`dimension-row-${axis}`}
              primary={LOCKED_PRIMARY}
              notation={axis}
              dim
            />
          )
        }
        const value = liveAxisValue(axis)
        const primary = AXIS_LIVE_LABEL[dragStage][axis] ?? axis
        return (
          <PanelRow
            key={axis}
            testId={`dimension-row-${axis}`}
            primary={`${primary}: ${value === null ? '—' : formatNumber(value)}`}
            notation={axis}
            color={dragStage === 'cube' ? TRACKED_VERTEX_COLOR : undefined}
          />
        )
      })}
      <PanelRow testId="dimension-row-w" primary={LOCKED_PRIMARY} notation="w" dim />

      <PanelRow
        primary={`${ATTEMPT_LABEL[dragStage].distance}: ${distance === null ? '—' : formatNumber(distance)}`}
        notation={`${distanceFormula} = ${distance === null ? '—' : formatNumber(distance)}`}
        dim
      />
      <PanelRow
        testId="dimension-orthogonality"
        primary={`${ATTEMPT_LABEL[dragStage].orthogonality}: ${result === null ? '—' : formatNumber(result.orthogonalityRatio)}`}
        notation={`orthogonality = ${result === null ? '—' : formatNumber(result.orthogonalityRatio)}`}
        dim
      />
      <PanelRow
        testId="dimension-shape-counts"
        primary={`This shape has ${shapeCounts.vertices} corners and ${shapeCounts.edges} edges`}
        notation={`${shapeCounts.vertices}v · ${shapeCounts.edges}e`}
        dim
      />
    </div>
  )
}
