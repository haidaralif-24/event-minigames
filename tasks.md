# Roadmap

Fresh build. Work top to bottom — later phases depend on earlier ones.
Re-read `AGENTS.md` and `THEME.md` before starting any phase; both are
short and everything below assumes you've read them.

## Phase 0 — Scaffold
- [ ] `npm create vite@latest . -- --template react`
- [ ] Install deps: `firebase`, `framer-motion`, `tailwindcss` (+ its Vite
      plugin), and set up the Tailwind `@theme` CSS-variable block in
      `src/index.css` per the palette direction in `THEME.md`.
- [ ] Set up Firebase project + Firestore, add `VITE_FIREBASE_*` env vars
      (never hardcode Firebase config).
- [ ] Basic router with three routes: `/host`, `/play`, `/board`.

## Phase 1 — Content pack system
Build this before any page hardcodes text, so nothing needs to be ripped
out later.
- [ ] Create `src/content/README.md` specifying the pack format:
      `src/content/<event-id>/{meta.json, questions.json, README.md}`.
      `meta.json` holds `{ id, title, tagline, teamCount }`. `questions.json`
      entries need `{ id, prompt, choices, answerIndex, sourceRef }`.
- [ ] Create one real content pack (your first event) under
      `src/content/<event-id>/`.
- [ ] Add a single active-event config point (e.g. `ACTIVE_EVENT` in
      `src/data/constants.js`) that imports the active pack's `meta.json`
      and `questions.json`. This is the ONLY place that should reference a
      specific event id.
- [ ] Once Phase 0 + Phase 1 are both done, write `COMPLETED.md` at the
      repo root: a summary of what was built (files, routes, active
      content pack) plus a beginner-friendly Firebase tutorial — creating
      a project, enabling Firestore, finding the web app config keys,
      mapping them to `VITE_FIREBASE_*` env vars, setting up a local
      `.env` (gitignored), and setting the same vars in Vercel. Write it
      assuming the reader has never used Firebase before.

## Phase 2 — Board + dice engine
- [ ] `src/data/boardTiles.json` — tile list with type
      (start/normal/bonus/penalty/finish) and move deltas, content-agnostic.
- [ ] `Board.jsx` — path-based tile layout per `THEME.md` (NOT a grid-snake
      layout). Precompute tile `{x, y}` along a curve, render connecting
      trail + background scenery.
- [ ] `Dice.jsx` — roll animation with framer-motion spring easing.
- [ ] `StickmanToken.jsx` — chunky character token per `THEME.md`, moves
      along the path (not teleporting) when position updates.
- [ ] Firestore `gameState` doc wiring for `turnOrder`, `activeTeamId`,
      `boardPositions` per the data model in `AGENTS.md`.

## Phase 3 — Mini-game contract + first mini-games
- [ ] Write the mini-game contract as a shared doc/skill: every mini-game
      resolves to `MiniGameResult = { teamId, score }[]`, nothing else
      talks to board logic about how that ranking was computed.
- [ ] Build 2–3 mini-games (e.g. reaction-tap, speed-quiz race, one more of
      your choice). Each is its own component with its own internal state,
      producing only the `MiniGameResult` shape at the end.
- [ ] Host-side controls to start a mini-game and collect results into
      `gameState`.

## Phase 4 — Question tiles
- [ ] Wire landing on a question tile to pull a question from the active
      content pack, show it on `/board` and `/play`, resolve correctness
      server-side against `expiresAt` (never trust client timing).

## Phase 5 — Pre-event checks
- [ ] Fill the content pack's `questions.json` with a real bank — enough
      questions to comfortably exceed rounds × question-tile landings.
- [ ] Confirm Firebase env vars are set in Vercel, not just locally.
- [ ] Run the full loop with 2+ devices + 1 projector before the event.
- [ ] `npm run build` clean.
