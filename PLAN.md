# Dimensions — a task-by-task Claude Code build guide

## Context

The goal is a small, single-page interactive web app that teaches spatial dimensions *experientially* rather than by explaining them. The player moves through four stages — a line (1D), a plane (2D), a cube (3D), and a moment where the 3D→4D step is genuinely impossible — before the app shows how a 4th dimension could be indirectly perceived (via cross-sections), and closes with the idea that this same wall repeats at every dimension.

The emotional core is the Stage 3 "surprise": the player *tries* to draw an arrow pointing to a 4th dimension and discovers, through their own honest attempts, that every direction they can drag is already expressible using the 3 axes they already have. That has to be a real discovery, not a scripted refusal — which is why the interaction design below reuses the exact same drag mechanic across all three stages instead of special-casing Stage 3.

This is a brand-new repo — completely empty, no scaffolding of any kind — so every task below starts from nothing and builds up in order.

### Locked decisions (from our conversation — don't re-litigate these)

| Decision | Choice |
|---|---|
| Stack | React + TypeScript + Vite, Three.js via `@react-three/fiber` + `@react-three/drei` |
| State | Zustand (kept separate from high-frequency drag state, see Task 3/10) |
| Testing | Vitest for math/logic, Playwright for real-browser visual verification |
| Arrow interaction | Click-drag in 3D space, live-rendered arrow, raycast onto a camera-facing plane |
| Stage 3 behavior | Free, unlocked attempts; app shows *why* each attempt fails (axis decomposition), no artificial lock |
| Cube rendering (Stage 3 on) | Full richness tier of the Stage 1→2→3 visual escalation (see Tone): a shader/texture-driven material (procedural, not image-based) plus a proper multi-light setup, still translucent enough that the far side of the shape and a mid-drag arrow stay legible from any orbit angle. Supersedes Task 5's flatter `MeshStandardMaterial` + single-light version — see Task 7. |
| Stage 4 visualization | Both, player-driven rather than autoplayed: cross-section slicing (4D tesseract sliced by a hyperplane, default view) and 4D→3D projection (flattened "shadow" view), toggled, both computed from one shared rotation/offset state that the player controls by dragging — see Task 13/14. Continues Task 7's visual-escalation material system rather than reverting to something flatter. Preceded by a short 3D warm-up (Task 20) that demonstrates slicing on an ordinary, familiar solid before handing the player the same interaction one dimension up. |
| Tone | Philosophical throughout, but visually escalates with dimension rather than staying flat: Stage 1 (line) stays the sparest possible mark — pure wireframe, unchanged. Stage 2 (plane) is transitional, "a cross between the two" — wireframe stays primary but gains a first hint of shading/texture. Stage 3 (cube) on gets the full treatment: textured, multi-light, shader-driven materials (see Task 7). Text stays sparse and well-chosen at every stage — the escalation is visual, not verbal. *(Revised from the original flat "minimalist throughout" call.)* |
| Platform | Desktop only — mouse + keyboard, no touch |
| Persistence | None — single session, refresh resets to Stage 1 |
| Scope | Ends with a brief "this repeats at every dimension" closing beat — no interactive 5D stage |
| Live instrumentation | An always-visible small readout, present from Stage 1 on, showing exactly what the player's own input means numerically rather than relying on the visual alone to teach — see Tasks 15/19. Numbers communicate through their absence as much as their presence: a locked axis, a real value the current view just isn't showing, and "nothing attempted yet" are three different kinds of "no data" and get three different treatments (see Task 19's placeholder vocabulary), not one universal blank. |
| Chirality demo | A second Stage 4 interaction, alongside slicing/projection, showing what a 4D rotation can do that no 3D rotation can: an asymmetric 3D shape flipped into its own mirror image by the exact same drag control already driving `revealRotationXW`/`revealRotationYW` — see Task 21. Reuses `rotateXW`/`rotateYW`/`projectTo3D` verbatim; only the shape and its material are new. |
| Camera per stage *(added post-Task-15, playtest feedback)* | Free orbit (`CameraControls`) only unlocks from Stage 3 (cube) on — Stages 1-2 lock it off entirely, so a player can't discover "this is really 3D" just by dragging the screen. Stage 1 also moved to a dead-on, straight-ahead framing; Stage 2 kept its original oblique angle even though orbit is locked there too, since a dead-on camera on Stage 2 makes the very axis "leaving the plane" needs mathematically undraggable (the camera-facing drag plane's normal would coincide with that axis). Task 16 repositioned Stage 2 (and every shape) into the positive octant without touching this tension — per direct user feedback given during that task, the actual fix isn't a camera-angle compromise at all, it's moving camera movement off mouse-drag entirely so drag can mean one consistent thing everywhere; see Task 17 and PROGRESS.md's Task 16 notes. |
| Coordinate-space grids *(added post-Task-15, playtest feedback)* | A background reference grid per stage — dotted number-line (Stage 1), x/y graph paper (Stage 2), a positive-octant-only 3D grid (Stage 3, like standing in the corner of a room) — reinforcing "this is the whole space" visually, not just through the absence of orbit above. Existing shapes move to sit fully within the positive octant to match a grid that only covers positive coordinates — see Task 16. |
| On-screen camera controls *(added post-Task-16, playtest feedback)* | Mouse-drag camera orbit is replaced by explicit on-screen directional controls, so a mouse-drag means exactly one thing everywhere it's available — "point in a direction to test the current shape" (Stages 1-3) or "rotate the tesseract / move the slice" (Stage 4) — never "orbit the camera," which today depends on incidental pointer position/collider hits. See Task 17. |
| Advance timing *(added post-Task-15, playtest feedback)* | A pass on Stages 1-2 no longer auto-advances the instant it happens — the player can keep exploring (drag again, pass or fail, as many times as they like) until they choose to continue, mirroring Stage 3's existing `CubeFeedback` "I understand" pattern rather than the app deciding for them — see Task 18. |

