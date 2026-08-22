import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useDimensionsStore } from '../state/store'
import { ArrowDrag } from './ArrowDrag'
import { ChiralityDemo } from './ChiralityDemo'
import { CursorMarker } from './CursorMarker'
import { CursorTracker } from './CursorTracker'
import { Grid } from './Grid'
import { RevealDrag } from './RevealDrag'
import { SliceWarmup } from './SliceWarmup'
import { TrackedCubeVertexTracker } from './TrackedCubeVertexTracker'
import { CAMERA_FRAMING, SPRING_BACK_SHARPNESS, easedTowardRange } from './cameraFraming'
import { cameraControlsRef } from './cameraControlsRef'
import { LIGHT_RIG } from './materials'
import { CubeStage } from './stages/CubeStage'
import { LineStage } from './stages/LineStage'
import { PlaneStage } from './stages/PlaneStage'
import { RevealStage } from './stages/RevealStage'

function StageGeometry() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const revealView = useDimensionsStore((state) => state.revealView)

  switch (stage) {
    case 'line':
      return <LineStage />
    case 'plane':
      return <PlaneStage />
    case 'cube':
      return <CubeStage />
    case 'reveal':
      // Task 20: the cone-slicing warm-up plays first, before the tesseract itself
      // takes over — see `state/store.ts`'s `revealWarmupActive` for how that's gated.
      if (revealWarmupActive) return <SliceWarmup />
      // Task 21: the chirality demo is a third lens on the same reveal-stage 4D state,
      // swapped in by `revealView` exactly like the slice/projection swap already was.
      return revealView === 'chirality' ? <ChiralityDemo /> : <RevealStage />
    // Task 22: 'closing' deliberately renders no shape — an empty void (still lit, no
    // grid per Grid.tsx's note) is the backdrop for `ui/ClosingBeat.tsx`'s fade-in line
    // and restart button, not a new 3D scene of its own.
    default:
      return null
  }
}

// Task 7: line/plane keep the flat ambient + one key light from Task 5 (their
// wireframe/faint fill don't need more), but the cube stage onward gets a proper
// multi-light setup — a second, cooler fill light joins the key light — matching what
// `scene/materials.ts`'s hand-rolled shader lighting expects from `LIGHT_RIG`.
function SceneLights() {
  const stage = useDimensionsStore((state) => state.stage)
  const richLighting = stage === 'cube' || stage === 'reveal' || stage === 'closing'

  return (
    <>
      <ambientLight color={LIGHT_RIG.ambient.color} intensity={LIGHT_RIG.ambient.intensity} />
      <directionalLight
        position={LIGHT_RIG.key.position}
        color={LIGHT_RIG.key.color}
        intensity={LIGHT_RIG.key.intensity}
      />
      {richLighting && (
        <directionalLight
          position={LIGHT_RIG.fill.position}
          color={LIGHT_RIG.fill.color}
          intensity={LIGHT_RIG.fill.intensity}
        />
      )}
    </>
  )
}

