# question-games

A small, standalone library of question-driven game-state machines.

**Status: not wired into the app.** `TurnEngine.jsx`, `Play.jsx`, and
`HostControls.jsx` are untouched. Nothing here is imported by the live game
yet — this is a library to build against later, not a feature.

## Why this exists

The app already has one question-game format, "rapid-shooting," but its
rules and state live inline inside `TurnEngine.jsx` / `Play.jsx` /
`HostControls.jsx`, all tangled up with Firestore transactions and React
rendering. That's fine for one format, but it doesn't generalize — adding a
second format the same way means duplicating that coupling.

This folder pulls the *rules* of new formats out into plain, dependency-free
JS: a state factory + a pure reducer per format. No React, no Firestore, no
timers. That makes each format:

- easy to unit-test in isolation (see `demo.js`)
- reusable for both online (Firestore-backed) and possibly offline/local play
- swappable later without touching game-state persistence code

## Formats included

### Buzzer Race (`buzzerRace.js`)

One question shown to every team at once. Teams "buzz in" to claim the
answer slot; only the first team to buzz gets to answer. A wrong answer
locks that team out of the *current* question and reopens buzzing for
whoever's left. The question resolves when someone answers correctly,
everyone is locked out, or a timeout fires.

### Elimination Trivia (`eliminationTrivia.js`)

Sequential questions, every still-active team answers each one. A wrong
answer eliminates a team for the rest of *this round* only — start a new
round with a fresh `createInitialState()` call to bring everyone back. The
round ends when one team remains or the question set runs out.

## Shared interface

Both formats follow the same shape so a future format (or a rewrite of
rapid-shooting) can match it too:

```js
createInitialState(questions, teamIds, options?) -> state
reducer(state, action) -> nextState   // pure, never mutates state
getResult(state) -> { finished, rankings, ... }
```

`questions` reuses the existing shape from
`src/data/rapidShootingQuestions.js`:

```js
{ id: string, question: string, options: string[], answer: number }
```

## Trying it out

```
node src/lib/questionGames/demo.js
```

Runs both formats against a tiny in-memory question set and prints the
resulting scores/rankings, so you can see the rules work without any UI.

## Not included (by design, per the current task)

- No UI components (no `Play.jsx`/`HostControls.jsx`-style screens)
- No Firestore/network persistence
- No wiring into `TurnEngine.jsx`'s phase machine or `game.minigame`

Hooking one of these formats into the live game (new `minigame.type`,
Firestore transaction, UI screens) is a separate follow-up task.