### Architecture at a glance

```
src/
  state/store.ts          # stage machine: 'line'|'plane'|'cube'|'reveal'|'closing', attempts, isDrawing
  state/stageConfig.ts     # per-stage occupied axes + prompt copy
  math/validation.ts        # evaluateAttempt(dragVector, occupiedAxes) — the ONE function behind all 3 stages
  math/dragPlane.ts          # builds a camera-facing plane at the drag anchor; raycasts pointer onto it
  math/fourd.ts               # tesseract vertices/faces, 4D rotation, hyperplane slicing + 4D→3D projection
  scene/Experience.tsx          # Canvas, CameraControls, stage router
  scene/materials.ts             # shared shader/material defs + per-stage richness progression (Task 7)
  scene/ArrowDrag.tsx             # pointer-down/move/up: hit-test, mode switch, live drag feed
  scene/LiveArrow.tsx              # shaft+cone arrow mesh between two points
  scene/stages/{Line,Plane,Cube,Reveal}Stage.tsx
  scene/Grid.tsx                # Task 16: per-stage coordinate-space background (dotted line / xy grid / positive-octant 3D grid)
  ui/CameraDirectionalControls.tsx (name tentative) # Task 17: on-screen camera controls, replacing mouse-drag orbit
  scene/SliceWarmup.tsx        # Task 20: 3D cone-slicing intro, ordinary-space rehearsal for Task 14's hyperplane slice
  scene/ChiralityDemo.tsx      # Task 21: asymmetric shape + 180° xw rotation -> mirror image
  ui/HUD.tsx, ui/FeedbackPanel.tsx
  ui/DimensionPanel.tsx        # Tasks 15/19: the live x/y/z/w + derived-value readout
```

**Why visual richness escalates with dimension:** the app's core idea is that more axes unlock more of what's expressible — line → plane → cube keeps *adding room to move*. Task 7 makes that legible at the material level too: Stage 1 stays the sparest possible mark (a single wireframe line), Stage 2 gains a first hint of surface, and Stage 3 arrives fully lit, textured, and shaded. The growing visual weight tracks the growing dimensional freedom, instead of the whole app looking uniformly minimal regardless of how much is actually happening on screen.

**Why one drag mechanic serves all three stages:** each stage just declares which axes are already "occupied" (line → X; plane → X,Y; cube → X,Y,Z). Validation projects the drawn vector onto the occupied subspace and checks what's left over. For the cube, the occupied subspace *is* all of 3D space, so the leftover is always exactly zero — Stage 3 fails not because of a special case, but because there's genuinely nowhere left to point. That's what makes the surprise real instead of scripted.

**Why a camera-facing plane for dragging:** a mouse drag is inherently 2D. Anchoring a plane at the click point, facing the camera, means dragging right on screen moves the arrow right — no learning curve — and it's non-degenerate from nearly any orbit angle (unlike a fixed world-space plane, which goes edge-on and unusable from many angles).

**Why Stage 4 shows the tesseract two ways:** a 4D→3D *projection* flattens the whole object at once, the same relationship a cube's 2D shadow has to the cube — you see everything, just compressed. A hyperplane *slice* shows only whatever part of the object currently intersects your 3D "plane of existence," the same relationship a sphere passing through Flatland has to a 2D creature living there — you never see the whole thing, only a partial, changing piece of it. Both are real techniques used in the wild, and they teach slightly different lessons, so rather than pick one, Stage 4 keeps a single piece of 4D state (rotation angles, slice `w0`) that the player drives directly by dragging — reusing the exact same drag-plane machinery from Stages 1–3 — with a toggle to switch which lens they're looking at that state through.

**Why a 3D slicing warm-up comes first (Task 20):** "moving a hyperplane through a tesseract changes its cross-section" is not an intuitive sentence on its own. "Moving a knife through a loaf of bread changes the shape of the slice" is something everyone already understands without being told. A real playtest of Task 14 confirmed the tesseract slice reads as a confusing "wobble" without that grounding first — so before the player ever sees the 4D version, they watch the identical interaction (a moving cutting plane, a changing cross-section) happen to an ordinary, familiar 3D solid. The pattern-recognition is already built by the time it's asked to carry a 4th dimension.