function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const stage = useDimensionsStore((state) => state.stage)
  const hasMountedRef = useRef(false)
  const framing = CAMERA_FRAMING[stage]

  useEffect(() => {
    const { position, target } = framing
    // `true` enables camera-controls' own smoothed transition — Task 5 cut this in as
    // an instant `setLookAt(..., false)`; Task 11 is where stage-advance actually
    // happens via player interaction, so the cut is replaced with a real transition.
    // The very first application (on mount) stays an instant cut, though: `CameraControls`
    // only knows the R3F `Canvas`'s initial camera *position*, not this stage's actual
    // `target` (Stages 1-3's real targets moved off world-origin in Task 16, so its own
    // implicit default target is no longer a coincidental match) — animating from that
    // guessed starting orientation left the camera still visibly mid-settle well after a
    // fixed post-load wait, which every pre-existing "at rest"/"orbit locked" test relies
    // on being fully resolved. An instant cut on mount only, real transitions after.
    controlsRef.current?.setLookAt(...position, ...target, hasMountedRef.current)
    hasMountedRef.current = true
  }, [stage, framing])

  // Dev-only escape hatch, same spirit as store.ts's `window.__dimensionsStore` (Task
  // 14's note): lets e2e tests assert the camera's actual azimuth/polar/distance
  // directly instead of canvas-pixel diffing, which is unreliable on stages whose
  // material animates on its own (plane's noise fill, per Task 7). Needed to verify
  // Stages 1-2's orbit lock — a plain pixel comparison there would confuse "orbit did
  // nothing" with "orbit did something too subtle to show up," and can't tell the
  // difference from the fill's own idle drift either. Dead code eliminated from the
  // production build, same as the store hook.
  useEffect(() => {
    if (import.meta.env.DEV) {
      Object.assign(window, { __cameraControls: controlsRef.current })
    }
  }, [])

  // Task 17: `cameraControlsRef` mirrors this same instance out to
  // `ui/CameraDirectionalControls.tsx`, a plain DOM overlay outside the R3F `Canvas`
  // that drives `.rotate()`/`.dolly()` from button clicks — the production equivalent
  // of the dev-only `window.__cameraControls` hook above, needed there because it isn't
  // dev-only.
  useEffect(() => {
    cameraControlsRef.current = controlsRef.current
  }, [])

  // Task 23: per-frame spring-back. Whenever the camera's azimuth/polar sits outside
  // the current stage's `azimuthRange`/`polarRange` (its resistance-free zone —
  // `cameraFraming.ts`), ease it back toward the nearest edge of that range. Gated on
  // `!controls.active` (camera-controls' own "is a damped transition still running"
  // flag) rather than a fixed post-click delay: this is what stops the loop from
  // fighting either an in-flight stage-change `setLookAt` transition or a button's own
  // still-settling `rotate(..., true)` call, since both keep `active` true for as long
  // as they're actually moving the camera, including for the whole duration of a held
  // button (each repeat tick issues a fresh transition target). Stage 3+'s unclamped
  // range means `easedTowardRange` is a permanent no-op there — still completely free
  // movement, exactly Task 17's original behavior. Calls `.rotateTo(..., false)` (an
  // immediate, undamped set — see that method's own doc comment) rather than the
  // library's own damped `.rotate(..., true)`, so this loop supplies 100% of the
  // motion itself frame by frame instead of layering a second competing transition on
  // top of the library's.
  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls || controls.active) return
    const t = 1 - Math.exp(-SPRING_BACK_SHARPNESS * delta)
    const nextAzimuth = easedTowardRange(controls.azimuthAngle, framing.azimuthRange, t)
    const nextPolar = easedTowardRange(controls.polarAngle, framing.polarRange, t)
    if (nextAzimuth !== controls.azimuthAngle || nextPolar !== controls.polarAngle) {
      controls.rotateTo(nextAzimuth, nextPolar, false)
    }
  })

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      // Task 17: mouse-drag never orbits the camera anywhere anymore — permanently
      // disabling `CameraControls`' own pointer/wheel listeners is what makes a drag
      // mean exactly one thing everywhere it's available ("point," never "orbit"),
      // regardless of where on the canvas it starts. Camera movement instead comes
      // entirely from `ui/CameraDirectionalControls.tsx`'s buttons calling `.rotate()`/
      // `.dolly()` imperatively, which `.enabled` doesn't gate.
      enabled={false}
      // Task 23: `CameraControls` itself no longer enforces any per-stage clamp — this
      // is always its own natural full range now (these are also its defaults; stated
      // explicitly per Task 6's precedent of not silently depending on upstream
      // defaults). Per-stage restriction moved entirely into userland: `resistedStep`
      // (`CameraDirectionalControls.tsx`) resists a button push past a stage's
      // `azimuthRange`/`polarRange`, and the spring-back loop above eases any excess
      // back — see `cameraFraming.ts`'s `CameraFraming.azimuthRange` doc comment for
      // why a hard library-level clamp couldn't do both "still nudges" and "still
      // resists."
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
    />
  )
}

export function Experience() {
  return (
    <Canvas camera={{ position: CAMERA_FRAMING.line.position, fov: 50 }}>
      <color attach="background" args={['#0a0a0f']} />
      <SceneLights />
      <Grid />
      <StageGeometry />
      <CameraRig />
      <ArrowDrag />
      <RevealDrag />
      <CursorTracker />
      <CursorMarker />
      <TrackedCubeVertexTracker />
    </Canvas>
  )
}
