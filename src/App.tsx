import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BoxGeometry, EdgesGeometry, type Group } from 'three'

function TestCube() {
  const groupRef = useRef<Group>(null)
  const edges = useMemo(() => new EdgesGeometry(new BoxGeometry(1.5, 1.5, 1.5)), [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.x += delta * 0.4
    groupRef.current.rotation.y += delta * 0.6
  })

  return (
    <group ref={groupRef}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e5e4e7" />
      </lineSegments>
    </group>
  )
}

function App() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
      <color attach="background" args={['#0a0a0f']} />
      <TestCube />
    </Canvas>
  )
}

export default App