**Why the chirality demo (Task 21) matters beyond being a neat trick:** every other demonstration in this app shows the hidden dimension as *more room to move* — one more axis, one more way to escape. The mirror-flip is different in kind: it shows the hidden dimension doing something a 3D rotation structurally cannot, no matter how it's oriented (a left hand and a right hand are 3D mirror images no 3D rotation ever superimposes). It reuses the exact rotation math already built for Stage 4 (a 180° `rotateXW`, viewed via `projectTo3D`, is provably a mirror reflection when restricted to 3 axes — see Task 21's notes) — so the "same input, same responsiveness" feel the player already has from rotating the tesseract carries directly over, which is what makes the demo land as "oh, THAT'S what this rotation was doing" rather than a disconnected new mechanic.

**Why coordinate-space grids, and why positive-octant only (Task 16):** the post-Task-15 orbit lock (see PROGRESS.md) fixed Stages 1-2 leaking their "real" 3D nature through *interaction* (you could no longer spin the camera and catch it out), but the scene itself still doesn't visually assert its own dimensionality — a bare line or plane floating in black space doesn't obviously say "this is the whole world" any more than it says "this is a fragment of a bigger one." A background grid states it directly: the space you can draw into is exactly the space the grid covers, nothing more. Restricting the grid to the positive octant (rather than a full grid extending in every direction) is a legibility call, not just a simplification — a symmetric grid extending equally in all 8 octants of 3D space is visually noisy and doesn't have an obvious "edge," where one octant reads immediately and unambiguously, the same instinctive way the corner of a real room does.

**Why on-screen camera controls (Task 17):** Task 16 repositioned every shape and gave each stage its own coordinate-space grid, but left Stage 2's camera tension exactly where it was — a dead-on view makes "leaving the plane" mathematically undraggable, an oblique one only partially sells "this is flat," and no angle in between fully escapes that trade-off, because the trade-off's root cause is that the *same* mouse-drag currently means two different things depending on where it starts: orbit the camera, or draw the axis-testing arrow. Moving camera movement onto explicit buttons removes that ambiguity at the source rather than continuing to tune around it — once a drag can never accidentally reorient the camera, Stage 2's framing is free to be chosen purely for how well it reads as a 2D world, and every other stage gets a more legible interaction model as a side effect: drag always means "point," full stop.

**Why the linger-before-advance change (Task 18):** every other piece of feedback in this app rewards patience — the fail cue lets you see exactly what went wrong and try again immediately, Stage 3's `CubeFeedback` shows decomposition percentages and waits for "I understand." A *pass* on Stages 1-2 was the one place that didn't: the instant a drag cleared the threshold, the stage changed underneath the player, with no beat to actually register what they'd just found or try a couple more passing directions to build intuition for *why* it passed. This isn't a bug in the validation logic — `evaluateAttempt` was always going to succeed or fail the moment a drag ends — it's that "succeed" and "the app immediately acts on that" were the same event, and didn't need to be.

**Why the instrumentation panel is its own pair of tasks (15/19), not folded into earlier ones:** the whole app is built to teach *experientially* — the point was always to let the player discover the wall by hitting it, not to explain it up front. The panel doesn't change that; it runs alongside the existing mechanic and turns "what just happened" into something legible in numbers as well as motion, for players who want both. Splitting it in two (Stages 1–3 retrofit as Task 15, Stage 4's richer readouts as Task 19) matches the sizing philosophy every other task in this doc follows — Task 15 touches `ArrowDrag.tsx`, which Task 10's own notes already flagged as fiddly, and Task 19 needs genuinely new live computation (cross-section edge count, extent) that doesn't exist anywhere yet.

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
Deliverable: `scene/Experience.tsx` — dark background, `CameraControls`, a router that renders the right primitive per `store.stage`: line and plane stay pure wireframe (no face to shade), but the cube gets solid, lit faces (`MeshStandardMaterial` + a directional light) with a thin wireframe edge overlay, translucent fill so depth reads without occluding the far side of the shape or a mid-drag arrow from any orbit angle. Camera reframing per stage (no animation yet), basic `HUD.tsx` showing stage name + placeholder prompt.
Verify: Playwright — load the page, see Stage 1's line; use the Task 3 debug buttons to cycle stages, confirm geometry swaps and camera reframes; screenshot each stage.

**Task 6 — Orbit interaction tuning**
Deliverable: confirm full 360° free orbit with no clamping, sensible per-stage camera distances, comfortable damping.
Verify: Playwright simulated drags in several directions (including "over the top"); before/after screenshots.

