import { Canvas } from '@react-three/fiber'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useDimensionsStore } from '../state/store'
import { ArrowDrag } from './ArrowDrag'
import { CAMERA_FRAMING } from './cameraFraming'
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

export function Experience() {
  return (
    <Canvas camera={{ position: CAMERA_FRAMING.line.position, fov: 50 }}>
      <color attach="background" args={['#0a0a0f']} />
      <SceneLights />
      <StageGeometry />
      <CameraRig />
      <ArrowDrag />
    </Canvas>
  )
}
