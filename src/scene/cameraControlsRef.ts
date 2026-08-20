import type { CameraControlsImpl } from '@react-three/drei'

/**
 * Task 17: module-scoped mutable handle to the single `CameraControls` instance, set by
 * `Experience.tsx`'s `CameraRig` once mounted. `ui/CameraDirectionalControls.tsx` is a
 * plain DOM overlay rendered outside the R3F `Canvas`, so it has no `useThree()` access
 * to the controls instance — this is what lets its button clicks drive `.rotate()`/
 * `.dolly()` imperatively, the same way `window.__cameraControls` (dev-only) already
 * exposes it for Playwright, just available in production too since real button clicks
 * need it there.
 */
export const cameraControlsRef: { current: CameraControlsImpl | null } = { current: null }
