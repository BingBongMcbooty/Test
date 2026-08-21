import { describe, expect, it } from 'vitest'
import { CHIRALITY_PARTS } from './chirality'
import { rotateXW } from './fourd'

describe('chirality demo geometry', () => {
  it('every part starts flat at w=0', () => {
    for (const part of CHIRALITY_PARTS) {
      expect(part.anchor[3]).toBe(0)
    }
  })

  it('the arrangement is not left/right-symmetric about x=0 at rest (otherwise there would be nothing to flip)', () => {
    const xs = CHIRALITY_PARTS.map((part) => part.anchor[0])
    const mirroredXs = xs.map((x) => -x).sort((a, b) => a - b)
    const sortedXs = [...xs].sort((a, b) => a - b)
    const isSymmetric = sortedXs.every((x, i) => Math.abs(x - mirroredXs[i]) < 1e-6)
    expect(isSymmetric).toBe(false)
  })

  it('a 180deg rotateXW applied to the (w=0) anchors produces exactly the x-negated mirror image', () => {
    const anchors = CHIRALITY_PARTS.map((part) => part.anchor)
    const mirrored = rotateXW(anchors, Math.PI)

    for (let i = 0; i < anchors.length; i++) {
      const [x, y, z] = anchors[i]
      const [mx, my, mz, mw] = mirrored[i]
      expect(mx).toBeCloseTo(-x)
      expect(my).toBeCloseTo(y)
      expect(mz).toBeCloseTo(z)
      expect(mw).toBeCloseTo(0)
    }
  })

  it('a 90deg rotateXW mid-turn lifts every nonzero-x part off w=0, matching the "different parts warp differently" tell', () => {
    const anchors = CHIRALITY_PARTS.map((part) => part.anchor)
    const midTurn = rotateXW(anchors, Math.PI / 2)

    for (let i = 0; i < anchors.length; i++) {
      const [x] = anchors[i]
      const [mx, , , mw] = midTurn[i]
      // rotate2D(x, 0, pi/2) = (0, x): x moves to w, w (0) moves to (negated) x.
      expect(mx).toBeCloseTo(0)
      expect(mw).toBeCloseTo(x)
    }

    // Parts with different rest-x values pick up different mid-turn w values — the
    // per-part scale factor `projectTo3D` derives from w therefore differs per part too,
    // which is the visible "different parts grow/shrink at different rates" warp PLAN.md
    // calls for, not a bug to smooth over.
    const restXs = anchors.map(([x]) => x)
    const midWs = midTurn.map(([, , , w]) => w)
    expect(new Set(restXs.map((x) => x.toFixed(6))).size).toBeGreaterThan(1)
    restXs.forEach((x, i) => expect(midWs[i]).toBeCloseTo(x))
  })
})
