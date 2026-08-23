import { Experience } from './scene/Experience'
import { CameraDirectionalControls } from './ui/CameraDirectionalControls'
import { ClosingBeat } from './ui/ClosingBeat'
import { ClosingContinue } from './ui/ClosingContinue'
import { CubeFeedback } from './ui/CubeFeedback'
import { DebugStageControls } from './ui/DebugStageControls'
import { DimensionPanel } from './ui/DimensionPanel'
import { DimensionWelcome } from './ui/DimensionWelcome'
import { HUD } from './ui/HUD'
import { ProgressIndicator } from './ui/ProgressIndicator'
import { RevealControls } from './ui/RevealControls'
import { SliceWarmupControls } from './ui/SliceWarmupControls'
import { StageTransitionFade } from './ui/StageTransitionFade'

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Experience />
      <HUD />
      <DimensionPanel />
      <ProgressIndicator />
      <CubeFeedback />
      <DimensionWelcome />
      <RevealControls />
      <SliceWarmupControls />
      <ClosingContinue />
      <ClosingBeat />
      <CameraDirectionalControls />
      <DebugStageControls />
      <StageTransitionFade />
    </div>
  )
}

export default App
