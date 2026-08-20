import { evaluateAttempt } from '../math/validation'
import { useDimensionsStore } from '../state/store'
import { STAGE_CONFIG, STAGE_SHAPE_COUNTS, type Axis } from '../state/stageConfig'

const AXES: readonly Axis[] = ['x', 'y', 'z']
const LOCKED_LABEL = 'Unknown, unreachable'

function formatNumber(value: number): string {
  return value.toFixed(2)
}

/**
 * Task 15: an always-visible x/y/z/w axis ledger, live from Stage 1 on — see PLAN.md's
 * "Live instrumentation" locked decision. `w` is always locked pre-reveal, so it's
 * rendered directly rather than looped with `AXES`. An unlocked axis with no drag yet
 * this stage renders no row at all (`liveDragVector === null`) rather than a zero or a
 * blank — three different kinds of "no data" (locked, not-yet-shown, never-attempted),
 * per PLAN.md's tunables section, get three different treatments; Task 16 adds the
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
  const liveDragVector = useDimensionsStore((state) => state.liveDragVector)

  const shapeCounts = STAGE_SHAPE_COUNTS[stage]
  // Stage 4+ isn't a hypercube-slice shape in this sense, and needs richer readouts
  // (rotation, tracked vertex, live edge count) that don't exist until Task 16.
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
    <div
      data-testid="dimension-panel"
      style={{
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
      }}
    >
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
