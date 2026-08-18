import { Canvas } from '@react-three/fiber'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useDimensionsStore } from '../state/store'
import { CAMERA_FRAMING } from './cameraFraming'
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

function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const stage = useDimensionsStore((state) => state.stage)

  useEffect(() => {
    const { position, target } = CAMERA_FRAMING[stage]
    controlsRef.current?.setLookAt(...position, ...target, false)
  }, [stage])

  return <CameraControls ref={controlsRef} makeDefault />
}

export function Experience() {
  return (
    <Canvas camera={{ position: CAMERA_FRAMING.line.position, fov: 50 }}>
      <color attach="background" args={['#0a0a0f']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <StageGeometry />
      <CameraRig />
    </Canvas>
  )
}
