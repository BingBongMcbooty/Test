/**
 * Task 21: pure geometry for the chirality/mirror-flip demo — an asymmetric arrangement
 * of primitive parts (a palm, four graduated fingers, and an off-center thumb — echoing
 * a hand without needing any texture-asset pipeline) anchored in 4D at w=0. No new
 * rotation or projection math here: `scene/ChiralityDemo.tsx` drives these anchors
 * through `fourd.ts`'s `applyRevealRotation`/`projectTo3D` verbatim, the same functions
 * (and the same `revealRotationXW`/`revealRotationYW` store state) already driving the
 * tesseract — only this module's part list is new.
 *
 * PROTOTYPE — flagged by direct user request after playing the Task 22 build: this part
 * list is a placeholder standing in for a real hand model, good enough to prove the
 * mirror-flip math (see the asymmetry note below) but not the shape this demo should
 * ship with. A future task should replace it with a smoothly modeled glove/hand — see
 * PLAN.md's tunables note. `ui/ChiralityPrototypeBadge.tsx` surfaces this on-screen so
 * it isn't mistaken for finished work in the meantime.
 */
import type { Vec4 } from './fourd'

export type ChiralityPartShape = 'box' | 'cylinder'

export interface ChiralityPart {
  shape: ChiralityPartShape
  /** Local size at rest: box = [width, height, depth]; cylinder = [radius, radius, height]. */
  size: readonly [number, number, number]
  /** This part's center at rest — always w=0, per PLAN.md's "sits flat at w=0." */
  anchor: Vec4
}

/**
 * Deliberately asymmetric about every axis (unlike, say, a symmetric starfish or a plain
 * box) — a palm plus four fingers of different lengths at increasing x, and a thumb
 * offset low to one side — so a 180° xw rotation's x-negation (see `chirality.test.ts`)
 * reads unmistakably as a left/right-hand flip rather than a shape that happens to look
 * the same before and after, which a symmetric arrangement would and which would defeat
 * the point of the demo.
 */
export const CHIRALITY_PARTS: readonly ChiralityPart[] = [
  // Palm
  { shape: 'box', size: [0.5, 0.62, 0.16], anchor: [0, 0, 0, 0] },
  // Fingers: graduated length, evenly spaced along x, pointing away from the palm (+y)
  { shape: 'cylinder', size: [0.05, 0.05, 0.44], anchor: [-0.19, 0.53, 0, 0] },
  { shape: 'cylinder', size: [0.055, 0.055, 0.58], anchor: [-0.065, 0.6, 0, 0] },
  { shape: 'cylinder', size: [0.055, 0.055, 0.54], anchor: [0.065, 0.58, 0, 0] },
  { shape: 'cylinder', size: [0.048, 0.048, 0.4], anchor: [0.19, 0.49, 0, 0] },
  // Thumb: the deliberately off-center part that makes the arrangement unmistakably
  // chiral rather than merely lopsided along one axis.
  { shape: 'cylinder', size: [0.062, 0.062, 0.34], anchor: [-0.31, -0.08, 0.05, 0] },
]
