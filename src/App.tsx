import { Experience } from './scene/Experience'
import { CubeFeedback } from './ui/CubeFeedback'
import { DebugStageControls } from './ui/DebugStageControls'
import { HUD } from './ui/HUD'
import { RevealControls } from './ui/RevealControls'

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Experience />
      <HUD />
      <CubeFeedback />
      <RevealControls />
      <DebugStageControls />
    </div>
  )
}

export default App
