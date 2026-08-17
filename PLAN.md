# Dimensions — a task-by-task Claude Code build guide

## Context

The goal is a small, single-page interactive web app that teaches spatial dimensions *experientially* rather than by explaining them. The player moves through four stages — a line (1D), a plane (2D), a cube (3D), and a moment where the 3D→4D step is genuinely impossible — before the app shows how a 4th dimension could be indirectly perceived (via cross-sections), and closes with the idea that this same wall repeats at every dimension.

The emotional core is the Stage 3 "surprise": the player *tries* to draw an arrow pointing to a 4th dimension and discovers, through their own honest attempts, that every direction they can drag is already expressible using the 3 axes they already have. That has to be a real discovery, not a scripted refusal — which is why the interaction design below reuses the exact same drag mechanic across all three stages instead of special-casing Stage 3.

This is a brand-new repo — completely empty, no scaffolding of any kind — so every task below starts from nothing and builds up in order.

### Locked decisions (from our conversation — don't re-litigate these)

| Decision | Choice |
|---|---|
| Stack | React + TypeScript + Vite, Three.js via `@react-three/fiber` + `@react-three/drei` |
| State | Zustand (kept separate from high-frequency drag state, see Task 3/9) |
| Testing | Vitest for math/logic, Playwright for real-browser visual verification |
| Arrow interaction | Click-drag in 3D space, live-rendered arrow, raycast onto a camera-facing plane |
| Stage 3 behavior | Free, unlocked attempts; app shows *why* each attempt fails (axis decomposition), no artificial lock |
| Stage 4 visualization | Cross-section slicing (4D tesseract sliced by a hyperplane, animated via 4D rotation) |
| Tone | Minimalist, philosophical — dark background, sparse wireframes, few well-chosen lines of text |
| Platform | Desktop only — mouse + keyboard, no touch |
| Persistence | None — single session, refresh resets to Stage 1 |
| Scope | Ends with a brief "this repeats at every dimension" closing beat — no interactive 5D stage |

### Architecture at a glance

```
src/
  state/store.ts          # stage machine: 'line'|'plane'|'cube'|'reveal'|'closing', attempts, isDrawing
  state/stageConfig.ts     # per-stage occupied axes + prompt copy
  math/validation.ts        # evaluateAttempt(dragVector, occupiedAxes) — the ONE function behind all 3 stages
  math/dragPlane.ts          # builds a camera-facing plane at the drag anchor; raycasts pointer onto it
  math/fourd.ts               # tesseract vertices/faces, 4D rotation, hyperplane slicing
  scene/Experience.tsx          # Canvas, CameraControls, stage router
  scene/ArrowDrag.tsx            # pointer-down/move/up: hit-test, mode switch, live drag feed
  scene/LiveArrow.tsx             # shaft+cone arrow mesh between two points
  scene/stages/{Line,Plane,Cube,Reveal}Stage.tsx
  ui/HUD.tsx, ui/FeedbackPanel.tsx
```

**Why one drag mechanic serves all three stages:** each stage just declares which axes are already "occupied" (line → X; plane → X,Y; cube → X,Y,Z). Validation projects the drawn vector onto the occupied subspace and checks what's left over. For the cube, the occupied subspace *is* all of 3D space, so the leftover is always exactly zero — Stage 3 fails not because of a special case, but because there's genuinely nowhere left to point. That's what makes the surprise real instead of scripted.

**Why a camera-facing plane for dragging:** a mouse drag is inherently 2D. Anchoring a plane at the click point, facing the camera, means dragging right on screen moves the arrow right — no learning curve — and it's non-degenerate from nearly any orbit angle (unlike a fixed world-space plane, which goes edge-on and unusable from many angles).

**Note on one deviation from what you described:** you mentioned rotating "around the object" (OrbitControls-style). This guide recommends drei's `CameraControls` instead of raw `OrbitControls` — same free 360° drag-to-orbit feel, but it also gives animated camera transitions between stages for free, avoiding hand-written tweening code. Behaviorally it's a superset; revisit if you'd rather keep it to literal `OrbitControls`.

---

## How to use this guide with Claude Code

Each task below is sized to be **one Claude Code session**: one deliverable, its own files, its own verification step. That sizing is deliberate — this app has a lot of fiddly 3D/vector math and interaction logic, and a session that tries to do too much at once is where Claude Code starts losing track of earlier decisions or re-deriving things inconsistently.

