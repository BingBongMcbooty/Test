import { Experience } from './scene/Experience'
import { DebugStageControls } from './ui/DebugStageControls'
import { HUD } from './ui/HUD'

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Experience />
      <HUD />
      <DebugStageControls />
    </div>
  )
}

export default App
