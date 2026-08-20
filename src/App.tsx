import { Experience } from './scene/Experience'
import { CameraDirectionalControls } from './ui/CameraDirectionalControls'
import { CubeFeedback } from './ui/CubeFeedback'
import { DebugStageControls } from './ui/DebugStageControls'
import { DimensionPanel } from './ui/DimensionPanel'
import { HUD } from './ui/HUD'
import { RevealControls } from './ui/RevealControls'

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Experience />
      <HUD />
      <DimensionPanel />
      <CubeFeedback />
      <RevealControls />
      <CameraDirectionalControls />
      <DebugStageControls />
    </div>
  )
}

export default App
