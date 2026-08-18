import { Canvas } from '@react-three/fiber'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { useDimensionsStore } from '../state/store'
import { CAMERA_FRAMING } from './cameraFraming'
import { LiveArrow } from './LiveArrow'
import { LIGHT_RIG } from './materials'
import { CubeStage } from './stages/CubeStage'
import { LineStage } from './stages/LineStage'
import { PlaneStage } from './stages/PlaneStage'

function StageGeometry() {
  const stage = useDimensionsStore((state) => state.stage)

  switch (stage) {
    case 'line':
      return <LineStage />
    case 'plane':
      return <PlaneStage />
    case 'cube':
      return <CubeStage />
    // 'reveal' and 'closing' get their own scenes in Tasks 13/14.
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

  useEffect(() => {
    const { position, target } = CAMERA_FRAMING[stage]
    controlsRef.current?.setLookAt(...position, ...target, false)
  }, [stage])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      // Explicit full-orbit range (these happen to match camera-controls' own
      // defaults, but declared rather than left implicit): nothing in this scene is
      // grounded, so there's no "floor" to stop the player orbiting under or over.
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
    />
  )
}

// Task 9 verification only: LiveArrow has no real input yet (that's Task 10), so these
// presets let a human/Playwright toggle through a few start/end pairs to confirm it
// renders, updates, and points the right way. Delete once Task 10's real drag feed
// replaces it — same lifecycle as `ui/DebugStageControls.tsx`.
const DEBUG_ARROWS: Record<string, { start: Vector3; end: Vector3 } | null> = {
  hidden: null,
  'short +x': { start: new Vector3(-1, 0, 0), end: new Vector3(1, 0, 0) },
  'tall +y': { start: new Vector3(0, -1.2, 0), end: new Vector3(0, 1.2, 0) },
  diagonal: { start: new Vector3(-0.9, -0.9, 0.9), end: new Vector3(0.9, 0.9, -0.9) },
}

function DebugArrowControls({
  value,
  onChange,
}: {
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        display: 'flex',
        gap: '0.5rem',
        padding: '1rem',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {Object.keys(DEBUG_ARROWS).map((key) => (
        <button
          key={key}
          type="button"
          data-testid={`debug-arrow-${key}`}
          onClick={() => onChange(key)}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.75rem',
            background: key === value ? '#ffb454' : 'transparent',
            color: key === value ? '#0a0a0f' : '#ffb454',
            border: '1px solid #ffb454',
            borderRadius: '999px',
            cursor: 'pointer',
          }}
        >
          {key}
        </button>
      ))}
    </div>
  )
}

export function Experience() {
  const [debugArrowKey, setDebugArrowKey] = useState('short +x')
  const debugArrow = DEBUG_ARROWS[debugArrowKey]

  return (
    <>
      <Canvas camera={{ position: CAMERA_FRAMING.line.position, fov: 50 }}>
        <color attach="background" args={['#0a0a0f']} />
        <SceneLights />
        <StageGeometry />
        {debugArrow && <LiveArrow start={debugArrow.start} end={debugArrow.end} />}
        <CameraRig />
      </Canvas>
      <DebugArrowControls value={debugArrowKey} onChange={setDebugArrowKey} />
    </>
  )
}
