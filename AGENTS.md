# Party Board Game Engine — Agent Instructions

## What this project is
A browser-based, party-game-night board game for live events: teams play
simultaneous mini-games on their own devices, the results decide dice
order/size, then everyone races on a shared, projected exploration-style
map (winding path through scenery — think Mario Party, NOT a checkerboard
snake grid).

The codebase is split into two layers on purpose, from the start:

1. **Engine** (`src/`, minus `src/content/`) — reusable across any event.
   Routing, Firestore sync, board/dice logic, mini-game contract, theming
   tokens. Nothing event-specific belongs here — ever. This is a template
   meant to be reused for events other than the first one it's built for.
2. **Content pack** (`src/content/<event-id>/`) — everything specific to
   *one* event: title, questions, source references. This is what changes
   when the game is reused for a different event. See
   `src/content/README.md` for the pack format (create this file as part
   of Phase 1 in `tasks.md` — the format is specified there).

If you catch yourself writing `if (eventId === '...')` anywhere outside
`src/content/`, or hardcoding an event's title/questions into a `.jsx`
file, stop — that logic belongs in a content pack, not the engine.

## Game loop (repeats per round)
1. All teams play a mini-game simultaneously on their own device.
2. Mini-game produces a ranking of teams (1st–Nth place).
3. Ranking determines dice order and/or dice size for the board phase
   (e.g. 1st place rolls a d8, last place rolls a d4; OR 1st place rolls first).
4. Teams roll and move along the board. Landing on a "question tile"
   triggers a quiz question pulled from the active content pack (correct =
   bonus move, wrong = move back / lose turn).
5. Repeat with a new mini-game next round.

## Tech stack (do not deviate without asking)
- **Frontend**: Vite + React (NOT Next.js — no SSR/routing needs, keep it simple)
- **Realtime sync**: Firebase Firestore (`onSnapshot` listeners)
- **Hosting**: Firebase Hosting (static `dist/` build) — both hosting and realtime data now live under one Firebase project
- **Content**: hardcoded JSON per content pack in `src/content/<event-id>/`
  — no database or CMS for content
- **Styling**: Tailwind CSS + CSS variable theme tokens (see `THEME.md`)
- **Animation**: framer-motion — use spring/bounce easing, not linear CSS
  transitions; see `THEME.md` for the motion feel this needs

## Roles
- **Host client** (`/host` route): shows the board like spectator plus controls game flow — starts mini-games, advances rounds, resolves dice rolls, reveals question answers. Only privileged writer to `gameState.phase` and `gameState.round`.
- **Team client** (`/play` route): team enters a name, joins, plays
  mini-games, submits answers. Never trust team-submitted correctness or
  timing directly — resolve scoring against server-set `expiresAt`
  timestamps and the answer key, not client-reported elapsed time.
- **Spectator/projector view** (`/board` route): read-only, renders the
  shared exploration map and leaderboard for the room. This is viewed from
  across a room, so legibility at a distance matters more than density.

## Data model (Firestore)
- `gameState` (single doc): `{ phase, round, currentMiniGame, currentQuestion,
  turnOrder: [teamId], activeTeamId, boardPositions: {teamId: tileIndex} }`
- `teams` (collection, one doc per team): `{ name, score, joinedAt }`
- Every mini-game must resolve to the SAME output shape regardless of its
  internal mechanic, so board logic never needs to know how a mini-game
  computed its ranking:
  ```ts
  type MiniGameResult = { teamId: string; score: number }[]
  ```
  Define the full mini-game contract as a skill or doc before implementing
  the first mini-game (see `tasks.md` Phase 3) — don't let each mini-game
  invent its own result shape.

## Board layout (read before building `Board.jsx`)
Positions tiles along a winding path (curve/loop/S-shape), NOT a
`COLS × ROWS` CSS grid with a zigzag index mapping. Precompute each tile's
`{x, y}` from its index along a path (SVG path or hand-authored curve
points) so the board reads as a route through terrain, with connecting
trail/road art and background scenery behind it. Full visual spec is in
`THEME.md` — read it before writing any board rendering code. Tile *type*
logic (start/normal/bonus/penalty/finish) is independent of layout — keep
that in the content-agnostic tile data (`src/data/boardTiles.json`),
never derive tile meaning from screen position.

## Theming
Visual identity (palette, typography, motion, board/token design) is
specified in `THEME.md` at the repo root — read it before writing any
component in `src/components/` or `src/pages/`. Team accent colors belong
in `src/data/constants.js`; event branding (title, tagline) belongs in the
active content pack's `meta.json`, never hardcoded into a page component.

## Non-goals
- No auth system beyond a simple team name + optional host PIN. Root (`/`) is a login screen requiring the hardcoded host password `Dadarzz` (`localStorage`); `/host`, `/play`, `/board` are guarded and redirect to `/` without it.
- No question database / CMS — content packs are static JSON.
- No mobile native app — responsive web app, laptops/projector only.
- No SSR, no server-side API routes — Firestore is the only backend.
- No baking a single event's branding/content into engine code, ever.

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build

## Before finishing any task
Run `npm run build` to confirm it compiles cleanly — this app has no
backend to catch runtime errors for you.
