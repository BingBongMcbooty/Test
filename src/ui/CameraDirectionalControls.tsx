import type { CameraControlsImpl } from '@react-three/drei'
import { cameraControlsRef } from '../scene/cameraControlsRef'
import { CAMERA_FRAMING, resistedStep, type CameraFraming } from '../scene/cameraFraming'
import { useDimensionsStore } from '../state/store'

/** Radians per button click/hold-tick — button-driven equivalent of a mouse-drag's sensitivity. */
const ROTATE_STEP = 0.35
/** World units per button click/hold-tick, positive = closer to the target. */
const DOLLY_STEP = 0.6
/** Milliseconds between repeats while a button is held down. */
const HOLD_REPEAT_MS = 90

type RotateDirection = 'left' | 'right' | 'up' | 'down'

/**
 * Task 23: `resistedStep` needs the angle the camera is actually *heading toward*, not
 * the live, still-damping-toward-it value `controls.azimuthAngle`/`.polarAngle`
 * report. `camera-controls`' own `rotate(delta, ..., true)` adds `delta` to its
 * internal pending target (an unexposed private field), not to the live value — so
 * during a sustained hold, where repeat ticks (every `HOLD_REPEAT_MS`) fire faster
 * than the damped transition can catch up, reading the lagging live value as "current"
 * makes resistance under-count how far out the pending target already is, letting
 * repeated presses run away almost entirely un-resisted (confirmed by an actual
 * `npm run dev` look — see PROGRESS.md's Task 23 notes). These two module-level values
 * track that pending target ourselves instead: resynced from the live value whenever
 * `controls.active` reports no transition is currently in flight (the one moment live
 * *is* the pending target, so it's safe to trust), and advanced by exactly the
 * resisted delta actually applied otherwise, so they stay exactly in step with the
 * library's own real internal target throughout an arbitrarily long hold.
 */
let pendingAzimuth: number | null = null
let pendingPolar: number | null = null

function targetAzimuth(controls: CameraControlsImpl): number {
  if (!controls.active) pendingAzimuth = controls.azimuthAngle
  return pendingAzimuth ?? controls.azimuthAngle
}

function targetPolar(controls: CameraControlsImpl): number {
  if (!controls.active) pendingPolar = controls.polarAngle
  return pendingPolar ?? controls.polarAngle
}

/**
 * The raw `ROTATE_STEP` is run through `resistedStep` against the current stage's
 * `azimuthRange`/`polarRange` before being applied — inside that range this is a no-op
 * (full step, exactly Task 17's behavior), outside it the step shrinks the further out
 * the camera's tracked target already is (see `targetAzimuth`/`targetPolar` above for
 * why that's tracked rather than read live).
 */
function rotate(direction: RotateDirection, framing: CameraFraming) {
  const controls = cameraControlsRef.current
  if (!controls) return
  switch (direction) {
    case 'left': {
      const current = targetAzimuth(controls)
      const step = resistedStep(current, -ROTATE_STEP, framing.azimuthRange)
      controls.rotate(step, 0, true)
      pendingAzimuth = current + step
      break
    }
    case 'right': {
      const current = targetAzimuth(controls)
      const step = resistedStep(current, ROTATE_STEP, framing.azimuthRange)
      controls.rotate(step, 0, true)
      pendingAzimuth = current + step
      break
    }
    case 'up': {
      const current = targetPolar(controls)
      const step = resistedStep(current, -ROTATE_STEP, framing.polarRange)
      controls.rotate(0, step, true)
      pendingPolar = current + step
      break
    }
    case 'down': {
      const current = targetPolar(controls)
      const step = resistedStep(current, ROTATE_STEP, framing.polarRange)
      controls.rotate(0, step, true)
      pendingPolar = current + step
      break
    }
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
 * to exist. Drives the single shared `CameraControls` instance via `cameraControlsRef`
 * — a plain module ref rather than store state, since these are one-shot imperative
 * nudges (`.rotate()`/`.dolly()`), not values anything needs to read back reactively.
 *
 * Task 23: renders on *every* stage now, including Stage 1 (previously the only stage
 * with no buttons at all). What used to be a hard per-stage clamp
 * (`cameraFraming.ts`'s old `cameraControlsEnabled`/absolute `azimuthRange`/
 * `polarRange` passed straight to `CameraControls`' own `minAzimuthAngle`/etc.) is now
 * resistance-with-spring-back instead: `rotate()` above runs every step through
 * `resistedStep` against the current stage's (still-named) `azimuthRange`/
 * `polarRange`, and `Experience.tsx`'s `CameraRig` eases the camera back toward that
 * range whenever it's left outside it. Stage 1's range is zero-width, so it faces
 * resistance (and springs back) on any movement at all; Stage 2 keeps
 * `PLANE_TILT_RANGE`'s free zone; Stage 3 on is unaffected — an unclamped range makes
 * both mechanisms permanent no-ops there, identical to Task 17's original behavior.
 */
export function CameraDirectionalControls() {
  const stage = useDimensionsStore((state) => state.stage)
  const framing = CAMERA_FRAMING[stage]

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
        <RepeatButton testId="camera-control-up" label="▲" onFire={() => rotate('up', framing)} />
        <div />
        <RepeatButton
          testId="camera-control-left"
          label="◀"
          onFire={() => rotate('left', framing)}
        />
        <div />
        <RepeatButton
          testId="camera-control-right"
          label="▶"
          onFire={() => rotate('right', framing)}
        />
        <div />
        <RepeatButton
          testId="camera-control-down"
          label="▼"
          onFire={() => rotate('down', framing)}
        />
        <div />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <RepeatButton testId="camera-control-zoom-in" label="+" onFire={() => dolly('in')} />
        <RepeatButton testId="camera-control-zoom-out" label="−" onFire={() => dolly('out')} />
      </div>
    </div>
  )
}