**Task 7 — Visual richness & material progression**
Deliverable: `scene/materials.ts` — a shared shader/material system driving deliberate visual escalation instead of a flat treatment across stages. Stage 1 (line) stays exactly as it is — it already reads well, don't touch it. Stage 2 (plane) becomes transitional, "a cross between the two": the wireframe outline stays primary, but the fill gains a first hint of shading/texture (e.g. a faint lit or animated surface, well short of full opacity) foreshadowing what's coming. Stage 3 (cube) onward gets the full treatment: a proper multi-light setup (beyond flat ambient + one directional light), and shader/texture detail — prefer procedural (noise/fresnel-driven `ShaderMaterial`, or drei's `shaderMaterial` helper) over sourced image textures, since there's no texture-asset pipeline in this repo yet. The cube's far side and a mid-drag arrow still need to stay legible through it from any orbit angle — same constraint Task 5 had, just with a richer material meeting it.
Verify: Playwright screenshots per stage, reviewed by hand against the escalation goal — Stage 1 unchanged, Stage 2 visibly "in between," Stage 3 visibly richer than Task 5's flat version. Confirm no console/shader-compile errors and a rough frame-rate sanity check, since shaders can be expensive.
*Design work like this wants a lot of "look at it, adjust, look again" cycles. Likely a candidate for splitting — e.g. nail the cube's shader/lighting first, then retrofit the Stage 1→2 progression — if it doesn't converge in one session, same as Tasks 10/13/14.*

**— New session recommended here. The foundation (state, shell, orbit, visual identity) is done; the drag-to-arrow interaction is the hardest subsystem in the app and deserves a clean start. —**

**Task 8 — Drag-plane math**
Deliverable: `math/dragPlane.ts` — pure functions building the camera-facing plane at an anchor point and raycasting a pointer position onto it. Unit-testable with hand-constructed camera/raycaster objects, no DOM needed.
Verify: `npm test` with a few camera-orientation cases confirming the plane faces the camera and raycasts land correctly.

**Task 9 — Arrow visual component**
Deliverable: `scene/LiveArrow.tsx` — shaft + cone between two `Vector3` points, styled consistently with each stage's material treatment from Task 7 rather than one fixed look. Drive it via temporary debug props (no interactivity yet).
Verify: toggle debug props, confirm it renders/updates and points the right way; screenshot.

**Task 10 — Pointer/drag controller**
Deliverable: `scene/ArrowDrag.tsx` — pointer-down hit-tests the current stage's object (give the line/plane an invisible, slightly inflated collider so they're clickable), enters draw mode and disables `CameraControls` for the drag, feeds `LiveArrow` from Task 8's plane math on pointer-move, restores orbit on pointer-up, discards too-short drags. No pass/fail logic yet.
Verify: Playwright — simulate a drag starting on the object (arrow appears mid-drag, screenshot) vs. starting off the object (camera orbits instead); on the cube stage, confirm the arrow still reads clearly against Task 7's material from a couple of orbit angles.
*This is likely the fiddliest task in the build. If it's not converging in one session, split "hit-test + mode switching" from "live arrow feed" into two sessions rather than pushing through.*

**Task 11 — Validation wiring for Stages 1 & 2**
Deliverable: on pointer-up, call `evaluateAttempt`; success advances the stage with a smooth camera transition into the next one; failure shows a brief fail cue (arrow flashes/fades), stays on the same stage.
Verify: Playwright — a roughly-orthogonal drag on Stage 1 advances to "plane"; a roughly-parallel drag stays on "line" with a fail cue; repeat for Stage 2 → reaches "cube".

**— New session recommended here. Stages 1–2 are fully playable end-to-end; Stage 3 needs its own distinct feedback UI. —**

**Task 12 — Stage 3 (cube) + decomposition feedback**
Deliverable: cube stage reuses the drag mechanic unmodified. On every pointer-up, show the x/y/z decomposition from `evaluateAttempt` (structurally always a "fail" here), increment `attempts`, show an "I understand" button, transition to `reveal` after N attempts (start with N=3, treat as tunable) or on the button click.
Verify: Playwright — a couple of cube drags stay on "cube" and show plausible non-zero x/y/z percentages; enough attempts (or the button) transitions to "reveal".

**— New session recommended here. The interactive puzzle is complete; Stage 4 is a self-contained animation subsystem with its own math. —**

**Task 13 — 4D math core**
Deliverable: `math/fourd.ts` — tesseract vertex generation (16 vertices), face generation via the axis-pair method (24 faces, no hardcoded table needed), `rotateXW`/`rotateYZ`. Two rendering paths off the same rotated vertices: (a) hyperplane slicing per face (no convex-hull library required — slice each square face's 4 edges directly) and (b) `projectTo3D`, a perspective 4D→3D projection ("drop w" with distance-based scaling, the same idea as the classic rotating-tesseract animation) that flattens the whole shape instead of slicing it. Thorough Vitest coverage: correct vertex/face counts; the known slicing case (axis-aligned tesseract sliced at w=0 yields exactly a cube's 12 edges); a sanity sweep across rotation angles with no NaNs, for both the slicing and projection paths.
Verify: `npm test`. This is the highest-risk math in the app, and it's now two techniques instead of one — get both fully green before touching rendering. If it's not converging, do the slicing half and the projection half as two separate sessions rather than forcing both into one.
*Fallback if slicing stalls: a 4D hypersphere sliced by w=w0 (radius = √(R²−w0²)) is simpler, still mathematically real, and matches the classic "sphere passing through Flatland looks like a growing-then-shrinking circle" analogy.*
*Fallback if the perspective projection stalls: a plain orthographic projection (just drop the w coordinate, no distance scaling) is less visually dramatic but trivial to implement and still mathematically real — fine for Task 14 to build against. Don't burn a whole extra session chasing the perspective version — swap to whichever fallback you need and move on.*