**Rules of thumb for when to start a fresh session:**
- Start a new session at every "— new session recommended —" marker below. These fall at natural seams: a subsystem is fully working and tested before the next one begins.
- If a task's Claude Code session is still going and starts feeling like it's re-reading a lot of its own earlier work to stay oriented, that's a sign to stop, commit, and continue in a fresh session rather than push through.
- Within a task, let Claude Code run the dev server and actually look at the result (Playwright/browser screenshot) before you consider it done — for a visual/interactive app, "it compiles" is not "it works."
- Give each session the task's deliverable + files + verification step from below as its prompt. You don't need to re-explain the whole app concept each time — a one-line pointer back to this plan (or pasting the relevant task section) is enough context.

---

## Task list

**Task 1 — Project scaffold**
Deliverable: Vite + React + TS app, `three`/`@react-three/fiber`/`@react-three/drei` installed, a bare `<Canvas>` rendering a rotating wireframe test cube (proves the pipeline works), ESLint/Prettier, folder skeleton per the architecture above.
Verify: `npm run dev`, confirm the rotating cube renders with no console errors; `npm run build` succeeds.

**Task 2 — Testing infrastructure**
Deliverable: Vitest with one passing smoke test; Playwright configured with a smoke e2e test that loads the dev server, asserts the canvas exists, and saves a screenshot.
Verify: `npm test` and `npx playwright test` both pass; open the screenshot.
*(Tasks 1–2 are light enough to combine into one session if you want.)*

**Task 3 — Global state store**
Deliverable: `state/store.ts` (Zustand: `stage`, `attempts`, `isDrawing`, `lastResult`, actions), `state/stageConfig.ts` (occupied axes + prompt copy per stage), unit tests for the store actions.
Verify: `npm test`. Optionally add throwaway debug buttons to manually cycle `stage` — useful for Task 5's verification.

**Task 4 — Validation math**
Deliverable: `math/validation.ts` — `projectOntoComplement`, `evaluateAttempt`. Vitest coverage: exact-orthogonal pass, exact-parallel fail, boundary-angle cases, and explicit confirmation that "occupied = full 3D basis" always fails (the Stage 3 property).
Verify: `npm test`, with hand-computed expected values noted in test comments.

**Task 5 — Scene shell + stage router**
Deliverable: `scene/Experience.tsx` — dark background, `CameraControls`, a router that renders the right wireframe primitive (line/plane/cube) per `store.stage`, camera reframing per stage (no animation yet), basic `HUD.tsx` showing stage name + placeholder prompt.
Verify: Playwright — load the page, see Stage 1's line; use the Task 3 debug buttons to cycle stages, confirm geometry swaps and camera reframes; screenshot each stage.

**Task 6 — Orbit interaction tuning**
Deliverable: confirm full 360° free orbit with no clamping, sensible per-stage camera distances, comfortable damping.
Verify: Playwright simulated drags in several directions (including "over the top"); before/after screenshots.

**— New session recommended here. The foundation (state, shell, orbit) is done; the drag-to-arrow interaction is the hardest subsystem in the app and deserves a clean start. —**

**Task 7 — Drag-plane math**
Deliverable: `math/dragPlane.ts` — pure functions building the camera-facing plane at an anchor point and raycasting a pointer position onto it. Unit-testable with hand-constructed camera/raycaster objects, no DOM needed.
Verify: `npm test` with a few camera-orientation cases confirming the plane faces the camera and raycasts land correctly.

**Task 8 — Arrow visual component**
Deliverable: `scene/LiveArrow.tsx` — shaft + cone between two `Vector3` points, styled to the minimal aesthetic. Drive it via temporary debug props (no interactivity yet).
Verify: toggle debug props, confirm it renders/updates and points the right way; screenshot.

**Task 9 — Pointer/drag controller**
Deliverable: `scene/ArrowDrag.tsx` — pointer-down hit-tests the current stage's object (give the line/plane an invisible, slightly inflated collider so they're clickable), enters draw mode and disables `CameraControls` for the drag, feeds `LiveArrow` from Task 7's plane math on pointer-move, restores orbit on pointer-up, discards too-short drags. No pass/fail logic yet.
Verify: Playwright — simulate a drag starting on the object (arrow appears mid-drag, screenshot) vs. starting off the object (camera orbits instead).
*This is likely the fiddliest task in the build. If it's not converging in one session, split "hit-test + mode switching" from "live arrow feed" into two sessions rather than pushing through.*

**Task 10 — Validation wiring for Stages 1 & 2**
Deliverable: on pointer-up, call `evaluateAttempt`; success advances the stage with a smooth camera transition into the next one; failure shows a brief fail cue (arrow flashes/fades), stays on the same stage.
Verify: Playwright — a roughly-orthogonal drag on Stage 1 advances to "plane"; a roughly-parallel drag stays on "line" with a fail cue; repeat for Stage 2 → reaches "cube".

