import { Canvas } from '@react-three/fiber'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useDimensionsStore } from '../state/store'
import { ArrowDrag } from './ArrowDrag'
import { Grid } from './Grid'
import { RevealDrag } from './RevealDrag'
import { CAMERA_FRAMING } from './cameraFraming'
import { cameraControlsRef } from './cameraControlsRef'
import { LIGHT_RIG } from './materials'
import { CubeStage } from './stages/CubeStage'
import { LineStage } from './stages/LineStage'
import { PlaneStage } from './stages/PlaneStage'
import { RevealStage } from './stages/RevealStage'

function StageGeometry() {
  const stage = useDimensionsStore((state) => state.stage)

  switch (stage) {
    case 'line':
      return <LineStage />
    case 'plane':
      return <PlaneStage />
    case 'cube':
      return <CubeStage />
    case 'reveal':
      return <RevealStage />
    // 'closing' gets its own scene in Task 15.
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
      // Per-stage azimuth/polar bounds (`cameraFraming.ts`): Stage 1 never renders the
      // buttons at all so its full range is moot; Stage 2 gets `PLANE_TILT_RANGE`'s
      // limited tilt; Stage 3 on gets the original unclamped full range.
      minPolarAngle={framing.polarRange?.[0] ?? 0}
      maxPolarAngle={framing.polarRange?.[1] ?? Math.PI}
      minAzimuthAngle={framing.azimuthRange?.[0] ?? -Infinity}
      maxAzimuthAngle={framing.azimuthRange?.[1] ?? Infinity}
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
    </Canvas>
  )
}
