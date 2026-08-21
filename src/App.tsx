import { Experience } from './scene/Experience'
import { CameraDirectionalControls } from './ui/CameraDirectionalControls'
import { ClosingBeat } from './ui/ClosingBeat'
import { ClosingContinue } from './ui/ClosingContinue'
import { CubeFeedback } from './ui/CubeFeedback'
import { DebugStageControls } from './ui/DebugStageControls'
import { DimensionPanel } from './ui/DimensionPanel'
import { HUD } from './ui/HUD'
import { RevealControls } from './ui/RevealControls'
import { SliceWarmupControls } from './ui/SliceWarmupControls'
import { StageContinue } from './ui/StageContinue'

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Experience />
      <HUD />
      <DimensionPanel />
      <CubeFeedback />
      <StageContinue />
      <RevealControls />
      <SliceWarmupControls />
      <ClosingContinue />
      <ClosingBeat />
      <CameraDirectionalControls />
      <DebugStageControls />
    </div>
  )
}

export default App