**— New session recommended here. Stages 1–2 are fully playable end-to-end; Stage 3 needs its own distinct feedback UI. —**

**Task 11 — Stage 3 (cube) + decomposition feedback**
Deliverable: cube stage reuses the drag mechanic unmodified. On every pointer-up, show the x/y/z decomposition from `evaluateAttempt` (structurally always a "fail" here), increment `attempts`, show an "I understand" button, transition to `reveal` after N attempts (start with N=3, treat as tunable) or on the button click.
Verify: Playwright — a couple of cube drags stay on "cube" and show plausible non-zero x/y/z percentages; enough attempts (or the button) transitions to "reveal".

**— New session recommended here. The interactive puzzle is complete; Stage 4 is a self-contained animation subsystem with its own math. —**

**Task 12 — 4D math core**
Deliverable: `math/fourd.ts` — tesseract vertex generation (16 vertices), face generation via the axis-pair method (24 faces, no hardcoded table needed), `rotateXW`/`rotateYZ`, hyperplane slicing per face (no convex-hull library required — slice each square face's 4 edges directly). Thorough Vitest coverage: correct vertex/face counts, the known case (axis-aligned tesseract sliced at w=0 yields exactly a cube's 12 edges), and a sanity sweep across rotation angles with no NaNs.
Verify: `npm test`. This is the highest-risk math in the app — get it fully green before touching rendering.
*Fallback if this stalls: a 4D hypersphere sliced by w=w0 (radius = √(R²−w0²)) is simpler, still mathematically real, and matches the classic "sphere passing through Flatland looks like a growing-then-shrinking circle" analogy. Don't burn a whole extra session forcing the tesseract version — swap to the fallback and move on.*

**Task 13 — Reveal scene**
Deliverable: `scene/stages/RevealStage.tsx` — renders the cross-section as `THREE.LineSegments`, driven by a continuously-advancing rotation angle in `useFrame`, camera transition into the stage, short caption line.
Verify: Playwright screenshots a second or two apart, confirming the wireframe topology genuinely changes over time.

**Task 14 — Closing beat + restart**
Deliverable: after Stage 4 runs for a set duration (or on a "continue" click), fade in the closing line (something like "A 4-dimensional being trying to point to a 5th dimension hits the exact same wall.") and a restart button resetting to Stage 1.
Verify: Playwright confirms the text appears and restart returns cleanly to Stage 1.

**— New session recommended here. The core experience is complete; what's left is regression-proofing and polish. —**

**Task 15 — Full-playthrough regression test**
Deliverable: one Playwright test scripting the entire path (Stage 1 pass → Stage 2 pass → a few Stage 3 fails → give up → Stage 4 → closing → restart), as a safety net for future changes. Fix any rough edges it surfaces.
Verify: the test passing is the verification; also save a screenshot per stage.

**Task 16 — Visual/tone polish** *(optional, flexible ordering)*
Deliverable: refine wireframe materials/line weights/colors, HUD typography, subtle stage-transition fades, progress indicator, final copy pass.
Verify: screenshots reviewed against the "minimalist/philosophical" tone — worth a quick look-over before calling it done, since tone is subjective.

**Task 17 — Deploy** *(optional, only if you want it live somewhere)*
Deliverable: static deploy config (Vercel/Netlify/GitHub Pages) for the Vite build output.
Verify: `npm run build && npm run preview` matches dev behavior; deployed URL loads correctly.

---

## Tunable parameters (defaults are reasonable guesses, not final answers)

- **Angular tolerance for "roughly orthogonal"** (Task 4): `ratio >= 0.7` (~44° tolerance) as a starting point — worth an actual playtest to see if it feels right.
- **Axis convention** (line=X, plane=XY, cube=XYZ): arbitrary but touches many files once set — fine to leave as-is, but this is the one thing costly to change later, so a quick sanity check before Task 5 is worth it.
- **Attempts before Stage 4** (Task 11): defaulted to 3.
- **"Give up" button visibility** (Task 11): defaulted to appearing after the first failed attempt, to encourage one genuine try first.

## Verification philosophy throughout

Because this is a visual, interactive app, "the code compiles" or "the unit tests pass" is necessary but never sufficient. Every task above ends with an explicit browser-based check — either a manual `npm run dev` look, or a Playwright script with a screenshot. Insist on that at every task boundary; it's the only way to catch a scene that renders but looks wrong, or an interaction that technically fires but feels off.