**Task 14 — Reveal scene**
Deliverable: `scene/stages/RevealStage.tsx` — renders the tesseract as `THREE.LineSegments` in one of two views, `revealView: 'slice' | 'projection'` (add to the Task 3 store), both computed from one shared piece of 4D state (rotation angles, slice `w0`). Instead of autoplaying, the player drives that state directly: reuse `math/dragPlane.ts`'s camera-facing-plane raycast so a horizontal drag maps to 4D rotation and a depth/vertical drag maps to the slice offset — the same drag mechanic as Stages 1–3, repurposed rather than re-invented. A toggle button swaps `revealView` without resetting the underlying rotation/offset. Camera transition into the stage, short caption line. Extend Task 7's material/lighting system here rather than reverting to something flatter — the visual escalation should carry through into 4D, not stop at the cube.
Verify: Playwright — drag at a few points and confirm the rendered wireframe topology changes in response to input (not on a timer); toggle the view and confirm slice/projection render the same underlying state two different ways; screenshot each view a beat apart to show it's responsive, not a canned loop.
*This task grew with the addition of interactivity and the view toggle — if it's not converging in one session alongside Task 13, treat "get slicing and projection both rendering, non-interactively" and "wire up drag control + the toggle" as two separate sessions.*

**— New session recommended here. Stage 4's core interaction is fully built and tested; this task retrofits Stages 1–3 with new instrumentation rather than extending Stage 4 itself — a clean subsystem break. —**

