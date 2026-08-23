/**
 * Task 21 (geometry replaced in Task 27): pure geometry for the chirality/mirror-flip
 * demo — a smoothly modeled hand built from rounded primitives (an ellipsoid palm, a
 * capsule wrist, four graduated capsule fingers with small spherical knuckle joints, and
 * an off-center, outward-tilted capsule thumb) rather than any texture-asset pipeline.
 * No new rotation or projection math here: `scene/ChiralityDemo.tsx` drives these
 * anchors through `fourd.ts`'s `applyRevealRotation`/`projectTo3D` verbatim, the same
 * functions (and the same `revealRotationXW`/`revealRotationYW` store state) already
 * driving the tesseract — only this module's part list describes the shape.
 *
 * Task 21's original box-and-cylinder version was explicitly flagged by the user, after
 * playing the Task 22 build, as a placeholder good enough to prove the mirror-flip math
 * but not to ship — `ui/ChiralityPrototypeBadge.tsx` marked it on-screen in the
 * meantime. This module is that promised remodel: same part *count* logic (a palm plus
 * graduated digits, deliberately asymmetric — see below), rounder primitives (capsules
 * and an ellipsoid instead of cylinders and a box) so the silhouette reads as a hand
 * rather than a rig of rods, plus small knuckle spheres bridging where each digit meets
 * the palm. The badge is removed now that this is the real geometry.
 */
import type { Vec4 } from './fourd'

export type ChiralityPartShape = 'capsule' | 'ellipsoid'

/** Which part of the hand this is, purely for `ChiralityDemo.tsx`'s color choice. */
export type ChiralityPartRole = 'base' | 'digit' | 'joint'

export interface ChiralityPart {
  shape: ChiralityPartShape
  /**
   * Local size at rest, before `ChiralityDemo.tsx`'s `CHIRALITY_SCALE`:
   * capsule = [radius, length, unused]; ellipsoid = [radiusX, radiusY, radiusZ].
   */
  size: readonly [number, number, number]
  /** This part's center at rest — always w=0, per PLAN.md's "sits flat at w=0." */
  anchor: Vec4
  role: ChiralityPartRole
  /**
   * A fixed local Euler tilt (radians, applied only to this part's own mesh — never
   * touched by the 4D rotation/projection math). Purely cosmetic: only the thumb uses
   * this, to angle it out to the side the way a real thumb doesn't point straight up
   * alongside the fingers.
   */
  rotation?: readonly [number, number, number]
}

/**
 * Deliberately asymmetric about every axis (unlike, say, a symmetric starfish or a plain
 * disc) — a palm plus four fingers of different lengths at increasing x, and a thumb
 * offset low to one side — so a 180° xw rotation's x-negation (see `chirality.test.ts`)
 * reads unmistakably as a left/right-hand flip rather than a shape that happens to look
 * the same before and after, which a symmetric arrangement would and which would defeat
 * the point of the demo.
 *
 * Every digit (finger or thumb) gets a small spherical `'joint'` part at the point it
 * meets the palm — that's what turns a straight capsule butting into an ellipsoid into a
 * rounded, continuous-looking knuckle, and it also means the "different parts warp at
 * different rates" tell (PLAN.md) shows up in one extra, finer-grained step per digit as
 * the hand rotates through the 4th dimension.
 */
export const CHIRALITY_PARTS: readonly ChiralityPart[] = [
  // Palm: a flattened ellipsoid rather than a flat-sided box, so the whole hand reads as
  // soft/organic rather than blocky from any angle.
  { shape: 'ellipsoid', size: [0.27, 0.34, 0.1], anchor: [0, 0.06, 0, 0], role: 'base' },
  // Wrist: a short capsule continuing the arm below the palm, so the shape reads as a
  // hand attached to something rather than a floating paddle.
  { shape: 'capsule', size: [0.155, 0.22, 0], anchor: [0, -0.34, 0, 0], role: 'base' },

  // Fingers: graduated length, evenly spaced along x, pointing away from the palm (+y).
  // Rounded capsule caps (vs. the old flat-ended cylinders) read as fingertips, not rods.
  { shape: 'capsule', size: [0.052, 0.36, 0], anchor: [-0.19, 0.58, 0, 0], role: 'digit' },
  { shape: 'capsule', size: [0.057, 0.48, 0], anchor: [-0.065, 0.66, 0, 0], role: 'digit' },
  { shape: 'capsule', size: [0.057, 0.44, 0], anchor: [0.065, 0.64, 0, 0], role: 'digit' },
  { shape: 'capsule', size: [0.048, 0.32, 0], anchor: [0.19, 0.54, 0, 0], role: 'digit' },
  // Knuckle joints: one small sphere per finger, at the palm/finger boundary.
  { shape: 'ellipsoid', size: [0.07, 0.07, 0.07], anchor: [-0.19, 0.32, 0, 0], role: 'joint' },
  { shape: 'ellipsoid', size: [0.075, 0.075, 0.075], anchor: [-0.065, 0.34, 0, 0], role: 'joint' },
  { shape: 'ellipsoid', size: [0.075, 0.075, 0.075], anchor: [0.065, 0.34, 0, 0], role: 'joint' },
  { shape: 'ellipsoid', size: [0.065, 0.065, 0.065], anchor: [0.19, 0.31, 0, 0], role: 'joint' },

  // Thumb: the deliberately off-center part that makes the arrangement unmistakably
  // chiral rather than merely lopsided along one axis. Tilted outward (a static local
  // rotation, not part of the 4D math) so it juts to the side the way a real thumb does
  // rather than standing parallel to the fingers.
  {
    shape: 'capsule',
    size: [0.066, 0.3, 0],
    anchor: [-0.33, -0.03, 0.07, 0],
    role: 'digit',
    rotation: [0.15, 0, -0.95],
  },
  { shape: 'ellipsoid', size: [0.085, 0.085, 0.085], anchor: [-0.24, -0.16, 0.05, 0], role: 'joint' },
]
