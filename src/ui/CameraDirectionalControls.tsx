import { cameraControlsRef } from '../scene/cameraControlsRef'
import { CAMERA_FRAMING } from '../scene/cameraFraming'
import { useDimensionsStore } from '../state/store'

/** Radians per button click/hold-tick — button-driven equivalent of a mouse-drag's sensitivity. */
const ROTATE_STEP = 0.35
/** World units per button click/hold-tick, positive = closer to the target. */
const DOLLY_STEP = 0.6
/** Milliseconds between repeats while a button is held down. */
const HOLD_REPEAT_MS = 90

type RotateDirection = 'left' | 'right' | 'up' | 'down'

function rotate(direction: RotateDirection) {
  const controls = cameraControlsRef.current
  if (!controls) return
  switch (direction) {
    case 'left':
      controls.rotate(-ROTATE_STEP, 0, true)
      break
    case 'right':
      controls.rotate(ROTATE_STEP, 0, true)
      break
    case 'up':
      controls.rotate(0, -ROTATE_STEP, true)
      break
    case 'down':
      controls.rotate(0, ROTATE_STEP, true)
      break
  }
}

function dolly(direction: 'in' | 'out') {
  const controls = cameraControlsRef.current
  if (!controls) return
  controls.dolly(direction === 'in' ? DOLLY_STEP : -DOLLY_STEP, true)
}

interface RepeatButtonProps {
  testId: string
  label: string
  onFire: () => void
}

/**
 * A button that fires once on click and keeps firing on a fixed interval while held
 * down — matches the "keep nudging while pressed" feel a real directional pad has,
 * rather than requiring a fresh click per `ROTATE_STEP`/`DOLLY_STEP` increment.
 */
function RepeatButton({ testId, label, onFire }: RepeatButtonProps) {
  function startRepeating() {
    onFire()
    const interval = window.setInterval(onFire, HOLD_REPEAT_MS)
    function stop() {
      window.clearInterval(interval)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointerleave', stop)
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointerleave', stop)
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onPointerDown={startRepeating}
      style={{
        width: '2.25rem',
        height: '2.25rem',
        fontSize: '0.9rem',
        background: 'transparent',
        color: '#e5e4e7',
        border: '1px solid #e5e4e7',
        borderRadius: '0.4rem',
        cursor: 'pointer',
        opacity: 0.75,
      }}
    >
      {label}
    </button>
  )
}

/**
 * Task 17: on-screen camera controls, replacing mouse-drag-to-orbit everywhere it used
 * to exist. Renders only on stages where `cameraFraming.ts` marks
 * `cameraControlsEnabled` — Stage 1 (line) never gets it at all (see that field's doc
 * comment for why), Stage 2 (plane) gets a deliberately limited tilt
 * (`PLANE_TILT_RANGE`), Stage 3 on gets the original unclamped free-orbit range.
 * Drives the single shared `CameraControls` instance via `cameraControlsRef` — a plain
 * module ref rather than store state, since these are one-shot imperative nudges
 * (`.rotate()`/`.dolly()`), not values anything needs to read back reactively.
 */
export function CameraDirectionalControls() {
  const stage = useDimensionsStore((state) => state.stage)
  const { cameraControlsEnabled } = CAMERA_FRAMING[stage]

  if (!cameraControlsEnabled) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '5rem',
        right: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        data-testid="camera-controls"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 2.25rem)',
          gridTemplateRows: 'repeat(3, 2.25rem)',
          gap: '0.25rem',
        }}
      >
        <div />
        <RepeatButton testId="camera-control-up" label="▲" onFire={() => rotate('up')} />
        <div />
        <RepeatButton testId="camera-control-left" label="◀" onFire={() => rotate('left')} />
        <div />
        <RepeatButton testId="camera-control-right" label="▶" onFire={() => rotate('right')} />
        <div />
        <RepeatButton testId="camera-control-down" label="▼" onFire={() => rotate('down')} />
        <div />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <RepeatButton testId="camera-control-zoom-in" label="+" onFire={() => dolly('in')} />
        <RepeatButton testId="camera-control-zoom-out" label="−" onFire={() => dolly('out')} />
      </div>
    </div>
  )
}