**Task 15 — Live instrumentation panel (Stages 1–3)**
Deliverable: `ui/DimensionPanel.tsx`, visible from Stage 1 on. Shows a full x/y/z/w axis ledger every stage — unlocked axes show the live drag value, axes not yet reachable at the current dimension read **"Unknown, unreachable"** rather than a blank or zero, so the ledger visibly has four rows from the very first screen even though only one is ever lit. Alongside it: the live distance formula extending with whichever axes are unlocked (`|x|` → `√(x²+y²)` → `√(x²+y²+z²)`), the *numeric* orthogonality ratio `evaluateAttempt` already computes updating live during a drag (not just the pass/fail outcome), and a vertex/edge count for the current stage's shape (1 edge for the line, 4 for the square, 12 for the cube) that visibly builds the doubling pattern `math/fourd.ts` will complete in Task 19. The live drag vector currently lives in `ArrowDrag.tsx`'s local component state on purpose (Task 3/10's locked decision) — rather than lifting the whole thing into the store, add one small dedicated store field for the live readout value, the same kind of boundary-crossing `isDrawing` already does, and leave the rest of `ArrowDrag.tsx`'s local state untouched.
Verify: Playwright — drag on Stage 1, confirm `x` and the orthogonality ratio update live and `y`/`z`/`w` all read "Unknown, unreachable"; repeat on Stage 2/3 confirming previously-locked axes light up with real values as they unlock; screenshot each stage.

**— New session recommended here. Two more rounds of playtest feedback landed after Task 15 (see PROGRESS.md's "Design pivot" notes) — both are Stages 1-3 polish, not Stage 4 work, and are different enough subsystems from each other (scene geometry vs. interaction/UI flow) to warrant their own sessions too, same as Task 15/19's own split. —**

**Task 16 — Coordinate-space grid backgrounds + positive-octant repositioning**
Deliverable: a background reference grid per stage, reinforcing "this is the whole space" the same way Task 15's post-merge orbit-lock pivot did (see PROGRESS.md) — visible, not just implied by the absence of orbit. Stage 1 gets a dotted number-line the line sits on top of; Stage 2 gets an x/y graph-paper grid; Stage 3 gets a 3D grid restricted to the positive octant only — three grid-planes (floor `xy` at `z=0`, walls `xz` at `y=0` and `yz` at `x=0`) meeting at the origin, like standing in the corner of a room, rather than a full grid extending in all directions (simpler to read, and avoids a grid needlessly doubling back behind the camera). The existing shapes are currently centered on the origin, extending into negative coordinates (the line runs -1.5→1.5, etc.) — a positive-octant grid wouldn't actually surround them, only half-cover them, so this task also repositions every shape to sit fully within the positive octant (e.g. the line 0→3 along `x`, the cube with a corner at the origin) to match. `cameraFraming.ts`'s per-stage positions/targets and `ArrowDrag.tsx`'s collider positions move with the shapes; `math/validation.ts` needs no change, since it operates on drag *vectors* (differences between two points), which are translation-invariant — repositioning the shapes doesn't change what a given drag direction evaluates to.
Verify: Playwright — screenshot each stage confirming the shape sits fully within its grid rather than partially off it; confirm existing drag/validation/pass-fail behavior (`e2e/validation-wiring.spec.ts`, `e2e/instrumentation-panel.spec.ts`) still passes unmodified at the new coordinates, since only positions moved, not the underlying math.
*Tunable: exact grid spacing/line weight/opacity, and how far the grid extends past each shape — left to this task's own eye, in the same "look at it, adjust, look again" spirit as Task 7's material work.*

**— New session recommended here. Task 16's grid/repositioning work is a rendering/scene-geometry change, fully done and tested; swapping the camera's own input model is a distinct interaction-model subsystem — a good seam to start fresh. —**

**Task 17 — On-screen directional controls replace mouse-drag camera orbit**
Deliverable: per direct playtest feedback given during Task 16 (see PROGRESS.md's Task 16 notes), swap `CameraControls`' mouse-drag-to-orbit for explicit on-screen directional controls (e.g. arrow buttons rotating the camera around the current stage's shape) wherever camera movement is offered at all. The point isn't just UI chrome — it frees mouse-drag to mean exactly one thing everywhere it's available: "point in a direction, to test whether it leaves the current shape" (Stages 1–3's existing `ArrowDrag.tsx` mechanic) or "rotate the tesseract / move the slice" (Stage 4's `RevealDrag.tsx`), rather than a drag sometimes orbiting the camera and sometimes drawing an arrow depending on where the pointer happens to land or which stage's collider it starts on. This is also expected to resolve Stage 2's still-open camera tension (see the "Camera per stage" locked-decision row and PROGRESS.md's Task 16 notes) from a different angle than the tuning options previously on the table: once the camera's own orientation can no longer be nudged by an ordinary drag, Stage 2's framing (dead-on, oblique, or something else) can be chosen purely on how well it sells "this is a flat 2D world," without also having to keep the "leaving the plane" drag geometrically possible.
Verify: Playwright — clicking the on-screen directional controls reorients the camera on every stage that offers them (screenshot before/after); confirm a mouse-drag on every stage always drives the axis-testing or rotation arrow, never the camera, regardless of where on the canvas it starts; the full existing drag/validation/instrumentation suite continues to pass unmodified, since `math/validation.ts` and `math/fourd.ts` only ever see the resulting drag vector, never how it was produced.
*Tunable, left entirely to this task's own UX judgment — none of this was settled in the conversation that raised the idea, only the core direction ("dragging always means pointing; the camera moves by button" instead): the control layout (a directional pad, edge-mounted arrow buttons, etc.); whether Stages 1–2 gain any camera movement at all via these buttons or stay exactly as locked-down as they are today (giving the player a way to look around, even off-drag, arguably reopens the "catch the line/plane out as secretly 3D" problem the post-Task-15 orbit lock was built to close — worth a real answer, not an assumption); if Stage 2 does end up movable, whether its resting/default framing then goes dead-on like Stage 1 or stays oblique; and how Stage 4's existing Shift+drag rotation-plane switch (`RevealDrag.tsx`) coexists with camera buttons that might otherwise want the same modifier key.*

**— New session recommended here. The camera's input model is settled; the next task is a game-loop/interaction-timing change on top of it — different enough concerns to keep separate. —**

**Task 18 — Let the player linger on a pass before advancing (Stages 1–2)**
Deliverable: right now, a successful drag on Stage 1/2 calls `advanceStage()` immediately (`ArrowDrag.tsx`) — direct playtest feedback flagged this as not giving the player "enough of a chance to play with it" once they've found a passing direction. On a pass, show feedback and let the player keep exploring (drag again, pass or fail again, as many times as they like) before a stage actually advances, mirroring the existing `ui/CubeFeedback.tsx` "I understand" pattern from Stage 3 — the established precedent in this codebase for "don't auto-advance the instant the condition is met." Failing drags are unaffected (already free to retry, per PLAN.md's original "no artificial lock" locked decision) — this is specifically about no longer yanking the player away the moment they first succeed.
Verify: Playwright — a passing drag on Stage 1/2 does not change `stage` immediately; the player can drag again (pass or fail) while still on the same stage after an initial pass; an explicit continue action advances the stage as before.
*Tunable: exact mechanism — a manual "Continue" button only, or a button plus a fallback auto-advance after some duration/attempt count (matching `CubeFeedback`'s belt-and-braces approach) — left to this task's own UX judgment, following `CubeFeedback`'s precedent either way.*

**Task 19 — Stage 4 instrumentation (rotation, tracked vertex, live cross-section data)**
Deliverable: extends Task 15's panel for the reveal stage. Both `revealRotationXW`/`revealRotationYW` shown in **degrees**, not radians; the slice value `w0`; one specific tesseract vertex tracked through rotation with its live x/y/z/w filling in the same ledger from Task 15 (the first time all four rows hold real numbers at once) — highlight that vertex in the scene in the *same color* as its readout row so the connection between the number and the point is immediate, not something the player has to infer. Also: live edge count of the current render (dynamic 0–12 in slice view; a fixed 32 in projection view, since a projection never drops anything — the contrast between "constant" and "live" between the two views is itself worth the player noticing), cross-section **extent** (`Δx`/`Δy`/`Δz`, not "how wide/tall/deep" prose), and **distance from projection** — the tracked vertex's `viewerDistance − w`, shown next to (not instead of) the resulting shadow-scale multiplier, so "closer along w = bigger in the shadow" reads as cause and effect rather than an opaque number. Whichever field belongs to the view *not* currently showing (edge count while in projection, distance-from-projection while in slice) reads **"sliced away"** or **"hidden behind the shadow"** respectively, rather than "Unknown, unreachable" — a real value the current lens simply isn't showing is a different kind of absence than a structurally locked axis, and should read differently.
Verify: Playwright — confirm the tracked vertex's live coordinates match `math/fourd.ts`'s own rotation functions fed the same drag-driven state (not a re-derivation — same technique `e2e/reveal.spec.ts`'s existing regression test already uses); confirm both placeholder phrases appear in the expected view and disappear in the other; screenshot both views.

**— New session recommended here. The instrumentation panel is done; the warm-up animation and the chirality demo are both fresh, self-contained subsystems rather than extensions of it. —**

**Task 20 — 3D slicing warm-up (into Stage 4)**
Deliverable: `scene/SliceWarmup.tsx` — a short, skippable sequence on entering the reveal stage, before the tesseract itself takes over: an ordinary 3D solid gets cut by a moving 2D plane in ordinary 3D space, with the resulting 2D cross-section shown alongside it, so the player directly watches "moving the cutting plane changes what you see" happen to something recognizable before the identical interaction (Task 14's hyperplane through the tesseract) is handed to them one dimension up. Reuses the same "a camera-facing-plane drag drives a live value" interaction pattern `RevealDrag.tsx` already established, just one dimension down, so the control itself is already familiar by the time the real 4D version arrives.
Verify: Playwright — drag the slice plane through a few positions, confirm the 2D cross-section's shape/size changes correspondingly (screenshot a few sampled positions); confirm the sequence can be skipped and transitions cleanly into Task 14's existing reveal content.
*Tunable: which solid to slice — a cone is recommended (it produces recognizably different conic-section shapes: a point, a growing circle, an ellipse, eventually a parabola-like curve, as the plane's angle and position change) over a sphere (simpler, but only ever produces circles) unless the cone's shape variety reads as distracting rather than illuminating once it's actually on screen. Exactly how long this plays and how obviously skippable it is — both left to this task's own playtest.*

**Task 21 — Chirality / mirror-flip demo**
Deliverable: `scene/ChiralityDemo.tsx` — a second Stage 4 interaction, demonstrating what a 4D rotation can do that no 3D rotation can. A simple, unmistakably asymmetric 3D shape (built from primitives already used elsewhere in this codebase — e.g. an unevenly-arranged set of boxes/cylinders suggesting a hand; no texture-asset pipeline needed or wanted) sits flat at `w = 0`. The player rotates it with the exact same drag control, sensitivity, and responsiveness as `RevealDrag.tsx`'s existing xw/yw rotation; at 180° the shape has become its own mirror image, having visibly and non-uniformly warped through the 4th dimension mid-turn (different parts of the shape pick up different `w` values as they rotate through, so `projectTo3D`'s existing distance-based scaling makes them grow/shrink at different rates — this is the visible tell that it's a 4D rotation and not an ordinary spin, not a bug to smooth over). The math is a direct reuse of `rotateXW`/`rotateYW`/`projectTo3D` verbatim — a 180° rotation in a plane that includes `w`, restricted to the 3 axes a viewer can see, is provably a mirror reflection (negating exactly one visible axis) even though the full 4D transform never stops being a proper rotation. Only the shape's geometry and a solid (non-wireframe) material are new work.
Verify: `npm test` — a unit test (matching `fourd.test.ts`'s style) confirming a 180° `rotateXW` applied to a `w=0` point set produces exactly the x-negated mirror image, in isolation from any rendering. Then Playwright — drag the shape through a half-turn, confirm it renders, responds live to input, and reads as legibly mirrored at the end; screenshot before/mid-turn/after to show the mid-turn warp.
*Tunable: exactly where this sits in the flow — cycling in as a third `revealView` state alongside slice/projection, a separate beat that appears once the player has spent a while in Stage 4 (matching Task 22's "explored for a bit" pattern below), or its own small stage between Reveal and Closing. This is a UX-flow call, not a technical one — left to this task's own judgment.*

**— New session recommended here. The core experience (including both new Stage 4 demonstrations) is complete; what's left is regression-proofing and polish. —**

**Task 22 — Closing beat + restart**
Deliverable: after the player has explored Stage 4 for a bit (a rotation/drag-count threshold, or on a "continue" click), fade in the closing line (something like "A 4-dimensional being trying to point to a 5th dimension hits the exact same wall.") and a restart button resetting to Stage 1.
Verify: Playwright confirms the text appears and restart returns cleanly to Stage 1.

**Task 23 — Full-playthrough regression test**
Deliverable: one Playwright test scripting the entire path (Stage 1 pass → Stage 2 pass → a few Stage 3 fails → give up → Stage 4, including the slicing warm-up and the chirality demo → closing → restart), as a safety net for future changes. Fix any rough edges it surfaces.
Verify: the test passing is the verification; also save a screenshot per stage.

**Task 24 — Visual/tone polish** *(optional, flexible ordering)*
Deliverable: refine materials/line weights/colors, HUD typography, subtle stage-transition fades, progress indicator, final copy pass — including the instrumentation panel's own layout/typography, since Tasks 15/19 prioritized correctness over polish.
Verify: screenshots reviewed against the Task 7 escalation goal (not the old flat "minimalist throughout" one) — worth a quick look-over before calling it done, since tone is subjective.

**Task 25 — Deploy** *(optional, only if you want it live somewhere)*
Deliverable: static deploy config (Vercel/Netlify/GitHub Pages) for the Vite build output.
Verify: `npm run build && npm run preview` matches dev behavior; deployed URL loads correctly.

---

## Tunable parameters (defaults are reasonable guesses, not final answers)

- **Angular tolerance for "roughly orthogonal"** (Task 4): `ratio >= 0.7` (~44° tolerance) as a starting point — worth an actual playtest to see if it feels right.
- **Axis convention** (line=X, plane=XY, cube=XYZ): arbitrary but touches many files once set — fine to leave as-is, but this is the one thing costly to change later, so a quick sanity check before Task 5 is worth it.
- **Attempts before Stage 4** (Task 12): defaulted to 3.
- **"Give up" button visibility** (Task 12): defaulted to appearing after the first failed attempt, to encourage one genuine try first.
- **Cube face translucency & richness** (Task 5, superseded by Task 7): opacity needs to be low enough that the far side of the cube and a mid-drag arrow stay legible through it, high enough to read as "solid." Task 5's flat baseline (`opacity: 0.45`, `#5858a0`) gets replaced entirely by Task 7's shader material — re-tune against the same legibility constraint by eye, and check again once Task 10 has a real mid-drag arrow to test against.
- **Plane stage's "transitional" treatment** (Task 7): exactly what "a cross between the two" looks like — a faint fill, emissive edges, animated shader noise, something else — is intentionally left undecided here. Pick something during Task 7's own playtest and iterate by eye rather than over-specifying it in this doc.
- **Shader/texture approach** (Task 7): procedural (noise/fresnel-driven `ShaderMaterial`) recommended over sourced image textures, since this repo has no texture-asset pipeline yet — revisit if that turns out to be too limiting for the look you want.
- **Drag-to-rotation and drag-to-slice-offset sensitivity** (Task 14): how much 4D rotation angle / `w0` offset a given pixel-drag distance produces — no default chosen yet, tune during Task 14's own playtest.
- **Which tesseract vertex to track** (Task 19): arbitrary — any vertex works for demonstrating a live 4D coordinate, pick whichever highlights clearly against the wireframe/shadow in both views.
- **Solid used for the 3D slicing warm-up** (Task 20): a cone is recommended over a sphere for showing varied conic-section cross-sections rather than always a circle — re-evaluate by eye once it's actually on screen.
- **Where the chirality demo sits in the flow** (Task 21): a third `revealView` state, a separate timed/threshold beat within Stage 4, or its own small stage — left as a UX-flow judgment call for that task.
- **Instrumentation panel placeholder wording** (Tasks 15/19): "Unknown, unreachable" (structurally locked axis), "sliced away" / "hidden behind the shadow" (real value, wrong view), and no row at all (nothing attempted yet) are the three defaults — free to retune the exact phrasing, but keep the three cases visibly distinct from each other, since that distinction is the point.
- **Grid spacing/weight/extent and shape coordinates** (Task 16, done): line 0→3 along `x`, plane 0→3 in `x`/`y`, cube 0→2.5 in each axis with a corner at the world origin; grids extend to `4.5`/`4.5`/`4` respectively past each shape, spacing `0.75` (plane) / `1` (cube) — see `src/scene/shapePositions.ts` and `src/scene/Grid.tsx`. Stage 2's camera tension was deliberately **not** decided by tuning `cameraFraming.ts` here — see Task 17, which replaces the mechanism the tension comes from instead.
- **On-screen camera control layout, and how far it extends to Stages 1-2/Stage 4's modifier key** (Task 17): no defaults chosen — see that task's own tunable note for the open questions.
- **Advance-after-pass mechanism** (Task 18): manual "Continue" button only, vs. a button plus a fallback auto-advance (matching `CubeFeedback`'s belt-and-braces pattern) — no default chosen, left to that task's own UX judgment.

## Verification philosophy throughout

Because this is a visual, interactive app, "the code compiles" or "the unit tests pass" is necessary but never sufficient. Every task above ends with an explicit browser-based check — either a manual `npm run dev` look, or a Playwright script with a screenshot. Insist on that at every task boundary; it's the only way to catch a scene that renders but looks wrong, or an interaction that technically fires but feels off.
