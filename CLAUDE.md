# Dimensions

An interactive web app that teaches spatial dimensions experientially — line → plane → cube → the wall at 4D → a player-driven demonstration of the 4th dimension via cross-sections and projection. See `PLAN.md` for the full design rationale and task-by-task build guide.

## Before doing anything

1. **Check you're actually starting from the latest work, not just the branch you were handed.** Sessions get pointed at a fresh per-task branch, which may be cut from an older point in history than the repo's actual default branch (`git remote show origin` shows the `HEAD branch`). Run `git ls-remote origin` and compare against the default branch — if other `claude/*` branches exist with commits not reachable from where you are, a previous session's work is sitting there unmerged. Don't assume the two branches your session started with are the whole picture.
2. Read `PROGRESS.md` **on the default branch** to see what's already built and which task is next — a stale task branch's copy of PROGRESS.md can lie by omission.
3. Read only the relevant task section in `PLAN.md` — no need to read the whole file for one task.
4. Do exactly one task from the list. Don't fold in "while I'm here" extras from later tasks — the task boundaries in `PLAN.md`, including the "new session recommended" markers, are deliberate: they exist to keep each session's context focused on one subsystem.

## Stack & structure

- React + TypeScript + Vite
- Three.js via `@react-three/fiber` + `@react-three/drei` (`CameraControls`, not raw `OrbitControls`)
- Zustand for stage/app state. Per-drag interaction state (the live arrow being drawn) stays local to components, not in the store — see PLAN.md's Task 3/9 notes for why.
- Vitest for math/logic unit tests, Playwright for real-browser verification
- `src/state/`, `src/math/`, `src/scene/`, `src/ui/` — see PLAN.md's architecture diagram for what lives where

## Commands

- `npm run dev` — local dev server
- `npm test` — Vitest
- `npx playwright test` — browser/e2e tests
- `npm run build` — production build

## Working conventions

- This is a visual, interactive app — passing tests are necessary but never sufficient. Every task ends by actually looking at the result in a browser (a Playwright screenshot, or a manual look via `npm run dev`).
- Commit at the end of each completed task, referencing the task number, e.g. `Task 4: add validation math`.
- Update `PROGRESS.md` — check off the task, note anything that deviated from the plan — before ending the session.
- **Merge your finished task's commit(s) into the repo's default branch and push it there too** (not just your task branch) before ending the session, when the merge is a clean fast-forward or otherwise conflict-free. The default branch is the single source of truth the next session's step 1 above checks against — if work only ever lands on disposable per-task branches, the default branch's `PROGRESS.md` goes stale and the next session can waste a whole run duplicating what you just did. If the merge isn't clean (a previous session's task branch never got merged either), stop and reconcile that before starting new work — don't stack another divergent branch on top.
- If a task isn't converging, stop and split it into two sessions rather than pushing through a single long one. PLAN.md already flags Tasks 9, 12, and 13 as the likeliest candidates for this.
- Trust the codebase and `PROGRESS.md` over memory of past sessions. A fresh session has no memory of earlier ones — verify claims ("this is already working") by actually running things, not by assuming a prior session's notes were accurate.
- Before yielding for the next prompt, give a one-line context-window check-in: flag it if the conversation is getting long, if earlier context appears to have been auto-summarized, or roughly how many turns/tasks deep the session is. There's no tool access to an exact token count, so keep this qualitative — don't state a precise number or percentage.

## For Henry: how these files get used

Claude Code automatically reads this file at the start of every session — that's why it stays short and points elsewhere instead of duplicating the whole plan. `PLAN.md` and `PROGRESS.md` are not auto-loaded; Claude reads them *because this file tells it to*. Practically, this means you don't need to re-explain the project each time you start a session — something as short as "continue with the next task" is enough, and the instructions above will guide Claude to the right file, the right task, and the right stopping point.
