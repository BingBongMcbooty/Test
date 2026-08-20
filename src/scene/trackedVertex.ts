/**
 * Task 19: which tesseract vertex `RevealStage.tsx`'s highlight and
 * `ui/DimensionPanel.tsx`'s x/y/z/w ledger both track, and the shared color connecting
 * them. PLAN.md's tunables note this pick is arbitrary — any vertex demonstrates a live
 * 4D coordinate equally well — so the all-positive corner (1,1,1,1) was chosen only
 * because it's unambiguous to reason about, not for any property that makes it special.
 */
import { TESSERACT_VERTICES } from '../math/fourd'

export const TRACKED_VERTEX_INDEX = TESSERACT_VERTICES.findIndex(
  ([x, y, z, w]) => x === 1 && y === 1 && z === 1 && w === 1,
)

/** Cyan — distinct from both the shapes' cool indigo/violet palette and the arrow's warm gold. */
export const TRACKED_VERTEX_COLOR = '#5eebff'
